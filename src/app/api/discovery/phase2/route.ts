import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractArticlesFromUrls, pollAllExtractJobs } from '@/lib/firecrawlExtractIndividual'
import { analyzeSentimentScale } from '@/ai-functions/analyzeSentimentScale'

/**
 * Helper function to parse various date formats from article extraction
 */
function parseArticleDate(dateString?: string): Date | null {
  if (!dateString) return null
  
  try {
    // Handle common date formats
    const date = new Date(dateString)
    
    // Check if the date is valid and not in the future (more than a day)
    if (isNaN(date.getTime()) || date > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      console.warn(`⚠️ Invalid or future date detected: ${dateString}, using null`)
      return null
    }
    
    console.log(`📅 Parsed article date: ${dateString} → ${date.toISOString()}`)
    return date
  } catch (error) {
    console.warn(`⚠️ Failed to parse article date: ${dateString}`, error)
    return null
  }
}

// Update URL selection for scraping
export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, selectedUrls } = await request.json()
    
    if (!sessionId || !Array.isArray(selectedUrls)) {
      return NextResponse.json({
        success: false,
        error: 'sessionId and selectedUrls array are required'
      }, { status: 400 })
    }
    
    // Update selected URLs in database
    await prisma.discoveredUrl.updateMany({
      where: {
        discoverySessionId: sessionId
      },
      data: {
        selectedForScraping: false
      }
    })
    
    // Set selected URLs to true
    if (selectedUrls.length > 0) {
      await prisma.discoveredUrl.updateMany({
        where: {
          discoverySessionId: sessionId,
          id: { in: selectedUrls }
        },
        data: {
          selectedForScraping: true
        }
      })
    }
    
    // Update session with selected count
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: {
        selectedUrls: selectedUrls.length,
        status: selectedUrls.length > 0 ? 'reviewed' : 'ready_for_review',
        updatedAt: new Date()
      }
    })
    
    return NextResponse.json({
      success: true,
      selectedCount: selectedUrls.length
    })
    
  } catch (error) {
    console.error('Phase 2 PATCH error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update URL selections'
    }, { status: 500 })
  }
}

