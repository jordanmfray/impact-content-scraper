import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const organizationId = searchParams.get('organizationId')
    const sentiment = searchParams.get('sentiment')

    const whereClause: any = {
      status: 'published'
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    }

    if (sentiment) {
      whereClause.sentiment = sentiment
    }

    const articles = await prisma.article.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          }
        }
      },
      orderBy: [
        {
          featured: 'desc'
        },
        {
          publishedAt: 'desc'
        },
        {
          createdAt: 'desc'
        }
      ],
      take: limit
    })

    // Transform articles for frontend
    const transformedArticles = articles.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content, // Include markdown content for preview
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt,
      ogImage: article.ogImage,
      sentiment: article.sentiment,
      keywords: article.keywords,
      createdAt: article.createdAt,
      featured: article.featured,
      inspirationRating: article.inspirationRating,
      organization: {
        id: article.organization.id,
        name: article.organization.name,
        logo: article.organization.logo,
      }
    }))

    return NextResponse.json({
      success: true,
      articles: transformedArticles,
      total: transformedArticles.length
    })

  } catch (error) {
    console.error('Articles API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles'
      },
      { status: 500 }
    )
  }
}
