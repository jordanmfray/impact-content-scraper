import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractArticlesFromUrls, pollAllExtractJobs } from '@/lib/firecrawlExtractIndividual'
import { analyzeSentimentScale } from '@/ai-functions/analyzeSentimentScale'
import { 
  extractImagesFromHtml, 
  sortImagesBySize, 
  selectBestImage, 
  formatArticleTitle 
} from '@/lib/imageExtraction'

interface EnhancedBulkScrapeRequest {
  organizationId: string
  urls: string[]
  options?: {
    enableSentimentAnalysis?: boolean
    enableImageExtraction?: boolean  
    enableTitleFormatting?: boolean
    concurrency?: number
    batchDelay?: number
  }
}

interface EnhancedScrapeResult {
  url: string
  status: 'success' | 'error' | 'duplicate' | 'skipped'
  message?: string
  articleId?: string
  title?: string
  sentimentScore?: number
  imageCount?: number
  ogImage?: string | null
  processingTime?: number
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: EnhancedBulkScrapeRequest = await request.json()
    const { organizationId, urls, options = {} } = body
    
    const {
      enableSentimentAnalysis = true,
      enableImageExtraction = true,
      enableTitleFormatting = true,
      concurrency = 3,
      batchDelay = 2000
    } = options

    if (!organizationId || !urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Organization ID and URLs array are required'
      }, { status: 400 })
    }

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found'
      }, { status: 404 })
    }

    console.log(`🚀 Starting enhanced bulk scrape for ${organization.name}:`)
    console.log(`   📊 ${urls.length} URLs to process`)
    console.log(`   🔍 Sentiment Analysis: ${enableSentimentAnalysis ? 'ON' : 'OFF'}`)
    console.log(`   🖼️ Image Extraction: ${enableImageExtraction ? 'ON' : 'OFF'}`)
    console.log(`   ✏️ Title Formatting: ${enableTitleFormatting ? 'ON' : 'OFF'}`)

    // Clean and validate URLs
    const validUrls: string[] = []
    const invalidResults: EnhancedScrapeResult[] = []

    for (const url of urls) {
      const cleanUrl = url.trim()
      if (!cleanUrl) {
        invalidResults.push({
          url,
          status: 'error',
          message: 'Empty URL'
        })
        continue
      }

      try {
        new URL(cleanUrl)
        
        // Check for duplicates
        const existingArticle = await prisma.article.findFirst({
          where: { url: cleanUrl }
        })
        
        if (existingArticle) {
          invalidResults.push({
            url: cleanUrl,
            status: 'duplicate',
            message: `Article already exists: "${existingArticle.title}"`,
            articleId: existingArticle.id
          })
          continue
        }
        
        validUrls.push(cleanUrl)
      } catch {
        invalidResults.push({
          url: cleanUrl,
          status: 'error',
          message: 'Invalid URL format'
        })
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json({
        success: true,
        results: invalidResults,
        summary: {
          total: urls.length,
          success: 0,
          error: invalidResults.filter(r => r.status === 'error').length,
          duplicate: invalidResults.filter(r => r.status === 'duplicate').length,
          skipped: 0
        }
      })
    }

    // Process URLs in batches with concurrency control
    const results: EnhancedScrapeResult[] = [...invalidResults]
    
    // Split valid URLs into chunks for processing
    const chunks = []
    for (let i = 0; i < validUrls.length; i += concurrency) {
      chunks.push(validUrls.slice(i, i + concurrency))
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      
      console.log(`📦 Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} URLs)`)
      
      // Phase 2: Enhanced Scraping with Firecrawl
      try {
        const extractResult = await extractArticlesFromUrls(chunk, organization.name)
        
        if (extractResult.jobs && extractResult.jobs.length > 0) {
          console.log(`⏳ Polling ${extractResult.jobs.length} extraction jobs...`)
          
          const extractedArticles = await pollAllExtractJobs(extractResult.jobs)
          
          // Process each extracted article
          for (const article of extractedArticles) {
            const originalUrl = article.url
            const articleStartTime = Date.now()
            
            try {
              let sentimentScore: number | null = null
              let sentimentReasoning: string | null = null
              
              // Phase 2: Sentiment Analysis (if enabled)
              if (enableSentimentAnalysis && article.markdownContent) {
                try {
                  const sentimentResult = await analyzeSentimentScale(
                    article.markdownContent, 
                    organization.name
                  )
                  sentimentScore = sentimentResult.sentimentScore
                  sentimentReasoning = sentimentResult.reasoning
                  console.log(`📊 Sentiment for ${originalUrl}: ${sentimentScore}`)
                } catch (error) {
                  console.warn(`⚠️ Sentiment analysis failed for ${originalUrl}:`, error)
                }
              }

              let imageUrls: string[] = []
              let ogImage: string | null = null
              let formattedTitle = article.title

              // Phase 3: AI Enhancement (if enabled)
              if (enableImageExtraction || enableTitleFormatting) {
                
                // Extract and sort images
                if (enableImageExtraction) {
                  try {
                    const extractedImages = await extractImagesFromHtml(originalUrl)
                    const sortedImages = await sortImagesBySize(extractedImages)
                    imageUrls = sortedImages.slice(0, 10).map(img => img.url)
                    
                    // Select best image as OG image
                    const imageSelection = await selectBestImage(
                      sortedImages, 
                      article.title, 
                      article.summary || ''
                    )
                    ogImage = imageSelection?.selectedImageUrl || null
                    
                    console.log(`🖼️ Found ${imageUrls.length} images for ${originalUrl}`)
                  } catch (error) {
                    console.warn(`⚠️ Image extraction failed for ${originalUrl}:`, error)
                  }
                }

                // Format title with AI
                if (enableTitleFormatting && article.title) {
                  try {
                    const titleResult = await formatArticleTitle(article.title)
                    formattedTitle = titleResult.formattedTitle
                    console.log(`✏️ Title formatted for ${originalUrl}: "${formattedTitle}"`)
                  } catch (error) {
                    console.warn(`⚠️ Title formatting failed for ${originalUrl}:`, error)
                  }
                }
              }

              // Create enhanced Article record
              const newArticle = await prisma.article.create({
                data: {
                  organizationId: organizationId,
                  title: formattedTitle,
                  content: article.markdownContent || '',
                  summary: article.summary || '',
                  url: originalUrl,
                  keywords: article.keywords || [],
                  images: imageUrls,
                  ogImage: ogImage,
                  sentiment: sentimentScore !== null ? (
                    sentimentScore < 0 ? 'neg' : sentimentScore === 0 ? 'neu' : 'pos'
                  ) : null,
                  organizationSentiment: sentimentScore !== null ? (
                    sentimentScore === -1 ? 'Negative' :
                    sentimentScore === 0 ? 'Not Mentioned' :
                    sentimentScore === 1 ? 'Brief Mention' :
                    sentimentScore === 2 ? 'Main Focus' :
                    sentimentScore === 3 ? 'Social Impact' : 'Not Mentioned'
                  ) : null,
                  validationReasons: sentimentReasoning ? [sentimentReasoning] : [],
                  contentType: 'news',
                  status: 'draft',
                  publishedAt: null,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              })

              const processingTime = Date.now() - articleStartTime

              results.push({
                url: originalUrl,
                status: 'success',
                message: `Successfully created enhanced article: "${formattedTitle}"`,
                articleId: newArticle.id,
                title: formattedTitle,
                sentimentScore: sentimentScore,
                imageCount: imageUrls.length,
                ogImage: ogImage,
                processingTime: processingTime
              })

              console.log(`✅ Enhanced article created: ${formattedTitle} (${processingTime}ms)`)

            } catch (error) {
              console.error(`❌ Failed to process ${originalUrl}:`, error)
              results.push({
                url: originalUrl,
                status: 'error',
                message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              })
            }
          }
        } else {
          // Handle case where no jobs were created
          for (const url of chunk) {
            results.push({
              url,
              status: 'error',
              message: 'Failed to create extraction job'
            })
          }
        }
      } catch (error) {
        console.error(`❌ Chunk ${chunkIndex + 1} failed:`, error)
        
        // Mark all URLs in chunk as failed
        for (const url of chunk) {
          results.push({
            url,
            status: 'error', 
            message: `Batch extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      }

      // Add delay between chunks (except for last chunk)
      if (chunkIndex < chunks.length - 1 && batchDelay > 0) {
        console.log(`⏱️ Waiting ${batchDelay}ms before next chunk...`)
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }

    // Calculate summary
    const summary = {
      total: urls.length,
      success: results.filter(r => r.status === 'success').length,
      error: results.filter(r => r.status === 'error').length,
      duplicate: results.filter(r => r.status === 'duplicate').length,
      skipped: results.filter(r => r.status === 'skipped').length
    }

    const totalTime = Date.now() - startTime
    console.log(`🎯 Enhanced bulk scrape completed in ${totalTime}ms:`)
    console.log(`   ✅ Success: ${summary.success}`)
    console.log(`   ⚠️ Duplicates: ${summary.duplicate}`)
    console.log(`   ❌ Errors: ${summary.error}`)

    return NextResponse.json({
      success: true,
      results,
      summary,
      processingTime: totalTime,
      enhancementsUsed: {
        sentimentAnalysis: enableSentimentAnalysis,
        imageExtraction: enableImageExtraction,
        titleFormatting: enableTitleFormatting
      }
    })

  } catch (error) {
    console.error('Enhanced bulk scrape error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }, { status: 500 })
  }
}
