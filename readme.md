# Aggregation App — PRD & README

> **Goal**: Build a background-research + editorial publishing system that discovers new articles/posts about target organizations, crawls + parses content, deduplicates and enriches it, then creates **draft** records that an editor can review in **Payload CMS** and publish. Frontend is a Next.js app. Background work is orchestrated with **Inngest Agent Kit** (agents + schedules). Data lives in **Supabase Postgres** (Prisma for app tables). Auth via **Supabase Auth**. Crawling via **Firecrawl**. Summarization/extraction via **ChatGPT API**.

---

## 1) Product Requirements (PRD)

### 1.1 Users & Jobs-to-be-Done

* **Admin/Editor** (internal): configure organizations to track; review incoming drafts; edit metadata; publish to site.
* **Reader** (public): browse/search published articles by organization, topic, tags.
* **Background Agents** (system): continuously discover relevant content, crawl, parse, enrich, dedupe, and create CMS drafts.

### 1.2 In-Scope (V1)

* Organization tracking (name, aliases, primary domains, keywords).
* Automated **discovery** (web search), **crawling** (Firecrawl), **parsing + normalization**, **enrichment** (LLM summary/tags), **deduplication** (URL + content hash).
* Create **draft** Articles in Payload CMS with all source metadata.
* Editorial workflow in Payload: Draft → In Review → Published (with audit trail).
* Public Next.js site: list & detail pages for **published** articles; search & filters.
* Basic RLS + service roles for background agents.

### 1.3 Out-of-Scope (V1)

* Advanced analytics, multi-language translation, full media ingestion, complex SSO into Payload.

### 1.4 Success Metrics

* Time-to-first-draft from adding org ≤ 10 minutes.
* Draft precision (relevance) ≥ 80% (editor keeps as draft or publishes rather than rejects).
* Crawl failure rate < 5% over 24h.

---

## 2) System Overview

### 2.1 Stack

* **Next.js** (App Router) for public UI and internal dashboards.
* **Inngest Agent Kit** for multi-agent orchestration, scheduling, retries, and state.
* **Firecrawl** for search/crawl/extract.
* **ChatGPT API** for enrichment (summary, topics, entities, sentiment, publishability signals).
* **Supabase** (Postgres + Auth). **Prisma** manages app-owned tables (ingestion, jobs, organizations).
* **Payload CMS** (Postgres adapter) as the editorial CMS, same Postgres instance (separate schema) for a single source of truth.

### 2.2 High-Level Flow (ASCII)

```
[Org Config] ─┐                                           ┌─> [Payload CMS Admin]
              ├─(cron/event)──> [Discovery Agent] ───┐    │      Draft → Publish
[Keywords] ───┘                                      │    │
                                                     ▼    │
                                               [URLs Found]
                                                     │
                                                     ▼
                                              [Scrape Agent]
                                                     │  (Firecrawl)
                                                     ▼
                                             [Parse/Normalize]
                                                     │
                                                     ▼
                                              [Enrich Agent]
                                    (ChatGPT: summary, tags, signals)
                                                     │
                                                     ▼
                                              [Deduper/QA]
                                                     │
                                                     ▼
                                      [Create/Update Draft in CMS]
                                                     │
                                                     ▼
                                            [Published Articles]
                                                     │
                                                     ▼
                                            [Next.js Public UI]
```

### 2.3 Data Domains

* **App (Prisma)**: `organizations`, `org_aliases`, `org_keywords`, `discovery_results`, `crawl_jobs`, `raw_documents`, `enrichments`, `article_signals`, `task_runs`, `webhook_events`.
* **CMS (Payload)**: `articles`, `tags`, `organizations` (synced/id-linked), `authors`, `images`.

> Best practice: keep **Prisma-managed** tables in schema `app` and **Payload** in schema `cms` within the same Supabase Postgres. Avoid dual ownership of the same table.

---

## 3) Data Model (Prisma — app schema)

> Snippet (extend as needed). We use `pgvector` for embeddings (optional, for semantic search).

