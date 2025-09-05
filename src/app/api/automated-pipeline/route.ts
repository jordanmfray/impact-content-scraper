import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface PipelineResult {
  organizationId: string
  organizationName: string
  success: boolean
  phase1: { success: boolean, urlsDiscovered: number, error?: string }
  phase2: { success: boolean, articlesScraped: number, error?: string }
  phase3: { success: boolean, articlesCreated: number, error?: string }
  error?: string
  duration: number
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 Starting automated pipeline for all eligible organizations...')
  
  try {
    // Find organizations that have newsUrl but no published articles
    console.log('📊 Finding eligible organizations...')
    const eligibleOrgs = await prisma.organization.findMany({
      where: {
        AND: [
          { newsUrl: { not: null } },
          { newsUrl: { not: '' } },
          {
            articles: {
              none: {
                status: 'published'
              }
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        newsUrl: true,
        _count: {
          select: {
            articles: {
              where: { status: 'published' }
            }
          }
        }
      }
    })

    console.log(`✅ Found ${eligibleOrgs.length} eligible organizations:`)
    eligibleOrgs.forEach(org => {
      console.log(`   • ${org.name} (${org.newsUrl})`)
    })

    if (eligibleOrgs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible organizations found',
        results: [],
        summary: {
          processed: 0,
          successful: 0,
          failed: 0,
          totalDuration: Date.now() - startTime
        }
      })
    }

    const results: PipelineResult[] = []

    // Process each organization through the full pipeline
    for (const org of eligibleOrgs) {
      const orgStartTime = Date.now()
      console.log(`\n🏢 Processing: ${org.name}`)
      console.log(`🌐 News URL: ${org.newsUrl}`)

      const result: PipelineResult = {
        organizationId: org.id,
        organizationName: org.name,
        success: false,
        phase1: { success: false, urlsDiscovered: 0 },
        phase2: { success: false, articlesScraped: 0 },
        phase3: { success: false, articlesCreated: 0 },
        duration: 0
      }

      try {
        // Phase 1: URL Discovery
        console.log('📄 Running Phase 1: URL Discovery...')
        const phase1Response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/discovery/phase1`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            organizationId: org.id,
            newsUrl: org.newsUrl
          })
        })

        const phase1Data = await phase1Response.json()
        
        if (!phase1Data.success) {
          result.phase1.error = phase1Data.error || 'Phase 1 failed'
          result.error = `Phase 1 failed: ${phase1Data.error}`
          console.log(`❌ Phase 1 failed: ${phase1Data.error}`)
        } else {
          result.phase1.success = true
          result.phase1.urlsDiscovered = phase1Data.discoveredUrls?.length || 0
          console.log(`✅ Phase 1 complete: ${result.phase1.urlsDiscovered} URLs discovered`)

          if (result.phase1.urlsDiscovered === 0) {
            result.error = 'No URLs discovered'
            console.log('⚠️ No URLs discovered, skipping remaining phases')
          } else {
            // Phase 2: Scraping and Analysis  
            console.log('🔍 Running Phase 2: Scraping and Analysis...')
            const phase2Response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/discovery/phase2`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                sessionId: phase1Data.sessionId,
                selectAll: true // Automatically select all URLs for scraping
              })
            })

            const phase2Data = await phase2Response.json()

            if (!phase2Data.success) {
              result.phase2.error = phase2Data.error || 'Phase 2 failed'
              result.error = `Phase 2 failed: ${phase2Data.error}`
              console.log(`❌ Phase 2 failed: ${phase2Data.error}`)
            } else {
              result.phase2.success = true
              result.phase2.articlesScraped = phase2Data.scrapedContent?.length || 0
              console.log(`✅ Phase 2 complete: ${result.phase2.articlesScraped} articles scraped`)

              if (result.phase2.articlesScraped === 0) {
                result.error = 'No articles scraped successfully'
                console.log('⚠️ No articles scraped, skipping Phase 3')
              } else {
                // Phase 3: AI Enhancement and Finalization
                console.log('🤖 Running Phase 3: AI Enhancement and Finalization...')
                const phase3Response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/discovery/phase3`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    sessionId: phase1Data.sessionId,
                    selectAll: true // Automatically select all scraped content for finalization
                  })
                })

                const phase3Data = await phase3Response.json()

                if (!phase3Data.success) {
                  result.phase3.error = phase3Data.error || 'Phase 3 failed'
                  result.error = `Phase 3 failed: ${phase3Data.error}`
                  console.log(`❌ Phase 3 failed: ${phase3Data.error}`)
                } else {
                  result.phase3.success = true
                  result.phase3.articlesCreated = phase3Data.articlesCreated || 0
                  result.success = true // Full pipeline succeeded
                  console.log(`✅ Phase 3 complete: ${result.phase3.articlesCreated} articles created`)
                }
              }
            }
          }
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error)
        console.log(`❌ Pipeline error for ${org.name}:`, error)
      }

      result.duration = Date.now() - orgStartTime
      results.push(result)

      console.log(`⏱️ ${org.name} completed in ${Math.round(result.duration / 1000)}s`)
    }

    // Calculate summary statistics
    const successful = results.filter(r => r.success).length
    const failed = results.length - successful
    const totalArticles = results.reduce((sum, r) => sum + r.phase3.articlesCreated, 0)

    const summary = {
      processed: results.length,
      successful,
      failed,
      totalArticlesCreated: totalArticles,
      totalDuration: Date.now() - startTime
    }

    console.log('\n🎯 Automated Pipeline Complete!')
    console.log(`✅ Successfully processed: ${successful}/${results.length} organizations`)
    console.log(`📝 Total articles created: ${totalArticles}`)
    console.log(`⏱️ Total duration: ${Math.round(summary.totalDuration / 1000)}s`)

    return NextResponse.json({
      success: true,
      results,
      summary
    })

  } catch (error) {
    console.error('❌ Automated pipeline error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
