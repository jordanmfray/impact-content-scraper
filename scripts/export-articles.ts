#!/usr/bin/env tsx

import { writeFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/db'

async function exportArticles() {
  console.log('📤 Exporting articles for seeding...')
  
  try {
    const articles = await prisma.article.findMany({
      include: {
        organization: {
          select: { name: true, website: true }
        },
        rawDocument: {
          select: {
            text: true,
            markdown: true,
            html: true,
            httpStatus: true,
            fetchedAt: true
          }
        },
        enrichment: {
          select: {
            title: true,
            author: true,
            publishedAt: true,
            summary: true,
            keywords: true,
            sentiment: true,
            entitiesJson: true,
            canonicalUrl: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`✅ Found ${articles.length} articles to export`)

    // Transform data for seeding (remove IDs and timestamps, but keep structure)
    const seedData = articles.map(article => ({
      // Article data
      url: article.url,
      title: article.title,
      summary: article.summary,
      content: article.content,
      author: article.author,
      publishedAt: article.publishedAt,
      ogImage: article.ogImage,
      sentiment: article.sentiment,
      keywords: article.keywords,
      status: article.status,
      
      // Organization reference (by name for lookup during seeding)
      organization: {
        name: article.organization.name,
        website: article.organization.website
      },
      
      // Raw document data
      rawDocument: article.rawDocument ? {
        url: article.rawDocument.text ? article.url : null, // Only if we have text
        text: article.rawDocument.text,
        markdown: article.rawDocument.markdown,
        html: article.rawDocument.html,
        httpStatus: article.rawDocument.httpStatus
      } : null,
      
      // Enrichment data  
      enrichment: article.enrichment ? {
        title: article.enrichment.title,
        author: article.enrichment.author,
        publishedAt: article.enrichment.publishedAt,
        summary: article.enrichment.summary,
        keywords: article.enrichment.keywords,
        sentiment: article.enrichment.sentiment,
        entitiesJson: article.enrichment.entitiesJson,
        canonicalUrl: article.enrichment.canonicalUrl
      } : null
    }))

    // Write to JSON file
    const outputPath = join(process.cwd(), 'scripts', 'seed-data', 'articles.json')
    
    // Create directory if it doesn't exist
    const { mkdirSync } = await import('fs')
    const { dirname } = await import('path')
    mkdirSync(dirname(outputPath), { recursive: true })
    
    writeFileSync(outputPath, JSON.stringify(seedData, null, 2))
    
    console.log(`📁 Articles exported to: ${outputPath}`)
    console.log('\n📊 Export Summary:')
    seedData.forEach((article, i) => {
      console.log(`${i + 1}. ${article.title}`)
      console.log(`   🏢 Organization: ${article.organization.name}`)
      console.log(`   🔗 URL: ${article.url}`)
      console.log(`   📝 Summary: ${article.summary?.substring(0, 60)}...`)
      console.log(`   🏷️  Keywords: [${article.keywords.slice(0, 3).join(', ')}]`)
      console.log()
    })

    console.log('✨ Export completed successfully!')
    
  } catch (error) {
    console.error('❌ Export failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportArticles()
}

export { exportArticles }
