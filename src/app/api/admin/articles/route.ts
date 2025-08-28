import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // 'all', 'draft', 'published', 'failed', 'processing'
    
    const skip = (page - 1) * limit

    // Build where clause based on status filter
    const whereClause: any = {}
    if (status && status !== 'all') {
      whereClause.status = status
    }

    // Get total count for pagination
    const totalCount = await prisma.article.count({
      where: whereClause
    })

    // Get articles with pagination
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
      orderBy: {
        publishedAt: 'desc'
      },
      skip,
      take: limit
    })

    // Transform articles for frontend
    const transformedArticles = articles.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt,
      ogImage: article.ogImage,
      images: article.images,
      sentiment: article.sentiment,
      keywords: article.keywords,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      status: article.status,
      organization: {
        id: article.organization.id,
        name: article.organization.name,
        logo: article.organization.logo,
      }
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      articles: transformedArticles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Admin articles API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles'
      },
      { status: 500 }
    )
  }
}

// Update article (publish, change status, edit content, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Article ID is required' },
        { status: 400 }
      )
    }

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      article: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        summary: updatedArticle.summary,
        content: updatedArticle.content,
        url: updatedArticle.url,
        author: updatedArticle.author,
        publishedAt: updatedArticle.publishedAt,
        ogImage: updatedArticle.ogImage,
        images: updatedArticle.images,
        sentiment: updatedArticle.sentiment,
        keywords: updatedArticle.keywords,
        createdAt: updatedArticle.createdAt,
        updatedAt: updatedArticle.updatedAt,
        status: updatedArticle.status,
        organization: {
          id: updatedArticle.organization.id,
          name: updatedArticle.organization.name,
          logo: updatedArticle.organization.logo,
        }
      }
    })

  } catch (error) {
    console.error('Admin articles update API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update article'
      },
      { status: 500 }
    )
  }
}

// Delete article
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Article ID is required' },
        { status: 400 }
      )
    }

    await prisma.article.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Article deleted successfully'
    })

  } catch (error) {
    console.error('Admin articles delete API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete article'
      },
      { status: 500 }
    )
  }
}
