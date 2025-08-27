export default async function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Aggregation App</h1>
      <p>Next.js + Supabase + Inngest pipeline for content aggregation.</p>
      <ul>
        <li>Database: <a href="http://127.0.0.1:54321" target="_blank">Supabase Studio</a></li>
        <li>Functions: <a href="http://localhost:8288" target="_blank">Inngest Dev Server</a></li>
        <li>API: POST <code>/api/agents/trigger</code> to kick off scraping for queued discoveries.</li>
      </ul>
      <p>Ready to add Payload CMS when needed.</p>
    </main>
  )
}
