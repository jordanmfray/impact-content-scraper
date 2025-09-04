#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runBulkNewsUrlDiscovery() {
  try {
    console.log('🔍 Starting bulk discovery for organizations with newsUrl...');
    
    // Get all organizations with newsUrl configured
    const orgsWithNewsUrl = await prisma.organization.findMany({
      where: {
        newsUrl: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        newsUrl: true,
        website: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Found ${orgsWithNewsUrl.length} organizations with newsUrl configured:`);
    orgsWithNewsUrl.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} → ${org.newsUrl}`);
    });

    console.log('\n🚀 Starting URL discovery for all organizations...\n');

    let totalSuccess = 0;
    let totalFailures = 0;
    const results: Array<{
      org: string;
      status: 'success' | 'failed';
      batchId?: string;
      urlsFound?: number;
      error?: string;
    }> = [];

    for (const org of orgsWithNewsUrl) {
      try {
        console.log(`\n🔄 Processing: ${org.name}...`);
        
        // Call the URL discovery API
        const response = await fetch('http://localhost:3000/api/url-discovery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: org.id,
            organizationName: org.name,
            timeframe: 365 // 1 year lookback
          })
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          console.log(`   ✅ Success: Found ${data.results.totalFound} URLs (${data.results.newUrls} new)`);
          console.log(`   📋 Batch ID: ${data.batchId}`);
          
          results.push({
            org: org.name,
            status: 'success',
            batchId: data.batchId,
            urlsFound: data.results.totalFound
          });
          
          totalSuccess++;
        } else {
          throw new Error(data.message || 'Unknown error');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ Failed: ${errorMessage}`);
        
        results.push({
          org: org.name,
          status: 'failed',
          error: errorMessage
        });
        
        totalFailures++;
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n📊 Bulk Discovery Summary:');
    console.log(`   ✅ Successful: ${totalSuccess}`);
    console.log(`   ❌ Failed: ${totalFailures}`);
    console.log(`   📋 Total: ${orgsWithNewsUrl.length}`);

    console.log('\n📋 Detailed Results:');
    results.forEach((result) => {
      if (result.status === 'success') {
        console.log(`   ✅ ${result.org}: ${result.urlsFound} URLs (Batch: ${result.batchId})`);
      } else {
        console.log(`   ❌ ${result.org}: ${result.error}`);
      }
    });

    // Get all batch IDs for easy processing
    const batchIds = results
      .filter(r => r.status === 'success' && r.batchId)
      .map(r => r.batchId!);

    if (batchIds.length > 0) {
      console.log(`\n🎯 Next Step: Process these ${batchIds.length} batches:`);
      console.log('   Run this command to scrape all discovered URLs:');
      console.log(`   curl -X POST http://localhost:3000/api/process-batches -H "Content-Type: application/json" -d '{"batchIds": ${JSON.stringify(batchIds)}}'`);
    }

  } catch (error) {
    console.error('❌ Bulk discovery failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBulkNewsUrlDiscovery();
