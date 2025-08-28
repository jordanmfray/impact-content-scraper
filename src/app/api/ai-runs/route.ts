import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const organizationId = searchParams.get('organizationId')

    const whereClause: any = {}

    if (status) {
      whereClause.status = status
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    }

    const runs = await prisma.aiRun.findMany({
      where: whereClause,
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
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: limit
    })

    // Calculate duration for completed runs
    const transformedRuns = runs.map((run: any) => ({
      ...run,
      duration: run.completedAt && run.startedAt 
        ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
        : null
    }))

    return NextResponse.json({
      success: true,
      runs: transformedRuns,
      total: transformedRuns.length
    })

  } catch (error) {
    console.error('AI Runs API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch AI runs'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inputUrl, organizationId, stepsData, status = 'running' } = await request.json()

    const run = await prisma.aiRun.create({
      data: {
        inputUrl,
        organizationId,
        stepsData,
        status,
        startedAt: new Date(),
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
      run
    })

  } catch (error) {
    console.error('AI Runs create error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create AI run'
      },
      { status: 500 }
    )
  }
}
