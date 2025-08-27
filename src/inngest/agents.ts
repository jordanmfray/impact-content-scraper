import { createAgent } from '@inngest/agent-kit'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { firecrawlSearch, firecrawlExtract } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'

export const DiscoveryAgent = createAgent({
  name: 'discovery',
  description: 'Find URLs about an org using Firecrawl search',
  inputSchema: z.object({ organizationId: z.string() }),
  run: async ({ input }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
    })
    if (!org) return { urls: [] }
    const q = org.name
    const res = await firecrawlSearch(q)

    const urls = res.items.map(i => ({ url: i.url, title: i.title }))

    for (const u of urls) {
      const hash = await sha256(u.url)
      await prisma.discoveryResult.upsert({
        where: { hash },
        create: {
          hash,
          organizationId: org.id,
          url: u.url,
          title: u.title ?? null,
          status: 'queued',
        },
        update: {},
      })
    }
    return { urls }
  },
})

export const ScrapeAgent = createAgent({
  name: 'scrape',
  description: 'Extract markdown from URL via Firecrawl',
  inputSchema: z.object({ discoveryId: z.string(), url: z.string().url() }),
  run: async ({ input }) => {
    const data = await firecrawlExtract([input.url])
    const first = Array.isArray(data?.results) ? data.results[0] : data
    await prisma.rawDocument.upsert({
      where: { discoveryId: input.discoveryId },
      create: { discoveryId: input.discoveryId, url: input.url, html: first?.html ?? null, markdown: first?.markdown ?? null, text: first?.text ?? null, httpStatus: first?.status ?? null },
      update: { html: first?.html ?? null, markdown: first?.markdown ?? null, text: first?.text ?? null, httpStatus: first?.status ?? null },
    })
    return { ok: true }
  },
})

export const EnrichAgent = createAgent({
  name: 'enrich',
  description: 'Summarize and extract metadata using OpenAI',
  inputSchema: z.object({ discoveryId: z.string() }),
  run: async ({ input }) => {
    const raw = await prisma.rawDocument.findUnique({ where: { discoveryId: input.discoveryId } })
    if (!raw?.markdown && !raw?.text) return { skipped: true }

    const userContent = (raw.markdown ?? raw.text ?? '').slice(0, 12000)
    const messages: any[] = [
      { role: 'system', content: 'Extract JSON: title, author, publishedAt, canonicalUrl, summary (2-3 sentences), keywords (5-8), sentiment (pos|neu|neg).' },
      { role: 'user', content: userContent },
    ]

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const data = JSON.parse(res.choices[0].message.content ?? '{}')

    await prisma.enrichment.upsert({
      where: { discoveryId: input.discoveryId },
      create: { discoveryId: input.discoveryId, ...normalize(data) },
      update: { ...normalize(data) },
    })

    return { data }
  },
})

function normalize(d: any) {
  return {
    title: d.title ?? null,
    author: d.author ?? null,
    publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
    summary: d.summary ?? null,
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
    canonicalUrl: d.canonicalUrl ?? null,
    sentiment: d.sentiment ?? null,
    entitiesJson: d.entities ?? null,
  }
}

async function sha256(input: string) {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
