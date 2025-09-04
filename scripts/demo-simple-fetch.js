// Simple demo showing HTTP + parsing approach vs complex Firecrawl
const testUrl = 'https://www.safehouseproject.org/press/';

console.log('🧪 Testing simple HTTP fetch approach...\n');
console.log(`📰 Fetching: ${testUrl}\n`);

fetch(testUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)',
  },
})
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
})
.then(html => {
  console.log(`✅ Successfully fetched ${html.length} characters`);
  console.log(`📊 Content preview:\n`);
  
  // Simple demo - find article-like links in the HTML
  const linkMatches = html.match(/href="([^"]*(?:news|article|story|press|blog)[^"]*?)"/gi) || [];
  const cleanLinks = linkMatches
    .map(match => match.match(/href="([^"]*)"/)?.[1])
    .filter(Boolean)
    .filter(url => url.startsWith('http'))
    .slice(0, 10);

  console.log(`🔗 Found ${cleanLinks.length} potential article links (simple regex demo):`);
  cleanLinks.forEach((url, i) => {
    console.log(`   ${i + 1}. ${url}`);
  });
  
  console.log(`\n💡 This shows the concept works!`);
  console.log(`   ✅ Simple HTTP fetch: SUCCESS`);
  console.log(`   ✅ Content extracted: ${html.length} chars`);
  console.log(`   ✅ Links found: ${cleanLinks.length} URLs`);
  console.log(`\n🎯 Next step: AI would parse this more intelligently than regex`);
  console.log(`   and extract the actual individual article URLs.`);
  console.log(`\n🚀 This approach:`);
  console.log(`   ✅ No Firecrawl API needed (no credit limits)`);  
  console.log(`   ✅ No complex Google Search`);
  console.log(`   ✅ Uses your curated newsUrl directly`);
  console.log(`   ✅ More reliable and cost-effective`);
})
.catch(error => {
  console.error('❌ Error:', error.message);
});
