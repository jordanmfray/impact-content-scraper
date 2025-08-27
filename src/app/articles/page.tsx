async function fetchArticles() {
  const base = process.env.PAYLOAD_SERVER_URL!
  const r = await fetch(`${base}/api/articles?where[status][equals]=published`, { next: { revalidate: 60 } })
  if (!r.ok) return []
  const data = await r.json()
  return data?.docs ?? []
}

export default async function ArticlesPage() {
  const articles = await fetchArticles()
  return (
    <main style={{ padding: 24 }}>
      <h1>Articles</h1>
      {articles.length === 0 && <p>No published articles yet.</p>}
      <ul>
        {articles.map((a: any) => (
          <li key={a.id}>
            <a href={`/articles/${a.slug || a.id}`}>{a.title || a.sourceUrl}</a>
          </li>
        ))}
      </ul>
    </main>
  )
}
