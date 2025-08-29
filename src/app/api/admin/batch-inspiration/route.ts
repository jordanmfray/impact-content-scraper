import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeInspiration } from '@/ai-functions/analyzeInspiration'

export async function POST(request: NextRequest) {
  try {
    const { dryRun = false, organizationId } = await request.json()

    // Build filters
    const whereClause: any = {
      inspirationRating: null, // Only articles missing inspiration rating
      status: 'published' // Only analyze published articles
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    }

    if (dryRun) {
      // Just return count of articles that would be processed
      const count = await prisma.article.count({ where: whereClause })
      return NextResponse.json({
        success: true,
        dryRun: true,
        articlesFound: count,
        message: `Found ${count} published articles missing inspiration ratings`
      })
    }

    // Get articles to process
    const articles = await prisma.article.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        organizationId: true
      },
      take: 20 // Process in batches of 20 to avoid timeouts
    })

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No articles found that need inspiration rating'
      })
    }

    const results = []
    let processed = 0

    // Process each article
    for (const article of articles) {
      try {
        console.log(`Analyzing inspiration for: "${article.title}"`)
        
        const inspiration = await analyzeInspiration({
          title: article.title,
          summary: article.summary || '',
          content: article.content || ''
        })

        // Update the article
        await prisma.article.update({
          where: { id: article.id },
          data: { inspirationRating: inspiration.rating }
        })

        results.push({
          articleId: article.id,
          title: article.title,
          rating: inspiration.rating,
          reasoning: inspiration.reasoning
        })

        processed++
        console.log(`✅ Updated ${article.title}: ${inspiration.rating}`)

      } catch (error) {
        console.error(`Failed to process article ${article.id}:`, error)
        results.push({
          articleId: article.id,
          title: article.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      total: articles.length,
      results,
      message: `Successfully processed ${processed} articles`
    })

  } catch (error) {
    console.error('Batch inspiration analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run batch inspiration analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
