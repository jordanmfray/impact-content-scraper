import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { firecrawlExtractStructured } from '@/lib/firecrawl'
import { analyzeSentimentScale } from '@/ai-functions/analyzeSentimentScale'

// Rate limiting for Firecrawl (15 requests per minute)
const FIRECRAWL_RATE_LIMIT_MS = 60000 / 15 // 4 seconds between requests

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

// Start scraping selected URLs
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 })
    }
    
    // Get session with selected URLs
    const session = await prisma.discoverySession.findUnique({
      where: { id: sessionId },
      include: {
        organization: { select: { id: true, name: true } },
        discoveredUrls: {
          where: { selectedForScraping: true },
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
    
    const selectedUrls = session.discoveredUrls
    
    if (selectedUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No URLs selected for scraping'
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
    
    console.log(`🚀 Starting Phase 2: Scraping ${selectedUrls.length} URLs for ${session.organization.name}`)
    
    let scrapedCount = 0
    let failedCount = 0
    
    // Process URLs with rate limiting
    for (const discoveredUrl of selectedUrls) {
      try {
        console.log(`📄 Scraping ${discoveredUrl.url}...`)
        
        // Update scrape status
        await prisma.discoveredUrl.update({
          where: { id: discoveredUrl.id },
          data: { scrapeStatus: 'scraping' }
        })
        
        // Scrape with Firecrawl (with fallback)
        console.log(`🔥 Attempting Firecrawl extraction for ${discoveredUrl.url}`)
        let scrapeResult = await firecrawlExtractStructured(discoveredUrl.url, session.organization.name)
        
        if (!scrapeResult.success || !scrapeResult.title || !scrapeResult.content) {
          console.log(`❌ Firecrawl failed: ${scrapeResult.error || 'Unknown error'}`)
          console.log(`🔄 Falling back to simple HTTP extraction...`)
          
          // Fallback to simple HTTP extraction
          try {
            const response = await fetch(discoveredUrl.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)' }
            })
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            
            const html = await response.text()
            console.log(`📄 Fetched ${html.length} characters via HTTP`)
            
            // Simple extraction from HTML
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
            const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
            
            const title = ogTitleMatch?.[1] || titleMatch?.[1] || h1Match?.[1] || 'Article'
            
            // Extract some content for analysis (just get text between paragraphs)
            const paragraphs = [...html.matchAll(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*?)<\/p>/gi)]
            const content = paragraphs.slice(0, 5).map(p => p[1].replace(/<[^>]*>/g, '')).join('\n\n')
            
            scrapeResult = {
              success: true,
              title: title.trim(),
              content: content || 'Content extracted via fallback method',
              summary: content.substring(0, 200) + '...',
              keywords: [],
              ogImage: null,
              images: [],
              data: {
                title: title.trim(),
                content: content || 'Content extracted via fallback method',
                summary: content.substring(0, 200) + '...',
                keywords: [],
                body_markdown: content || 'Content extracted via fallback method'
              },
              metadata: {}
            }
            
            console.log(`✅ Fallback extraction successful: ${title.substring(0, 60)}...`)
            
          } catch (fallbackError) {
            console.error(`❌ Fallback extraction also failed:`, fallbackError)
            throw new Error(`Both Firecrawl and fallback extraction failed: ${fallbackError}`)
          }
        }
        
        console.log(`✅ Scraped: ${scrapeResult.title.substring(0, 60)}...`)
        
        // Analyze sentiment
        console.log(`🧠 Analyzing sentiment...`)
        const sentimentResult = await analyzeSentimentScale(
          scrapeResult.content, 
          session.organization.name,
          scrapeResult.title
        )
        
        console.log(`📊 Sentiment: ${sentimentResult.sentimentScore} - ${sentimentResult.reasoning.substring(0, 60)}...`)
        
        // Save scraped content
        await prisma.scrapedContent.create({
          data: {
            discoveredUrlId: discoveredUrl.id,
            discoverySessionId: sessionId,
            title: scrapeResult.title,
            summary: scrapeResult.summary,
            markdownContent: scrapeResult.content,
            keywords: scrapeResult.keywords || [],
            sentimentScore: sentimentResult.sentimentScore,
            sentimentReasoning: sentimentResult.reasoning
          }
        })
        
        // Update URL status
        await prisma.discoveredUrl.update({
          where: { id: discoveredUrl.id },
          data: { scrapeStatus: 'scraped' }
        })
        
        scrapedCount++
        
        // Rate limiting delay
        if (scrapedCount < selectedUrls.length) {
          console.log(`⏳ Rate limiting delay...`)
          await delay(FIRECRAWL_RATE_LIMIT_MS)
        }
        
      } catch (error) {
        console.error(`❌ Failed to scrape ${discoveredUrl.url}:`, error)
        
        // Update URL status to failed
        await prisma.discoveredUrl.update({
          where: { id: discoveredUrl.id },
          data: { scrapeStatus: 'failed' }
        })
        
        failedCount++
      }
      
      // Update session progress
      await prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          processedUrls: scrapedCount + failedCount,
          updatedAt: new Date()
        }
      })
    }
    
    // Update final session status
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: {
        status: 'analyzing',
        processedUrls: scrapedCount + failedCount,
        updatedAt: new Date()
      }
    })
    
    console.log(`🎯 Phase 2 complete: ${scrapedCount} scraped, ${failedCount} failed`)
    
    return NextResponse.json({
      success: true,
      scrapedCount,
      failedCount,
      totalProcessed: scrapedCount + failedCount
    })
    
  } catch (error) {
    console.error('Phase 2 POST error:', error)
    
    // Update session status to failed
    if (request.json) {
      const { sessionId } = await request.json()
      if (sessionId) {
        await prisma.discoverySession.update({
          where: { id: sessionId },
          data: { 
            status: 'completed', // Mark as completed even if failed
            updatedAt: new Date()
          }
        }).catch(console.error)
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Scraping failed',
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
