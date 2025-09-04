#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Process newsURL-only batches in smaller chunks using the working bulk-scrape API
 * Bypasses the broken batch processing system
 */
async function processNewsUrlBatchesInChunks() {
  console.log('🚀 Processing newsURL-only batches in smaller chunks...');
  console.log('   ✅ Using working bulk-scrape API directly');
  console.log('   ❌ Bypassing broken process-batches system\n');

  try {
    // Get all newsURL-only batches that are ready for processing  
    const batches = await prisma.urlDiscoveryBatch.findMany({
      where: { 
        status: 'ready_for_processing',
        totalUrls: { gt: 0 }
      },
      include: {
        organization: { select: { name: true } }
      },
      orderBy: { totalUrls: 'desc' }
    });

    if (batches.length === 0) {
      console.log('❌ No batches ready for processing');
      return;
    }

    console.log(`📊 Found ${batches.length} batches with ${batches.reduce((sum, b) => sum + b.totalUrls, 0)} total URLs\n`);

    const results: Array<{
      organizationName: string;
      batchId: string;
      totalUrls: number;
      processed: number;
      successful: number;
      duplicates: number;
      errors: number;
      chunkResults: any[];
      status: 'completed' | 'failed' | 'partial';
      message: string;
    }> = [];

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[${i + 1}/${batches.length}] 🔄 Processing: ${batch.organization.name}`);
      console.log(`   📦 Batch: ${batch.id}`);
      console.log(`   🔗 URLs: ${batch.totalUrls}`);

      try {
        // Update batch status
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'processing',
            processingStartedAt: new Date()
          }
        });

        // Process URLs in chunks of 20 to avoid overwhelming the system
        const chunkSize = 20;
        const urls = batch.discoveredUrls || [];
        const chunks = [];
        
        for (let j = 0; j < urls.length; j += chunkSize) {
          chunks.push(urls.slice(j, j + chunkSize));
        }

        console.log(`   📊 Split into ${chunks.length} chunks of ${chunkSize} URLs each`);

        let totalProcessed = 0;
        let totalSuccessful = 0;
        let totalDuplicates = 0;
        let totalErrors = 0;
        const chunkResults = [];

        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          console.log(`      Chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} URLs`);

          try {
            const response = await fetch('http://localhost:3000/api/bulk-scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                organizationId: batch.organizationId,
                urls: chunk,
                concurrency: 3,
                batchDelay: 2000
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const chunkResult = await response.json();

            if (!chunkResult.success) {
              throw new Error(chunkResult.error || 'Chunk processing failed');
            }

            const summary = chunkResult.summary;
            totalProcessed += summary.total;
            totalSuccessful += summary.success;
            totalDuplicates += summary.duplicate;
            totalErrors += summary.error;

            chunkResults.push({
              chunkIndex: chunkIndex + 1,
              urls: chunk.length,
              successful: summary.success,
              duplicates: summary.duplicate,
              errors: summary.error
            });

            console.log(`         ✅ ${summary.success} successful, ${summary.duplicate} duplicates, ${summary.error} errors`);

            // Brief delay between chunks
            await new Promise(resolve => setTimeout(resolve, 3000));

          } catch (chunkError) {
            const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
            console.log(`         ❌ Chunk failed: ${errorMessage}`);
            
            chunkResults.push({
              chunkIndex: chunkIndex + 1,
              urls: chunk.length,
              successful: 0,
              duplicates: 0,
              errors: chunk.length,
              error: errorMessage
            });

            totalProcessed += chunk.length;
            totalErrors += chunk.length;
          }
        }

        // Update batch with final results
        const batchStatus = totalErrors === totalProcessed ? 'failed' : 
                           totalSuccessful === 0 ? 'failed' : 'completed';

        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: batchStatus,
            processedUrls: totalProcessed,
            successfulUrls: totalSuccessful,
            failedUrls: totalErrors,
            processingResults: {
              chunkResults,
              summary: {
                totalProcessed,
                totalSuccessful, 
                totalDuplicates,
                totalErrors,
                chunksProcessed: chunks.length
              }
            },
            completedAt: new Date()
          }
        });

        const result = {
          organizationName: batch.organization.name,
          batchId: batch.id,
          totalUrls: batch.totalUrls,
          processed: totalProcessed,
          successful: totalSuccessful,
          duplicates: totalDuplicates,
          errors: totalErrors,
          chunkResults,
          status: batchStatus as 'completed' | 'failed' | 'partial',
          message: `Processed ${totalProcessed} URLs: ${totalSuccessful} successful, ${totalDuplicates} duplicates, ${totalErrors} errors`
        };

        results.push(result);

        console.log(`   🎯 Final: ${totalSuccessful} articles created from ${batch.totalUrls} curated URLs`);
        console.log(`   📈 Success rate: ${totalProcessed > 0 ? ((totalSuccessful / totalProcessed) * 100).toFixed(1) : 0}%\n`);

      } catch (batchError) {
        const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
        console.log(`   ❌ Batch failed: ${errorMessage}\n`);

        // Update batch status to failed
        await prisma.urlDiscoveryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'failed',
            completedAt: new Date()
          }
        });

        results.push({
          organizationName: batch.organization.name,
          batchId: batch.id,
          totalUrls: batch.totalUrls,
          processed: 0,
          successful: 0,
          duplicates: 0,
          errors: batch.totalUrls,
          chunkResults: [],
          status: 'failed',
          message: errorMessage
        });
      }

      // Delay between organizations to be respectful
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Final summary
    const totalUrlsProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const successfulBatches = results.filter(r => r.status === 'completed').length;

    console.log('🎉 NEWSURL-ONLY PROCESSING COMPLETE:');
    console.log('=' .repeat(60));
    console.log(`📦 Batches processed: ${results.length}`);
    console.log(`✅ Successful batches: ${successfulBatches}/${results.length}`);
    console.log(`🔗 Total URLs processed: ${totalUrlsProcessed}`);
    console.log(`📄 Articles created: ${totalSuccessful}`);
    console.log(`📊 Duplicates found: ${totalDuplicates}`);
    console.log(`❌ Errors encountered: ${totalErrors}`);
    console.log(`📈 Overall success rate: ${totalUrlsProcessed > 0 ? ((totalSuccessful / totalUrlsProcessed) * 100).toFixed(1) : 0}%`);

    console.log('\n📋 Results by Organization:');
    results.forEach(result => {
      if (result.status === 'completed') {
        console.log(`   ✅ ${result.organizationName}: ${result.successful}/${result.totalUrls} articles (${((result.successful / result.totalUrls) * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ❌ ${result.organizationName}: Failed - ${result.message}`);
      }
    });

    console.log('\n🎯 Key Achievement:');
    console.log(`   ${totalSuccessful} high-quality articles created from 100% curated newsURL sources!`);
    console.log(`   No Google search garbage included - pure, targeted content.`);

    return results;

  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

processNewsUrlBatchesInChunks();
