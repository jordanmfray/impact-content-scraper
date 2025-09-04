import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { discoverUrlsForOrganization } from '@/lib/googleSearch'
import { discoverOrganizationNewsUrls } from '@/lib/firecrawl'

export async function POST(request: NextRequest) {
  try {
    const { timeframe = '90', organizationIds } = await request.json()
    const timeframeInt = parseInt(timeframe.toString())

    console.log(`🏢 Starting bulk URL discovery (${timeframe} days)`)
    
    // Get organizations to process
    let organizations;
    if (organizationIds && Array.isArray(organizationIds)) {
      organizations = await prisma.organization.findMany({
        where: { id: { in: organizationIds } },
        select: { id: true, name: true, website: true }
      });
    } else {
      organizations = await prisma.organization.findMany({
        select: { id: true, name: true, website: true }
      });
    }

    console.log(`📋 Processing ${organizations.length} organizations`);

    const results = [];
    let totalUrlsFound = 0;
    let totalNewUrls = 0;
    let totalDuplicates = 0;

    // Process each organization sequentially to respect API rate limits
    for (const org of organizations) {
      console.log(`\n🔍 Processing: ${org.name}`);
      
      try {
        // Step 1: Create discovery batch record
        const batch = await prisma.urlDiscoveryBatch.create({
          data: {
            organizationId: org.id,
            status: 'discovering',
            timeframe: timeframeInt,
            totalUrls: 0,
            processedUrls: 0,
            discoveredUrls: [],
            startedAt: new Date()
          }
        });

        // Step 2: Discover URLs using multiple sources
        let allDiscoveredUrls: string[] = [];
        let searchQueries: string[] = [];

        // Step 2a: Google Search discovery
        console.log(`🌐 Google Search discovery for ${org.name}...`);
        const googleDiscoveryResult = await discoverUrlsForOrganization(org.name, timeframeInt);
        allDiscoveredUrls.push(...googleDiscoveryResult.urls);
        searchQueries.push(...googleDiscoveryResult.searchQueries);

        // Step 2b: Website mapping discovery (if organization has website)
        if (org.website) {
          console.log(`🏠 Website mapping for ${org.name}: ${org.website}`);
          try {
            const websiteUrls = await discoverOrganizationNewsUrls(org.website, org.name);
            allDiscoveredUrls.push(...websiteUrls);
            console.log(`📰 Found ${websiteUrls.length} URLs from ${org.name} website`);
          } catch (websiteError) {
            const errorMessage = websiteError instanceof Error ? websiteError.message : String(websiteError);
            if (errorMessage.includes('Insufficient credits') || errorMessage.includes('402')) {
              console.warn(`💳 Firecrawl out of credits - skipping ${org.name} website mapping`);
            } else {
              console.warn(`⚠️ Website mapping failed for ${org.name}: ${errorMessage}`);
            }
          }
        }

        // Remove duplicates
        const uniqueUrls = [...new Set(allDiscoveredUrls)];

        // Step 3: Filter out existing URLs
        const existingArticles = await prisma.article.findMany({
          where: { 
            url: { in: uniqueUrls },
            organizationId: org.id
          },
          select: { url: true }
        });
        
        const existingUrls = new Set(existingArticles.map(a => a.url));
        const newUrls = uniqueUrls.filter(url => !existingUrls.has(url));

        // Step 4: Update batch with results
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            discoveredUrls: newUrls,
            totalUrls: newUrls.length,
            status: 'ready_for_processing',
            discoveredAt: new Date()
          }
        });

        const orgResult = {
          organizationId: org.id,
          organizationName: org.name,
          batchId: batch.id,
          totalFound: uniqueUrls.length,
          googleSearchUrls: googleDiscoveryResult.urls.length,
          websiteUrls: allDiscoveredUrls.length - googleDiscoveryResult.urls.length,
          newUrls: newUrls.length,
          duplicateUrls: existingUrls.size,
          searchQueries: searchQueries.length,
          websiteUsed: !!org.website,
          status: 'completed'
        };

        results.push(orgResult);
        totalUrlsFound += uniqueUrls.length;
        totalNewUrls += newUrls.length;
        totalDuplicates += existingUrls.size;

        console.log(`   ✅ ${org.name}: ${newUrls.length} new URLs (${existingUrls.size} duplicates)`);

        // Small delay between organizations to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorResult = {
          organizationId: org.id,
          organizationName: org.name,
          batchId: null,
          totalFound: 0,
          newUrls: 0,
          duplicateUrls: 0,
          searchQueries: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        results.push(errorResult);
        console.error(`   ❌ ${org.name}: ${error}`);
      }
    }

    const summary = {
      organizationsProcessed: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      totalUrlsFound,
      totalNewUrls,
      totalDuplicates,
      timeframe: timeframeInt
    };

    console.log(`\n🎯 Bulk discovery completed:`, summary);

    return NextResponse.json({
      success: true,
      message: `Bulk URL discovery completed for ${organizations.length} organizations`,
      summary,
      results
    })

  } catch (error) {
    console.error('Bulk discovery API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete bulk URL discovery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get overall discovery status across all organizations
export async function GET(request: NextRequest) {
  try {
    // Get recent discovery batches across all organizations
    const batches = await prisma.urlDiscoveryBatch.findMany({
      include: {
        organization: {
          select: { name: true, logo: true }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 50
    })

    // Get summary stats by organization
    const statsByOrg = await prisma.urlDiscoveryBatch.groupBy({
      by: ['organizationId'],
      _sum: {
        totalUrls: true,
        processedUrls: true,
        successfulUrls: true,
        failedUrls: true
      },
      _count: true,
      _max: {
        startedAt: true,
        completedAt: true
      }
    })

    // Get organization details for the stats
    const orgIds = statsByOrg.map(stat => stat.organizationId)
    const organizations = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, logo: true }
    })

    const orgMap = new Map(organizations.map(org => [org.id, org]))

    // Overall stats
    const overallStats = await prisma.urlDiscoveryBatch.aggregate({
      _sum: {
        totalUrls: true,
        processedUrls: true,
        successfulUrls: true,
        failedUrls: true
      },
      _count: true
    })

    // Active/recent batches
    const activeBatches = batches.filter(batch => 
      batch.status === 'discovering' || 
      batch.status === 'processing' || 
      batch.status === 'ready_for_processing'
    )

    return NextResponse.json({
      success: true,
      activeBatches: activeBatches.length,
      recentBatches: batches.slice(0, 20).map(batch => ({
        id: batch.id,
        organizationName: batch.organization.name,
        status: batch.status,
        timeframe: batch.timeframe,
        totalUrls: batch.totalUrls,
        processedUrls: batch.processedUrls,
        successfulUrls: batch.successfulUrls,
        failedUrls: batch.failedUrls,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        discoveredUrls: batch.discoveredUrls
      })),
      statsByOrganization: statsByOrg.map(stat => {
        const org = orgMap.get(stat.organizationId)
        return {
          organizationId: stat.organizationId,
          organizationName: org?.name || 'Unknown',
          organizationLogo: org?.logo,
          totalBatches: stat._count,
          totalUrlsDiscovered: stat._sum.totalUrls || 0,
          totalUrlsProcessed: stat._sum.processedUrls || 0,
          totalSuccessful: stat._sum.successfulUrls || 0,
          totalFailed: stat._sum.failedUrls || 0,
          lastRunAt: stat._max.startedAt,
          lastCompletedAt: stat._max.completedAt
        }
      }),
      overallStats: {
        totalBatches: overallStats._count,
        totalUrlsDiscovered: overallStats._sum.totalUrls || 0,
        totalUrlsProcessed: overallStats._sum.processedUrls || 0,
        totalSuccessful: overallStats._sum.successfulUrls || 0,
        totalFailed: overallStats._sum.failedUrls || 0,
        activeBatches: activeBatches.length
      }
    })

  } catch (error) {
    console.error('Bulk discovery status API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get bulk discovery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
