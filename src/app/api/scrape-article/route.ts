import { NextRequest, NextResponse } from 'next/server'
import { runArticleScrapingPipeline } from '@/inngest/vercelAgentNetwork'

export async function POST(request: NextRequest) {
  try {
    const { url, organizationId } = await request.json()

    if (!url || !organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL and organization ID are required'
        },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format'
        },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting article scraping for URL: ${url}`)
    
    // Run the article scraping pipeline
    const result = await runArticleScrapingPipeline(url, organizationId)

    return NextResponse.json({
      success: true,
      message: 'Article scraping completed successfully',
      result: {
        articleId: result.articleId,
        title: result.title,
        summary: result.summary,
        keywords: result.keywords,
        sentiment: result.sentiment,
        aiRunId: result.aiRunId,
        duplicate: result.duplicate || false
      }
    })

  } catch (error) {
    console.error('Article scraping API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to scrape article',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