```prisma
// schema.prisma
// generator + datasource omitted for brevity

model Organization {
  id            String   @id @default(cuid())
  name          String
  primaryDomain String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  aliases       OrgAlias[]
  keywords      OrgKeyword[]
}

model OrgAlias {
  id             String   @id @default(cuid())
  organizationId String
  value          String
  Organization   Organization @relation(fields: [organizationId], references: [id])
}

model OrgKeyword {
  id             String   @id @default(cuid())
  organizationId String
  value          String
  Organization   Organization @relation(fields: [organizationId], references: [id])
}

model DiscoveryResult {
  id             String   @id @default(cuid())
  organizationId String
  url            String
  title          String?
  description    String?
  discoveredAt   DateTime @default(now())
  status         String   // queued | scraped | failed | discarded
  hash           String   // sha256(url)
  unique([hash])
}

model RawDocument {
  id            String   @id @default(cuid())
  discoveryId   String   @unique
  url           String
  html          String?
  markdown      String?
  text          String?
  httpStatus    Int?
  fetchedAt     DateTime @default(now())
}

model Enrichment {
  id            String   @id @default(cuid())
  discoveryId   String   @unique
  title         String?
  author        String?
  publishedAt   DateTime?
  summary       String?
  keywords      String[]
  sentiment     String?   // pos | neu | neg
  entitiesJson  Json?
  canonicalUrl  String?
}

model ArticleSignal {
  id            String   @id @default(cuid())
  discoveryId   String   @unique
  relevance     Float    // 0..1
  quality       Float
  duplicateOf   String?  // discoveryId if dup
  publishable   Boolean
}

// Optional: embeddings for semantic search
model DocumentEmbedding {
  id           String   @id @default(cuid())
  discoveryId  String   @unique
  provider     String   // openai:text-embedding-3-large
  dim          Int
  embedding    Bytes    @db.Vector(3072) // adjust dim
}
```

**SQL (run in Supabase) — one-time**

```sql
create schema if not exists app;
create schema if not exists cms;
create extension if not exists vector;
```

---

## 4) Payload CMS (cms schema)

### 4.1 Adapter & DB

* Use **@payloadcms/db-postgres** pointing to the same Supabase Postgres instance (but default to `cms` schema).
* Collections: `articles`, `organizations`, `tags`, `authors`.

### 4.2 Collections (outline)

```ts
// payload/collections/Articles.ts
import { CollectionConfig } from 'payload/types'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true },
  access: {
    read: ({ req }) => ({ status: { equals: 'published' } }), // public API shows only published
    update: ({ req }) => req.user?.roles?.includes('editor'),
    create: ({ req }) => req.user?.roles?.includes('editor'),
  },
  fields: [
    { name: 'status', type: 'select', defaultValue: 'draft', options: ['draft','in_review','published','rejected'], required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true },
    { name: 'summary', type: 'textarea' },
    { name: 'body', type: 'richText' },
    { name: 'sourceUrl', type: 'text' },
    { name: 'canonicalUrl', type: 'text' },
    { name: 'author', type: 'text' },
    { name: 'publishedAtExternal', type: 'date' },
    { name: 'organization', type: 'relationship', relationTo: 'organizations' },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
    { name: 'rawDiscoveryId', type: 'text' }, // app.discoveries id backref
  ],
  hooks: {
    afterChange: [async ({ doc, previousDoc }) => {
      // Optional: emit webhooks or trigger reindex on status change
    }],
  }
}
```

> Drafts are created by agents via **Payload REST API** using a service account. Editors review & publish inside the Payload admin UI.

---

## 5) Agent Network (Inngest Agent Kit)

### 5.1 Agents

* **DiscoveryAgent**: given org + keywords → chat GPT Deep Research → yields candidate URLs with titles/descriptions.
* **ScrapeAgent**: consumes URLs → Firecrawl **/extract** (markdown preferred) → stores `RawDocument`.
* **EnrichAgent**: runs LLM (ChatGPT) → extracts `title/author/date`, `summary`, `keywords`, `entities`, `sentiment` → saves `Enrichment`.
* **DeduperAgent**: hashes normalized text, checks similarity (optional embeddings) → flags duplicates & quality signals.
* **CmsDraftAgent**: creates/updates **Payload CMS** Article with `status=draft`, attaches metadata, sets `rawDiscoveryId`.

### 5.2 Events (names & payloads)

* `orgs.discovery.requested` `{ organizationId }`
* `content.scrape.requested` `{ discoveryId, url }`
* `content.enrich.requested` `{ discoveryId }`
* `cms.article.upsert.requested` `{ discoveryId }`

> Cron: hourly per active org → `orgs.discovery.requested` (fan-out).

### 5.3 Orchestrations

* **Pipeline Function**: listen on `orgs.discovery.requested` → run DiscoveryAgent → enqueue `content.scrape.requested` for each new URL.
* On `content.scrape.requested`: ScrapeAgent → EnrichAgent → DeduperAgent → if publishable → `cms.article.upsert.requested`.
* All steps idempotent (use URL/DiscoveryResult hash uniqueness).

### 5.4 Guardrails

* Domain allow/deny lists per org.
* Respect robots & rate limits (Firecrawl handles crawl politeness; also set job concurrency caps).
* Min content length thresholds; language filter; date recency filter.

