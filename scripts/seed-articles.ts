#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/db'

interface SeedArticle {
  url: string
  title: string
  summary: string
  content: string
  author?: string
  publishedAt?: Date
  ogImage?: string
  sentiment: string
  keywords: string[]
  status: string
  organization: {
    name: string
    website?: string
  }
  rawDocument?: {
    url?: string
    text?: string
    markdown?: string
    html?: string
    httpStatus?: number
  }
  enrichment?: {
    title?: string
    author?: string
    publishedAt?: Date
    summary?: string
    keywords?: string[]
    sentiment?: string
    entitiesJson?: any
    canonicalUrl?: string
  }
}

async function seedArticles() {
  console.log('🌱 Starting article seeding...')
  
  try {
    // Load seed data
    const seedDataPath = join(process.cwd(), 'scripts', 'seed-data', 'articles.json')
    const seedData: SeedArticle[] = JSON.parse(readFileSync(seedDataPath, 'utf-8'))
    
    console.log(`📊 Found ${seedData.length} articles to seed`)

    // Check if articles already exist
    const existingCount = await prisma.article.count()
    if (existingCount > 0) {
      console.log(`⚠️  Database already contains ${existingCount} articles`)
      console.log('   Skipping seeding to avoid duplicates')
      console.log('   To reseed, reset the database first: npx prisma migrate reset')
      return
    }

    let seedCount = 0
    
    for (const articleData of seedData) {
      try {
        // Find organization by name
        const organization = await prisma.organization.findFirst({
          where: { name: articleData.organization.name }
        })
        
        if (!organization) {
          console.log(`⚠️  Organization not found: ${articleData.organization.name}`)
          console.log('   Skipping article:', articleData.title)
          continue
        }

        // Check if article with this URL already exists
        const existingArticle = await prisma.article.findUnique({
          where: { url: articleData.url }
        })

        if (existingArticle) {
          console.log(`⚠️  Article already exists: ${articleData.url}`)
          continue
        }

        // Create article
        const article = await prisma.article.create({
          data: {
            organizationId: organization.id,
            url: articleData.url,
            title: articleData.title,
            summary: articleData.summary,
            content: articleData.content,
            author: articleData.author,
            publishedAt: articleData.publishedAt ? new Date(articleData.publishedAt) : null,
            ogImage: articleData.ogImage,
            sentiment: articleData.sentiment,
            keywords: articleData.keywords,
            status: articleData.status,
          }
        })

        // Create raw document if data exists
        if (articleData.rawDocument && articleData.rawDocument.text) {
          await prisma.rawDocument.create({
            data: {
              articleId: article.id,
              url: articleData.url,
              text: articleData.rawDocument.text,
              markdown: articleData.rawDocument.markdown,
              html: articleData.rawDocument.html,
              httpStatus: articleData.rawDocument.httpStatus || 200,
              fetchedAt: new Date(),
            }
          })
        }

        // Create enrichment if data exists  
        if (articleData.enrichment) {
          await prisma.enrichment.create({
            data: {
              articleId: article.id,
              title: articleData.enrichment.title,
              author: articleData.enrichment.author,
              publishedAt: articleData.enrichment.publishedAt ? new Date(articleData.enrichment.publishedAt) : null,
              summary: articleData.enrichment.summary,
              keywords: articleData.enrichment.keywords || [],
              sentiment: articleData.enrichment.sentiment,
              entitiesJson: articleData.enrichment.entitiesJson,
              canonicalUrl: articleData.enrichment.canonicalUrl,
            }
          })
        }

        console.log(`✅ Created article: ${articleData.title}`)
        seedCount++
        
      } catch (error) {
        console.error(`❌ Failed to create article: ${articleData.title}`)
        console.error('   Error:', error)
      }
    }

    console.log(`\n🎉 Article seeding completed!`)
    console.log(`📈 Total articles seeded: ${seedCount}`)
    
    // Show final count
    const totalArticles = await prisma.article.count()
    console.log(`📊 Total articles in database: ${totalArticles}`)
    console.log(`✨ Seeding process completed successfully`)
    
  } catch (error) {
    console.error('❌ Article seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
seedArticles()
