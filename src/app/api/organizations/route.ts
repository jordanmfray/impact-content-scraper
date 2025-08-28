import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        logo: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      organizations
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
