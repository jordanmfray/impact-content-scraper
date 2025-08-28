import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runArticleScrapingPipeline } from '@/inngest/vercelAgentNetwork'

interface BulkScrapeRequest {
  organizationId: string
  urls: string[]
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
    const { organizationId, urls } = body

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

    const results: ScrapeResult[] = []

    // Process each URL
    for (const url of urls) {
      try {
        // Clean up the URL
        const cleanUrl = url.trim()
        if (!cleanUrl) {
          results.push({
            url,
            status: 'error',
            message: 'Empty URL'
          })
          continue
        }

        // Validate URL format
        try {
          new URL(cleanUrl)
        } catch {
          results.push({
            url: cleanUrl,
            status: 'error',
            message: 'Invalid URL format'
          })
          continue
        }

        // Run the scraping pipeline directly (it handles duplicates internally)
        console.log(`Starting scraping for ${cleanUrl}...`)
        
        try {
          const pipelineResult = await runArticleScrapingPipeline(cleanUrl, organizationId)
          
          if (pipelineResult.success) {
            if (pipelineResult.duplicate) {
              console.log(`⚠️ Article already exists: "${pipelineResult.title}"`)
              results.push({
                url: cleanUrl,
                status: 'duplicate',
                message: `Article already exists: "${pipelineResult.title}"`,
                articleId: pipelineResult.articleId
              })
            } else {
              console.log(`✅ Successfully scraped: "${pipelineResult.title}"`)
              results.push({
                url: cleanUrl,
                status: 'success',
                message: `Successfully scraped: "${pipelineResult.title}"`,
                articleId: pipelineResult.articleId
              })
            }
          } else {
            console.log(`❌ Scraping failed for ${cleanUrl}`)
            results.push({
              url: cleanUrl,
              status: 'error',
              message: `Scraping failed: Unknown error`
            })
          }
        } catch (pipelineError) {
          console.error(`❌ Pipeline error for ${cleanUrl}:`, pipelineError)
          results.push({
            url: cleanUrl,
            status: 'error',
            message: `Pipeline error: ${pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error'}`
          })
        }

      } catch (error) {
        console.error(`Error processing URL ${url}:`, error)
        results.push({
          url,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }

    // Summary stats
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      errors: results.filter(r => r.status === 'error').length
    }

    console.log(`Bulk scrape completed for ${organization.name}:`, summary)

    return NextResponse.json({
      success: true,
      results,
      summary,
      organization: {
        id: organization.id,
        name: organization.name
      }
    })

  } catch (error) {
    console.error('Bulk scrape API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST to submit bulk scraping requests.'
  }, { status: 405 })
}
