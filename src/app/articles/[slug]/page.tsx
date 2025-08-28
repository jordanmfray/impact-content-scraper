interface PageProps { 
  params: Promise<{ slug: string }> 
}

async function fetchArticle(slug: string) {
  const base = process.env.PAYLOAD_SERVER_URL!
  const r = await fetch(`${base}/api/articles?where[slug][equals]=${encodeURIComponent(slug)}`)
  if (!r.ok) return null
  const data = await r.json()
  return data?.docs?.[0] ?? null
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = await fetchArticle(slug)
  if (!article) return <main style={{ padding: 24 }}>Not found.</main>
  return (
    <main style={{ padding: 24 }}>
      <h1>{article.title}</h1>
      {article.summary && <p>{article.summary}</p>}
      {article.body && <div dangerouslySetInnerHTML={{ __html: article.body }} />}
      {article.sourceUrl && (
        <p>
          Source: <a href={article.sourceUrl} target="_blank" rel="noreferrer">{article.sourceUrl}</a>
        </p>
      )}
    </main>
  )
}
