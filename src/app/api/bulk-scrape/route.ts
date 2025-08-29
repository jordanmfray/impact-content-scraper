import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runArticleScrapingPipeline } from '@/inngest/vercelAgentNetwork'
import { processWithRateLimit } from '@/utils/concurrency'

interface BulkScrapeRequest {
  organizationId: string
  urls: string[]
  concurrency?: number      // Number of parallel requests (default: 3)
  batchDelay?: number      // Delay between batches in ms (default: 2000)
}

interface ScrapeResult {
  url: string
  status: 'success' | 'error' | 'duplicate'
  message?: string
  articleId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkScrapeRequest = await request.json()
    const { organizationId, urls, concurrency = 3, batchDelay = 2000 } = body

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

    // Clean and validate URLs first
    const validUrls: string[] = []
    const invalidResults: ScrapeResult[] = []

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
        validUrls.push(cleanUrl)
      } catch {
        invalidResults.push({
          url: cleanUrl,
          status: 'error',
          message: 'Invalid URL format'
        })
      }
    }

    console.log(`🚀 Starting parallel scraping of ${validUrls.length} URLs with concurrency: ${concurrency}`)
    console.log(`⏱️ Batch delay: ${batchDelay}ms between chunks`)

    // Process URLs in parallel with rate limiting
    const { results: successfulResults, errors } = await processWithRateLimit(
      validUrls,
      async (url: string) => {
        console.log(`🔄 Processing: ${url}`)
        
        const pipelineResult = await runArticleScrapingPipeline(url, organizationId)
        
        if (pipelineResult.success) {
          if (pipelineResult.duplicate) {
            console.log(`⚠️ Article already exists: "${pipelineResult.title}"`)
            return {
              url,
              status: 'duplicate' as const,
              message: `Article already exists: "${pipelineResult.title}"`,
              articleId: pipelineResult.articleId
            }
          } else {
            console.log(`✅ Successfully scraped: "${pipelineResult.title}"`)
            return {
              url,
              status: 'success' as const,
              message: `Successfully scraped: "${pipelineResult.title}"`,
              articleId: pipelineResult.articleId
            }
          }
        } else {
          throw new Error('Pipeline returned unsuccessful result')
        }
      },
      {
        concurrency,
        batchDelay,
        onProgress: (completed, total, currentUrl) => {
          if (currentUrl) {
            console.log(`📊 Progress: ${completed}/${total} - Processing: ${currentUrl}`)
          } else {
            console.log(`📊 Progress: ${completed}/${total} completed`)
          }
        }
      }
    )

    // Convert errors to results format
    const errorResults: ScrapeResult[] = errors.map(({ item: url, error }) => ({
      url,
      status: 'error',
      message: error.message || 'Unknown error occurred'
    }))

    const allResults = [...invalidResults, ...successfulResults, ...errorResults]

    // Summary stats
    const summary = {
      total: allResults.length,
      success: allResults.filter(r => r.status === 'success').length,
      duplicate: allResults.filter(r => r.status === 'duplicate').length,
      error: allResults.filter(r => r.status === 'error').length,
      concurrency_used: concurrency,
      batch_delay_used: batchDelay
    }

    console.log(`🎯 Bulk scraping completed:`, summary)

    return NextResponse.json({
      success: true,
      results: allResults,
      summary
    })

  } catch (error) {
    console.error('Bulk scraping error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run bulk scraping',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST to submit bulk scraping requests.'
  }, { status: 405 })
}