// Start batch extraction of selected URLs using Firecrawl Extract
export async function POST(request: NextRequest) {
  try {
    const { sessionId, selectAll } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 })
    }
    
    // Get session with URLs (either selected or all, depending on selectAll flag)
    const session = await prisma.discoverySession.findUnique({
      where: { id: sessionId },
      include: {
        organization: { select: { id: true, name: true } },
        discoveredUrls: {
          where: selectAll ? {} : { selectedForScraping: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }
    
    let selectedUrls = session.discoveredUrls
    
    // If selectAll is true, auto-select all URLs for scraping
    if (selectAll && selectedUrls.length > 0) {
      console.log(`🚀 Auto-selecting ${selectedUrls.length} URLs for automated pipeline`)
      await prisma.discoveredUrl.updateMany({
        where: { 
          discoverySessionId: sessionId,
          id: { in: selectedUrls.map(url => url.id) }
        },
        data: { selectedForScraping: true }
      })
    }
    
    if (selectedUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: selectAll ? 'No URLs discovered to scrape' : 'No URLs selected for scraping'
      }, { status: 400 })
    }
    
    // Update session status
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: {
        status: 'scraping',
        updatedAt: new Date()
      }
    })
    
    console.log(`🚀 Starting Phase 2: Batch extracting ${selectedUrls.length} URLs for ${session.organization.name}`)
    
    // Extract just the URL strings for batch processing
    const urls = selectedUrls.map((u: any) => u.url)
    console.log(`📤 Sending URLs to Firecrawl:`, urls.map((url: string, i: number) => `${i}: ${url}`).join('\n'))
    
    // Use Firecrawl Extract for individual URL processing  
    const extractResult = await extractArticlesFromUrls(urls, session.organization.name)
    
    if (!extractResult.success) {
      console.error(`❌ Individual extraction failed: ${extractResult.error}`)
      
      // Update session status to failed
      await prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: false,
        error: `Individual extraction failed: ${extractResult.error}`
      }, { status: 500 })
    }
    
    if (!extractResult.jobs || extractResult.jobs.length === 0) {
      console.log(`⚠️ No extraction jobs were submitted for ${urls.length} URLs`)
      
      await prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          status: 'analyzing',
          processedUrls: urls.length,
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: true,
        scrapedCount: 0,
        failedCount: urls.length,
        totalProcessed: urls.length,
        message: 'No extraction jobs were successfully submitted'
      })
    }
    
    console.log(`✅ Submitted ${extractResult.jobs.length}/${urls.length} extraction jobs`)
    console.log(`🔄 Polling ${extractResult.jobs.length} jobs for completion...`)
    
    // Poll all jobs concurrently
    const pollResult = await pollAllExtractJobs(extractResult.jobs)
    
    if (!pollResult.success || pollResult.data.length === 0) {
      console.log(`⚠️ No articles extracted from ${extractResult.jobs.length} jobs`)
      console.log(`❌ Errors:`, pollResult.errors)
      
      await prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          status: 'analyzing',
          processedUrls: urls.length,
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: true,
        scrapedCount: 0,
        failedCount: extractResult.jobs.length,
        totalProcessed: extractResult.jobs.length,
        message: 'No articles were successfully extracted from jobs',
        errors: pollResult.errors
      })
    }
    
    console.log(`✅ Individual extraction successful: ${pollResult.data.length} articles extracted from ${extractResult.jobs.length} jobs`)
    
    let processedCount = 0
    let successCount = 0
    
    // Track processed URLs to prevent duplicates
    const processedUrlIds = new Set<string>()
    
    // Process each extracted article
    for (const article of pollResult.data) {
      try {
        // Find the corresponding discovered URL
        const discoveredUrl = selectedUrls.find((u: any) => u.url === article.url)
        
        if (!discoveredUrl) {
          console.warn(`⚠️ Could not find discovered URL for: ${article.url}`)
          continue
        }
        
        // Check if we've already processed this URL (prevent duplicates)
        if (processedUrlIds.has(discoveredUrl.id)) {
          console.warn(`⚠️ Skipping duplicate processing for URL: ${article.url}`)
          continue
        }
        
        // Check if ScrapedContent already exists for this URL
        const existingContent = await prisma.scrapedContent.findUnique({
          where: { discoveredUrlId: discoveredUrl.id }
        })
        
        if (existingContent) {
          console.log(`📋 ScrapedContent already exists for URL: ${article.url} - updating instead`)
          // Update existing record
          await prisma.scrapedContent.update({
            where: { discoveredUrlId: discoveredUrl.id },
            data: {
              title: article.title,
              summary: article.summary,
              markdownContent: article.content,
              keywords: article.keywords || [],
              author: article.author || null,
              publishedAt: parseArticleDate(article.publish_date),
              sentimentScore: null, // Will be updated after sentiment analysis
              sentimentReasoning: null
            }
          })
        } else {
          // Create new record
          await prisma.scrapedContent.create({
            data: {
              discoveredUrlId: discoveredUrl.id,
              discoverySessionId: sessionId,
              title: article.title,
              summary: article.summary,
              markdownContent: article.content,
              keywords: article.keywords || [],
              author: article.author || null,
              publishedAt: parseArticleDate(article.publish_date),
              sentimentScore: null, // Will be updated after sentiment analysis
              sentimentReasoning: null
            }
          })
        }
        
        // Mark this URL as processed
        processedUrlIds.add(discoveredUrl.id)
        
        // Analyze sentiment using our enhanced scale
        console.log(`🧠 Analyzing sentiment for: ${article.title?.substring(0, 50) || 'No title'}...`)
        const sentimentResult = await analyzeSentimentScale(
          article.content, 
          session.organization.name,
          article.title
        )
        
        console.log(`📊 Sentiment: ${sentimentResult.sentimentScore} - ${sentimentResult.reasoning.substring(0, 60)}...`)
        
        // Update with sentiment analysis results
        await prisma.scrapedContent.update({
          where: { discoveredUrlId: discoveredUrl.id },
          data: {
            sentimentScore: sentimentResult.sentimentScore,
            sentimentReasoning: sentimentResult.reasoning
          }
        })
        
        // Update URL status to scraped
        await prisma.discoveredUrl.update({
          where: { id: discoveredUrl.id },
          data: { scrapeStatus: 'scraped' }
        })
        
        successCount++
        
      } catch (error) {
        console.error(`❌ Failed to process article: ${article.title}`, error)
        
        // Find and update the URL status
        const discoveredUrl = selectedUrls.find((u: any) => u.url === article.url)
        if (discoveredUrl) {
          await prisma.discoveredUrl.update({
            where: { id: discoveredUrl.id },
            data: { scrapeStatus: 'failed' }
          }).catch(console.error)
        }
      }
      
      processedCount++
    }
    
    // Mark any unprocessed URLs as failed
    const failedUrls = selectedUrls.filter((u: any) => 
      !pollResult.data.some(article => article.url === u.url)
    )
    
    for (const failedUrl of failedUrls) {
      await prisma.discoveredUrl.update({
        where: { id: failedUrl.id },
        data: { scrapeStatus: 'failed' }
      }).catch(console.error)
    }
    
    const failedCount = failedUrls.length + (processedCount - successCount)
    
    // Update final session status
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: {
        status: 'analyzing',
        processedUrls: selectedUrls.length,
        updatedAt: new Date()
      }
    })
    
    console.log(`🎯 Phase 2 complete: ${successCount} extracted successfully, ${failedCount} failed`)
    
    return NextResponse.json({
      success: true,
      scrapedCount: successCount,
      failedCount: failedCount,
      totalProcessed: selectedUrls.length,
      extractedArticles: pollResult.data.length
    })
    
  } catch (error) {
    console.error('Phase 2 POST error:', error)
    
    // Update session status to failed
    try {
      const { sessionId } = await request.json()
      if (sessionId) {
        await prisma.discoverySession.update({
          where: { id: sessionId },
          data: { 
            status: 'completed',
            updatedAt: new Date()
          }
        }).catch(console.error)
      }
    } catch {
      // Ignore errors in error handling
    }
    
    return NextResponse.json({
      success: false,
      error: 'Batch extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get scraped content for review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId parameter required'
      }, { status: 400 })
    }
    
    // Get session with scraped content
    const session = await prisma.discoverySession.findUnique({
      where: { id: sessionId },
      include: {
        organization: { select: { id: true, name: true } },
        scrapedContent: {
          include: {
            discoveredUrl: { select: { url: true, urlType: true, domain: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        organizationName: session.organization.name,
        status: session.status,
        totalUrls: session.totalUrls,
        selectedUrls: session.selectedUrls,
        processedUrls: session.processedUrls
      },
      scrapedContent: session.scrapedContent.map(content => ({
        id: content.id,
        title: content.title,
        summary: content.summary,
        url: content.discoveredUrl.url,
        urlType: content.discoveredUrl.urlType,
        domain: content.discoveredUrl.domain,
        sentimentScore: content.sentimentScore,
        sentimentReasoning: content.sentimentReasoning,
        keywords: content.keywords,
        selectedForFinalization: content.selectedForFinalization,
        createdAt: content.createdAt
      }))
    })
    
  } catch (error) {
    console.error('Phase 2 GET error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch scraped content'
    }, { status: 500 })
  }
}
