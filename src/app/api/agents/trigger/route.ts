import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { inngest } from '@/lib/inngest-client'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { limit?: number }
  const limit = body.limit ?? 5

  const discoveries = await prisma.discoveryResult.findMany({
    where: { status: { in: ['queued', 'scraped'] } },
    orderBy: { discoveredAt: 'desc' },
    take: limit,
  })

  for (const d of discoveries) {
    await inngest.send({ name: 'content.scrape.requested', data: { discoveryId: d.id, url: d.url } })
  }

  return NextResponse.json({ triggered: discoveries.length })
}