---

## 6) Public UI (Next.js)

* **Routes**: `/articles`, `/articles/[slug]`, `/orgs/[id]`, `/tags/[tag]`.
* **Data fetching**: Server actions or Route Handlers that call **Payload REST/GraphQL** (filter `status=published`).
* **Search**: by title, tag, organization; (optional) semantic search using `DocumentEmbedding` table.
* **Auth (optional for Admin Dash)**: Supabase Auth for any internal viewer dashboards (not required for Payload admin).

---

## 7) API Surfaces

* **Payload REST** (server-to-server): create/update draft Articles.
* **Internal Route Handlers** (Next.js, /api/\*):

  * `/api/webhooks/payload` (verify secret; react to publish events → revalidate Next.js cache).
  * `/api/agents/*` (optional: trigger ad-hoc re-crawl/enrich).
* **Inngest** endpoints for event ingestion & dev server UI.

---

## 8) Deduplication & Quality

* **URL-level**: normalize URL (strip UTM, anchors); unique on `hash(url)`.
* **Content-level**: normalize text (collapse whitespace, strip boilerplate) → compute `sha256`; consider near-dup with cosine similarity on embeddings.
* **Quality signals**: length, readability score, external published date recency, site authority heuristics. Store in `ArticleSignal`.

---

## 9) Security & Auth

* **Supabase Auth**: app users sign in (if needed). Agents use **service role** key in server-only contexts (never client).
* **RLS**: Enabled on `app.*` tables; allow **service role** full access; deny public by default.
* **Secrets**: All third-party API keys via environment.
* **Payload Admin**: separate editor login; restrict to internal users.

---

## 10) Observability

* Inngest provides step-level logs/timelines; surface error counts in a simple health page.
* Optional: Sentry for server/runtime errors.

---

## 11) Local Dev & Environments

* **Local**: Supabase (remote or local), Payload in dev mode, Inngest Dev Server, Next.js dev server.
* **Staging/Prod**: Deploy on Vercel (Next.js + Inngest), Payload on serverless or a small Node container. All point to Supabase prod.

---

## 12) Setup & Run

### 12.1 Environment Variables

Create `.env` with:

```
# Supabase
DATABASE_URL=postgresql://user:pass@host:5432/postgres
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth (Next.js)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Firecrawl
FIRECRAWL_API_KEY=...

# OpenAI
OPENAI_API_KEY=...

# Payload
PAYLOAD_SECRET=long-random
PAYLOAD_POSTGRES_URL=${DATABASE_URL}
PAYLOAD_SCHEMA=cms
PAYLOAD_SERVER_URL=http://localhost:3001

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### 12.2 Bootstrap Commands (suggested)

```bash
# 1) Install deps
pnpm i

# 2) DB prep (Supabase)
# create schemas + pgvector (see SQL above)

# 3) Prisma for app schema
pnpm prisma migrate dev

# 4) Start Payload (pointing to cms schema)
pnpm payload:dev

# 5) Start Inngest Dev Server
pnpm inngest dev

# 6) Start Next.js
pnpm dev
```

---

## 13) Key Implementation Snippets (scaffolds)

### 13.1 Inngest Agent Kit — Agents & Network (TS)

```ts
// inngest/agents.ts
import { createAgent, createNetwork } from '@inngest/agent-kit'
import { z } from 'zod'
import { firecrawlSearch, firecrawlExtract } from '../lib/firecrawl'
import { upsertDiscovery, saveRaw, saveEnrichment, markSignals } from '../lib/db'
import { openai } from '../lib/openai'

export const DiscoveryAgent = createAgent({
  name: 'discovery',
  description: 'Find new URLs about an organization',
  inputSchema: z.object({ organizationId: z.string() }),
  run: async ({ input }) => {
    const org = await db.organization.findUnique({ where: { id: input.organizationId }, include: { aliases: true, keywords: true } })
    const q = `${org.name} ${org.keywords.map(k=>k.value).join(' ')}`
    const results = await firecrawlSearch(q)
    const urls = results.items.map(r => ({ url: r.url, title: r.title, description: r.description }))
    return { urls }
  }
})

export const ScrapeAgent = createAgent({
  name: 'scrape',
  description: 'Extract markdown/text from URL',
  inputSchema: z.object({ discoveryId: z.string(), url: z.string().url() }),
  run: async ({ input }) => {
    const doc = await firecrawlExtract([input.url])
    await saveRaw(input.discoveryId, doc)
    return { ok: true }
  }
})

