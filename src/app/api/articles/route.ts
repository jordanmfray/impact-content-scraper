import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const organizationId = searchParams.get('organizationId')
    const sentiment = searchParams.get('sentiment')
    const search = searchParams.get('search')

    // Calculate skip for pagination
    const skip = (page - 1) * limit

    const whereClause: any = {
      status: 'published'
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    }

    if (sentiment) {
      whereClause.sentiment = sentiment
    }

    if (search) {
      whereClause.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          summary: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          organization: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    // Get total count for pagination
    const totalCount = await prisma.article.count({
      where: whereClause
    })

    // Get paginated articles
    const articles = await prisma.article.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
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
      skip: skip,
      take: limit
    })

    // Transform articles for frontend (minimal fields only for performance)
    const transformedArticles = articles.map((article: any) => ({
      id: article.id,
      title: article.title,
      url: article.url,
      organization: {
        id: article.organization.id,
        name: article.organization.name,
      }
    }))

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return NextResponse.json({
      success: true,
      articles: transformedArticles,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
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
