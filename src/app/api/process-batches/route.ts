import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { batchIds, concurrency = 3, batchDelay = 2000 } = await request.json()

    console.log('🚀 Starting batch processing for discovered URLs')
    
    // Get batches to process
    let batches;
    if (batchIds && Array.isArray(batchIds)) {
      batches = await prisma.urlDiscoveryBatch.findMany({
        where: { 
          id: { in: batchIds },
          status: 'ready_for_processing'
        },
        include: {
          organization: { select: { name: true } }
        }
      });
    } else {
      // Process all ready batches
      batches = await prisma.urlDiscoveryBatch.findMany({
        where: { status: 'ready_for_processing' },
        include: {
          organization: { select: { name: true } }
        },
        orderBy: { discoveredAt: 'asc' },
        take: 10 // Limit to 10 batches to avoid overwhelming
      });
    }

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No batches ready for processing',
        processed: 0
      });
    }

    console.log(`📋 Processing ${batches.length} batches`);

    const results = [];
    let totalUrlsProcessed = 0;
    let totalSuccessful = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;

    // Process each batch
    for (const batch of batches) {
      if (batch.discoveredUrls.length === 0) {
        console.log(`⚠️  Skipping ${batch.organization.name}: No URLs to process`);
        
        // Mark as completed since there's nothing to process
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'completed',
            processedUrls: 0,
            successfulUrls: 0,
            failedUrls: 0,
            completedAt: new Date()
          }
        });
        
        results.push({
          batchId: batch.id,
          organizationName: batch.organization.name,
          status: 'completed',
          urlsProcessed: 0,
          successful: 0,
          duplicates: 0,
          failed: 0,
          message: 'No URLs to process'
        });
        
        continue;
      }

      console.log(`\n🔄 Processing batch for ${batch.organization.name} (${batch.discoveredUrls.length} URLs)`);

      try {
        // Update batch status to processing
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'processing',
            processingStartedAt: new Date()
          }
        });

        // Call the existing bulk-scrape API
        const scrapeResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/bulk-scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: batch.organizationId,
            urls: batch.discoveredUrls,
            concurrency,
            batchDelay
          })
        });

        if (!scrapeResponse.ok) {
          throw new Error(`Bulk scrape API returned ${scrapeResponse.status}`);
        }

        const scrapeResult = await scrapeResponse.json();

        if (!scrapeResult.success) {
          throw new Error(scrapeResult.error || 'Bulk scrape failed');
        }

        // Update batch with results
        const batchSummary = scrapeResult.summary;
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'completed',
            processedUrls: batchSummary.total,
            successfulUrls: batchSummary.success,
            failedUrls: batchSummary.error,
            processingResults: scrapeResult.results,
            completedAt: new Date()
          }
        });

        const batchResult = {
          batchId: batch.id,
          organizationName: batch.organization.name,
          status: 'completed',
          urlsProcessed: batchSummary.total,
          successful: batchSummary.success,
          duplicates: batchSummary.duplicate,
          failed: batchSummary.error,
          message: `Successfully processed ${batchSummary.success} articles`
        };

        results.push(batchResult);
        totalUrlsProcessed += batchSummary.total;
        totalSuccessful += batchSummary.success;
        totalDuplicates += batchSummary.duplicate;
        totalFailed += batchSummary.error;

        console.log(`   ✅ ${batch.organization.name}: ${batchSummary.success} successful, ${batchSummary.duplicate} duplicates, ${batchSummary.error} failed`);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing batch for ${batch.organization.name}:`, error);

        // Update batch status to failed
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'failed',
            completedAt: new Date()
          }
        });

        results.push({
          batchId: batch.id,
          organizationName: batch.organization.name,
          status: 'failed',
          urlsProcessed: 0,
          successful: 0,
          duplicates: 0,
          failed: batch.discoveredUrls.length,
          message: error instanceof Error ? error.message : 'Unknown error',
          error: true
        });
      }
    }

    const summary = {
      batchesProcessed: results.length,
      successfulBatches: results.filter(r => r.status === 'completed').length,
      failedBatches: results.filter(r => r.status === 'failed').length,
      totalUrlsProcessed,
      totalSuccessful,
      totalDuplicates,
      totalFailed
    };

    console.log(`\n🎯 Batch processing completed:`, summary);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} batches`,
      summary,
      results
    });

  } catch (error) {
    console.error('Batch processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process batches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get batches ready for processing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    
    let whereClause: any = {
      status: 'ready_for_processing'
    };
    
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const readyBatches = await prisma.urlDiscoveryBatch.findMany({
      where: whereClause,
      include: {
        organization: { 
          select: { name: true, logo: true } 
        }
      },
      orderBy: { discoveredAt: 'asc' }
    });

    const summary = {
      totalBatches: readyBatches.length,
      totalUrls: readyBatches.reduce((sum, batch) => sum + batch.totalUrls, 0),
      organizationCount: new Set(readyBatches.map(b => b.organizationId)).size
    };

    return NextResponse.json({
      success: true,
      summary,
      batches: readyBatches.map(batch => ({
        id: batch.id,
        organizationId: batch.organizationId,
        organizationName: batch.organization.name,
        organizationLogo: batch.organization.logo,
        timeframe: batch.timeframe,
        totalUrls: batch.totalUrls,
        discoveredAt: batch.discoveredAt,
        urls: batch.discoveredUrls
      }))
    });

  } catch (error) {
    console.error('Get ready batches error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get ready batches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
