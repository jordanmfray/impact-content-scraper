import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Update organization
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
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


    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id }
    })

    if (!existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const organization = await prisma.organization.update({
      where: { id },
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
      message: 'Organization updated successfully'
    })

  } catch (error) {
    console.error('Admin organizations PUT API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update organization'
      },
      { status: 500 }
    )
  }
}

// Delete organization
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        articles: true,
        aiRuns: true,
        urlDiscoveryBatches: true
      }
    })

    if (!existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if organization has related data
    const hasArticles = existingOrg.articles.length > 0
    const hasAiRuns = existingOrg.aiRuns.length > 0
    const hasDiscoveryBatches = existingOrg.urlDiscoveryBatches.length > 0

    if (hasArticles || hasAiRuns || hasDiscoveryBatches) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete organization with existing articles, AI runs, or discovery batches. Please remove related data first.' 
        },
        { status: 400 }
      )
    }

    await prisma.organization.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully'
    })

  } catch (error) {
    console.error('Admin organizations DELETE API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete organization'
      },
      { status: 500 }
    )
  }
}
