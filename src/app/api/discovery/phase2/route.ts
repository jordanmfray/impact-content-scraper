import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractArticlesFromUrls, getExtractJobStatus } from '@/lib/firecrawlExtract'
import { analyzeSentimentScale } from '@/ai-functions/analyzeSentimentScale'

// No longer needed - batch processing eliminates rate limiting issues!

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
    
    console.log(`🚀 Starting Phase 2: Batch extracting ${selectedUrls.length} URLs for ${session.organization.name}`)
    
    // Extract just the URL strings for batch processing
    const urls = selectedUrls.map(u => u.url)
    
    // Use Firecrawl Extract for batch processing
    const extractResult = await extractArticlesFromUrls(urls, session.organization.name)
    
    if (!extractResult.success) {
      console.error(`❌ Batch extraction failed: ${extractResult.error}`)
      
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
        error: `Batch extraction failed: ${extractResult.error}`
      }, { status: 500 })
    }
    
    // Handle job-based response (async processing)
    if (extractResult.jobId) {
      console.log(`⏳ Extract job started: ${extractResult.jobId}`)
      console.log(`🔄 Polling for job completion...`)
      
      // Simple polling mechanism - check job status every 2 seconds for up to 2 minutes
      const maxAttempts = 60 // 2 minutes
      const pollInterval = 2000 // 2 seconds
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
        console.log(`📊 Checking job status (attempt ${attempt}/${maxAttempts})...`)
        const jobStatus = await getExtractJobStatus(extractResult.jobId)
        
        if (jobStatus.success && jobStatus.data && jobStatus.data.length > 0) {
          console.log(`✅ Job completed! Got ${jobStatus.data.length} articles`)
          
          // Process the completed job results
          extractResult.data = jobStatus.data
          break
        } else if (!jobStatus.success && jobStatus.error?.includes('failed')) {
          console.error(`❌ Job failed: ${jobStatus.error}`)
          
          await prisma.discoverySession.update({
            where: { id: sessionId },
            data: {
              status: 'completed',
              updatedAt: new Date()
            }
          })
          
          return NextResponse.json({
            success: false,
            error: `Extract job failed: ${jobStatus.error}`
          }, { status: 500 })
        }
        
        // Still processing, continue polling
        console.log(`⏳ Job still processing... waiting ${pollInterval/1000}s`)
      }
      
      // If we exhausted all attempts and still no data
      if (!extractResult.data || extractResult.data.length === 0) {
        console.error(`⏰ Job polling timed out after ${maxAttempts * pollInterval / 1000}s`)
        
        await prisma.discoverySession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            updatedAt: new Date()
          }
        })
        
        return NextResponse.json({
          success: false,
          error: 'Extract job timed out - took longer than 2 minutes'
        }, { status: 500 })
      }
    }
    
    // Handle immediate results
    if (!extractResult.data || extractResult.data.length === 0) {
      console.log(`⚠️ No articles extracted from ${urls.length} URLs`)
      
      // Update session status
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
        message: 'No articles could be extracted from the provided URLs'
      })
    }
    
    console.log(`✅ Batch extraction successful: ${extractResult.data.length} articles extracted`)
    
    let processedCount = 0
    let successCount = 0
    
    // Process each extracted article
    for (const article of extractResult.data) {
      try {
        // Find the corresponding discovered URL
        const discoveredUrl = selectedUrls.find(u => u.url === article.url)
        
        if (!discoveredUrl) {
          console.warn(`⚠️ Could not find discovered URL for: ${article.url}`)
          continue
        }
        
        // Analyze sentiment using our enhanced scale
        console.log(`🧠 Analyzing sentiment for: ${article.title.substring(0, 50)}...`)
        const sentimentResult = await analyzeSentimentScale(
          article.content, 
          session.organization.name,
          article.title
        )
        
        console.log(`📊 Sentiment: ${sentimentResult.sentimentScore} - ${sentimentResult.reasoning.substring(0, 60)}...`)
        
        // Save scraped content to database
        await prisma.scrapedContent.create({
          data: {
            discoveredUrlId: discoveredUrl.id,
            discoverySessionId: sessionId,
            title: article.title,
            summary: article.summary,
            markdownContent: article.content,
            keywords: article.keywords || [],
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
        const discoveredUrl = selectedUrls.find(u => u.url === article.url)
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
    const failedUrls = selectedUrls.filter(u => 
      !extractResult.data!.some(article => article.url === u.url)
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
      extractedArticles: extractResult.data.length
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
