import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Get all organizations (admin view with full details)
export async function GET(request: NextRequest) {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      organizations
    })

  } catch (error) {
    console.error('Admin organizations GET API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch organizations'
      },
      { status: 500 }
    )
  }
}

// Create new organization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, website, newsUrl, tags, ein } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Organization name is required' },
        { status: 400 }
      )
    }

    // Validate URLs if provided
    if (website) {
      try {
        new URL(website)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid website URL format' },
          { status: 400 }
        )
      }
    }

    if (newsUrl) {
      try {
        new URL(newsUrl)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid news URL format' },
          { status: 400 }
        )
      }
    }


    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        website: website?.trim() || null,
        newsUrl: newsUrl?.trim() || null,
        tags: tags || [],
        ein: ein?.trim() || null
      }
    })

    return NextResponse.json({
      success: true,
      organization,
      message: 'Organization created successfully'
    })

  } catch (error) {
    console.error('Admin organizations POST API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create organization'
      },
      { status: 500 }
    )
  }
}
