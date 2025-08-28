import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const run = await prisma.aiRun.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          }
        },
        article: {
          select: {
            id: true,
            title: true,
            url: true,
            summary: true,
            keywords: true,
            sentiment: true,
          }
        }
      }
    })

    if (!run) {
      return NextResponse.json(
        { success: false, error: 'AI run not found' },
        { status: 404 }
      )
    }

    // Calculate duration if completed
    const duration = run.completedAt && run.startedAt 
      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
      : null

    return NextResponse.json({
      success: true,
      run: {
        ...run,
        duration
      }
    })

  } catch (error) {
    console.error('AI Run detail API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch AI run details'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await request.json()

    const run = await prisma.aiRun.update({
      where: { id },
      data: {
        ...updates,
        ...(updates.status === 'completed' && { completedAt: new Date() })
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          }
        },
        article: {
          select: {
            id: true,
            title: true,
            url: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      run
    })

  } catch (error) {
    console.error('AI Run update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update AI run'
      },
      { status: 500 }
    )
  }
}
