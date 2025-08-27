#!/usr/bin/env tsx
import { runArticleScrapingPipeline } from '../src/inngest/vercelAgentNetwork'
import { prisma } from '../src/lib/db'

interface ScrapeOptions {
  url: string
  organizationId?: string
  organizationName?: string
}

async function manualScrape(options: ScrapeOptions) {
  console.log('🚀 Starting manual article scrape...')
  
  // Resolve organization
  let orgId = options.organizationId
  if (!orgId && options.organizationName) {
    console.log(`🔍 Looking up organization: ${options.organizationName}`)
    const org = await prisma.organization.findFirst({
      where: {
        name: {
          contains: options.organizationName,
          mode: 'insensitive'
        }
      }
    })
    
    if (!org) {
      console.error(`❌ Organization not found: ${options.organizationName}`)
      process.exit(1)
    }
    
    orgId = org.id
    console.log(`✅ Found organization: ${org.name} (${org.id})`)
  }
  
  if (!orgId) {
    console.error('❌ Must provide either organizationId or organizationName')
    process.exit(1)
  }
  
  // Validate URL
  try {
    new URL(options.url)
  } catch (error) {
    console.error(`❌ Invalid URL: ${options.url}`)
    process.exit(1)
  }
  
  console.log(`📖 Scraping article: ${options.url}`)
  console.log(`🏢 Organization ID: ${orgId}`)
  
  // Run the Vercel AI SDK pipeline directly
  try {
    console.log('🚀 Starting direct pipeline execution...')
    const startTime = Date.now()
    
    const result = await runArticleScrapingPipeline(options.url, orgId)
    
    const duration = Date.now() - startTime
    console.log(`\n🎉 Pipeline completed successfully in ${Math.round(duration / 1000)}s!`)
    console.log('📊 Results:')
    console.log(`   📰 Article ID: ${result.articleId}`)
    console.log(`   📋 Title: "${result.title}"`)
    console.log(`   📝 Summary: ${result.summary?.substring(0, 100)}...`)
    console.log(`   🏷️  Keywords: [${result.keywords.slice(0, 4).join(', ')}] (${result.keywords.length} total)`)
    console.log(`   😊 Sentiment: ${result.sentiment}`)
    
    return result
  } catch (error) {
    console.error('❌ Error running pipeline:', error)
    if (error instanceof Error) {
      console.error('   Details:', error.message)
    }
    process.exit(1)
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 Direct Article Scraper (Vercel AI SDK)

Usage:
  npm run manual-scrape <URL> <ORGANIZATION_NAME>
  npm run manual-scrape <URL> --org-id <ORGANIZATION_ID>

Examples:
  npm run manual-scrape "https://example.com/article" "Tesla"
  npm run manual-scrape "https://example.com/article" --org-id "clm123abc"

Options:
  --org-id <id>     Use organization ID instead of name lookup
  --help, -h        Show this help message

The scraper will run directly (no Inngest triggers):
  1. Extract content using Firecrawl
  2. Generate summary and metadata using Vercel AI SDK + ChatGPT
  3. Save to database (DiscoveryResult → RawDocument → Enrichment → Article)
  4. Display results immediately
`)
    process.exit(0)
  }
  
  const url = args[0]
  if (!url) {
    console.error('❌ URL is required')
    process.exit(1)
  }
  
  let organizationId: string | undefined
  let organizationName: string | undefined
  
  const orgIdIndex = args.findIndex(arg => arg === '--org-id')
  if (orgIdIndex !== -1 && args[orgIdIndex + 1]) {
    organizationId = args[orgIdIndex + 1]
  } else if (args[1] && !args[1].startsWith('--')) {
    organizationName = args[1]
  }
  
  if (!organizationId && !organizationName) {
    console.error('❌ Must provide either organization name or --org-id')
    process.exit(1)
  }
  
  try {
    await manualScrape({
      url,
      organizationId,
      organizationName
    })
  } catch (error) {
    console.error('❌ Scraping failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Export for programmatic use
export { manualScrape }

// Run if called directly
main()
