import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requireNewsUrl = searchParams.get('requireNewsUrl') === 'true'
    const includeArticleCounts = searchParams.get('includeArticleCounts') === 'true'

    let whereClause = {}
    if (requireNewsUrl) {
      whereClause = {
        newsUrl: {
          not: null
        }
      }
    }

    const organizations = await prisma.organization.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        newsUrl: true,
        ...(includeArticleCounts && {
          _count: {
            select: {
              articles: {
                where: {
                  status: 'published'
                }
              }
            }
          }
        })
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Transform the data to include publishedArticleCount if requested
    const transformedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      newsUrl: org.newsUrl,
      ...(includeArticleCounts && {
        publishedArticleCount: org._count?.articles || 0
      })
    }))

    return NextResponse.json({
      success: true,
      organizations: transformedOrganizations
    })

  } catch (error) {
    console.error('Organizations API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch organizations'
      },
      { status: 500 }
    )
  }
}
