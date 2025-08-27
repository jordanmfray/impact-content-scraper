const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1'

export async function firecrawlSearch(query: string) {
  const r = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ query, scrapeOptions: { formats: [{ type: 'markdown' }] } }),
  })
  if (!r.ok) throw new Error(`Firecrawl search failed: ${r.status}`)
  return r.json() as Promise<{ items: { url: string; title?: string; description?: string }[] }>
}

export async function firecrawlExtract(urls: string[]) {
  const r = await fetch(`${FIRECRAWL_BASE}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ urls, formats: [{ type: 'markdown' }] }),
  })
  if (!r.ok) throw new Error(`Firecrawl extract failed: ${r.status}`)
  return r.json()
}
