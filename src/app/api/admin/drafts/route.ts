import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const drafts = await prisma.article.findMany({
      where: {
        status: 'draft'
      },
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
      take: limit
    })

    // Transform drafts for frontend
    const transformedDrafts = drafts.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt,
      ogImage: article.ogImage,
      images: article.images, // Array of all discovered images
      sentiment: article.sentiment,
      keywords: article.keywords,
      createdAt: article.createdAt,
      status: article.status,
      organization: {
        id: article.organization.id,
        name: article.organization.name,
        logo: article.organization.logo,
      }
    }))

    return NextResponse.json({
      success: true,
      drafts: transformedDrafts,
      total: transformedDrafts.length
    })

  } catch (error) {
    console.error('Admin drafts API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch draft articles'
      },
      { status: 500 }
    )
  }
}

// Update draft article (publish, change image, edit content, etc.)
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
        status: updatedArticle.status,
        organization: {
          id: updatedArticle.organization.id,
          name: updatedArticle.organization.name,
          logo: updatedArticle.organization.logo,
        }
      }
    })

  } catch (error) {
    console.error('Admin drafts update API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update draft article'
      },
      { status: 500 }
    )
  }
}
