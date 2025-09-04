import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { discoverUrlsForOrganization } from '@/lib/googleSearch'
import { discoverOrganizationNewsUrls } from '@/lib/firecrawl'

export async function POST(request: NextRequest) {
  try {
    const { organizationId, organizationName, timeframe = '90' } = await request.json()

    if (!organizationId || !organizationName) {
      return NextResponse.json(
        {
          success: false,
          error: 'organizationId and organizationName are required'
        },
        { status: 400 }
      )
    }

    console.log(`🔍 Starting URL discovery for: ${organizationName}`)
    
    // Step 1: Create discovery batch record
    const batch = await prisma.urlDiscoveryBatch.create({
      data: {
        organizationId,
        status: 'discovering',
        timeframe: parseInt(timeframe.toString()),
        totalUrls: 0,
        processedUrls: 0,
        discoveredUrls: [],
        startedAt: new Date()
      }
    });

    console.log(`📝 Created batch record: ${batch.id}`);

    try {
      // Get organization details for website URL
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { website: true }
      });

      let allDiscoveredUrls: string[] = [];
      let searchQueries: string[] = [];

      // Step 2a: Discover URLs using Google Search (external sources)
      console.log(`🌐 Starting Google Search discovery...`);
      const googleDiscoveryResult = await discoverUrlsForOrganization(
        organizationName, 
        parseInt(timeframe.toString())
      );

      console.log(`🔍 Google Search discovered ${googleDiscoveryResult.totalFound} URLs`);
      allDiscoveredUrls.push(...googleDiscoveryResult.urls);
      searchQueries.push(...googleDiscoveryResult.searchQueries);

      // Step 2b: Discover URLs from organization's website (first-party content)
      if (organization?.website) {
        console.log(`🏠 Starting Firecrawl mapping of organization website: ${organization.website}`);
        try {
          const websiteUrls = await discoverOrganizationNewsUrls(organization.website, organizationName);
          console.log(`📰 Firecrawl discovered ${websiteUrls.length} URLs from organization website`);
          allDiscoveredUrls.push(...websiteUrls);
        } catch (websiteError) {
          const errorMessage = websiteError instanceof Error ? websiteError.message : String(websiteError);
          if (errorMessage.includes('Insufficient credits') || errorMessage.includes('402')) {
            console.warn(`💳 Firecrawl out of credits - skipping website mapping, using Google Search only`);
          } else {
            console.warn(`⚠️ Website mapping failed: ${errorMessage}`);
          }
          // Continue with Google results only
        }
      } else {
        console.log(`ℹ️ No website URL available for ${organizationName}, skipping website mapping`);
      }

      // Remove duplicates from combined results
      const uniqueUrls = [...new Set(allDiscoveredUrls)];
      console.log(`📋 Combined discovery: ${uniqueUrls.length} unique URLs from all sources`);

      // Step 3: Filter out URLs that already exist as articles
      const existingArticles = await prisma.article.findMany({
        where: { 
          url: { in: uniqueUrls },
          organizationId 
        },
        select: { url: true }
      });
      
      const existingUrls = new Set(existingArticles.map(a => a.url));
      const newUrls = uniqueUrls.filter(url => !existingUrls.has(url));
      
      console.log(`✅ Filtered to ${newUrls.length} new URLs (${existingUrls.size} already exist)`);

      // Step 4: Update batch with discovered URLs
      const updatedBatch = await prisma.urlDiscoveryBatch.update({
        where: { id: batch.id },
        data: {
          discoveredUrls: newUrls,
          totalUrls: newUrls.length,
          status: 'ready_for_processing',
          discoveredAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: `URL discovery completed for ${organizationName}`,
        batchId: batch.id,
        organizationId,
        organizationName,
        timeframe: parseInt(timeframe.toString()),
        results: {
          totalFound: uniqueUrls.length,
          googleSearchUrls: googleDiscoveryResult.urls.length,
          websiteUrls: allDiscoveredUrls.length - googleDiscoveryResult.urls.length,
          newUrls: newUrls.length,
          duplicateUrls: existingUrls.size,
          searchQueries: searchQueries,
          websiteUsed: !!organization?.website,
          urls: newUrls
        }
      })

    } catch (discoveryError) {
      // Update batch status to failed
      await prisma.urlDiscoveryBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          completedAt: new Date()
        }
      });

      throw discoveryError;
    }

  } catch (error) {
    console.error('URL discovery API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete URL discovery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get URL discovery status and batches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    
    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'organizationId is required'
        },
        { status: 400 }
      )
    }

    // Get recent discovery batches for this organization
    const batches = await prisma.urlDiscoveryBatch.findMany({
      where: { organizationId },
      include: {
        organization: {
          select: { name: true }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    })

    // Get summary stats
    const stats = await prisma.urlDiscoveryBatch.aggregate({
      where: { organizationId },
      _sum: {
        totalUrls: true,
        processedUrls: true,
        successfulUrls: true,
        failedUrls: true
      },
      _count: true
    })

    return NextResponse.json({
      success: true,
      batches: batches.map(batch => ({
        id: batch.id,
        status: batch.status,
        timeframe: batch.timeframe,
        totalUrls: batch.totalUrls,
        processedUrls: batch.processedUrls,
        successfulUrls: batch.successfulUrls,
        failedUrls: batch.failedUrls,
        startedAt: batch.startedAt,
        discoveredAt: batch.discoveredAt,
        completedAt: batch.completedAt,
        organization: batch.organization.name
      })),
      stats: {
        totalBatches: stats._count,
        totalUrlsDiscovered: stats._sum.totalUrls || 0,
        totalUrlsProcessed: stats._sum.processedUrls || 0,
        totalSuccessful: stats._sum.successfulUrls || 0,
        totalFailed: stats._sum.failedUrls || 0
      }
    })

  } catch (error) {
    console.error('URL discovery status API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get URL discovery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
