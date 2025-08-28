#!/usr/bin/env tsx

import { prisma } from '../src/lib/db'
import { runArticleScrapingPipeline } from '../src/inngest/vercelAgentNetwork'

// URLs to scrape for seeding
const SEED_URLS = [
  {
    url: "https://www.compassion.com/news-releases/compassion-international-artists-shine-at-k-love-fan-awards.htm",
    organizationName: "Compassion International, Inc."
  },
  {
    url: "https://www.guidestone.org/newsroom/news-releases/guidestone-announces-new-president",
    organizationName: "GuideStone"
  },
  {
    url: "https://www.ijm.org/news/international-justice-mission-releases-2023-annual-report",
    organizationName: "International Justice Mission"
  },
  {
    url: "https://www.sbc.net/news/southern-baptist-convention-annual-meeting-2024",
    organizationName: "Southern Baptist Convention"
  },
  {
    url: "https://www.nazarene.org/news/church-of-the-nazarene-general-assembly-2023",
    organizationName: "Church of the Nazarene"
  }
]

async function seedArticlesLive() {
  console.log('🌱 Starting live article seeding with Firecrawl...')
  console.log('🔥 This will use actual web scraping for fresh, high-quality content\n')
  
  try {
    // Check existing articles
    const existingCount = await prisma.article.count()
    if (existingCount > 0) {
      console.log(`⚠️  Database already contains ${existingCount} articles`)
      console.log('   To reseed with fresh content, reset the database first:')
      console.log('   npx prisma migrate reset && npm run seed:organizations')
      return
    }

    let successCount = 0
    let failCount = 0
    
    for (let i = 0; i < SEED_URLS.length; i++) {
      const { url, organizationName } = SEED_URLS[i]
      
      console.log(`\n📥 [${i + 1}/${SEED_URLS.length}] Scraping: ${organizationName}`)
      console.log(`🔗 URL: ${url}`)
      
      try {
        // Find organization
        const organization = await prisma.organization.findFirst({
          where: { name: organizationName }
        })
        
        if (!organization) {
          console.log(`❌ Organization not found: ${organizationName}`)
          failCount++
          continue
        }

        // Check if article already exists
        const existingArticle = await prisma.article.findUnique({
          where: { url: url }
        })

        if (existingArticle) {
          console.log(`⚠️  Article already exists, skipping: ${url}`)
          continue
        }

        console.log(`🔥 Starting Firecrawl extraction...`)
        
        // Use our actual scraping pipeline
        const result = await runArticleScrapingPipeline(url, organization.id)
        
        if (result.success) {
          console.log(`✅ Successfully scraped: "${result.title}"`)
          console.log(`📊 Summary: ${result.summary?.substring(0, 100)}...`)
          console.log(`🔑 Keywords: ${result.keywords?.length || 0}`)
          console.log(`😊 Sentiment: ${result.sentiment}`)
          successCount++
        } else {
          console.log(`❌ Scraping failed: Unknown error`)
          failCount++
        }
        
        // Add a small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error)
        failCount++
      }
    }

    console.log(`\n🎉 Live seeding completed!`)
    console.log(`✅ Successful scrapes: ${successCount}`)
    console.log(`❌ Failed scrapes: ${failCount}`)
    
    // Show final count
    const totalArticles = await prisma.article.count()
    console.log(`📊 Total articles in database: ${totalArticles}`)
    console.log(`✨ Live seeding process completed`)
    
  } catch (error) {
    console.error('❌ Live seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
seedArticlesLive()

export { seedArticlesLive }