export const EnrichAgent = createAgent({
  name: 'enrich',
  description: 'Summarize and extract metadata',
  inputSchema: z.object({ discoveryId: z.string() }),
  run: async ({ input }) => {
    const raw = await db.rawDocument.findUnique({ where: { discoveryId: input.discoveryId }})
    const prompt = `Extract: title, author, published date, canonical url. Then a 2-3 sentence summary, 5-8 keywords.`
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [ { role: 'system', content: 'You are a precise content extractor.' }, { role: 'user', content: raw.markdown?.slice(0, 12000) } ],
      response_format: { type: 'json_object' }
    })
    const data = JSON.parse(res.choices[0].message.content!)
    await saveEnrichment(input.discoveryId, data)
    return { data }
  }
})

export const network = createNetwork({ agents: [DiscoveryAgent, ScrapeAgent, EnrichAgent] })
```

### 13.2 Inngest Functions (events & cron)

```ts
// inngest/functions.ts
import { inngest } from './client'
import { DiscoveryAgent, ScrapeAgent, EnrichAgent } from './agents'

export const hourlyDiscovery = inngest.createFunction({ id: 'hourly-discovery', cron: '0 * * * *' },
  async ({ step }) => {
    const orgs = await db.organization.findMany()
    for (const org of orgs) {
      await step.run(`discover-${org.id}`, async () => DiscoveryAgent.run({ input: { organizationId: org.id } }))
    }
  })

export const pipeline = inngest.createFunction({ id: 'scrape-enrich-pipeline', event: 'content.scrape.requested' },
  async ({ event, step }) => {
    const { discoveryId, url } = event.data
    await step.run('scrape', () => ScrapeAgent.run({ input: { discoveryId, url } }))
    await step.run('enrich', () => EnrichAgent.run({ input: { discoveryId } }))
    // dedupe + cms upsert... (omitted)
  })
```

### 13.3 Firecrawl Helpers

```ts
// lib/firecrawl.ts
export async function firecrawlSearch(q: string) {
  const r = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ query: q, scrapeOptions: { formats: [{ type: 'markdown' }] } })
  })
  return r.json()
}

export async function firecrawlExtract(urls: string[]) {
  const r = await fetch('https://api.firecrawl.dev/v1/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ urls, formats: [{ type: 'markdown' }] })
  })
  return r.json()
}
```

### 13.4 Payload Draft Upsert (server-to-server)

```ts
// lib/cms.ts
export async function upsertArticleDraft(input: {
  title?: string
  summary?: string
  body?: string
  sourceUrl: string
  canonicalUrl?: string
  author?: string
  publishedAtExternal?: string
  organizationId?: string
  rawDiscoveryId: string
}) {
  const r = await fetch(`${process.env.PAYLOAD_SERVER_URL}/api/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PAYLOAD_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ ...input, status: 'draft' })
  })
  if (!r.ok) throw new Error(`CMS upsert failed: ${r.status}`)
  return r.json()
}
```

---

## 14) Editorial Workflow

1. Agents create **draft** Articles with extracted fields.
2. Editors review, tweak title/summary/tags, correct author/date if needed.
3. Editors set `status = in_review` → optional second pair of eyes.
4. Editors set `status = published` → site auto-revalidates and shows article.

**Auditability**: enable Payload versions; keep app-side provenance (discoveryId, crawl timestamp, source URL, content hash).

---

## 15) Roadmap

* **V0 (week 1)**: Schemas, Payload boot, Firecrawl integration, manual run of pipeline → draft creation.
* **V1**: Hourly discovery per org, dedupe + quality signals, publish flow, public UI list/detail, search.
* **V1.1**: Embeddings + semantic search; RSS/Atom export; source-level insights; org page with latest mentions.
* **V2**: Multi-tenant orgs; newsroom queues; model-assisted headline rewrites; email digests.

---

## 16) Developer Notes (Cursor-friendly)

* Keep small, focused modules; prefer server-only files for secrets.
* Add typed zod schemas for every event payload.
* Make every Inngest step **idempotent** (external calls wrapped with dedupe keys).
* Use feature flags to safely iterate on the pipeline.

---

## 17) References

* Inngest Agent Kit: [https://agentkit.inngest.com](https://agentkit.inngest.com)
* Payload Postgres Adapter: [https://payloadcms.com/docs/database/postgres](https://payloadcms.com/docs/database/postgres)
* Firecrawl API: [https://docs.firecrawl.dev](https://docs.firecrawl.dev)
* Supabase + Prisma: [https://supabase.com/docs/guides/database/prisma](https://supabase.com/docs/guides/database/prisma)
* Vercel AI SDK: [https://ai-sdk.dev/docs/introduction](https://ai-sdk.dev/docs/introduction)
* OpenAI API: [https://platform.openai.com/docs](https://platform.openai.com/docs)
