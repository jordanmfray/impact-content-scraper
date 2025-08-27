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
      Authorization: `Bearer ${process.env.PAYLOAD_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ ...input, status: 'draft' }),
  })
  if (!r.ok) throw new Error(`CMS upsert failed: ${r.status}`)
  return r.json()
}
