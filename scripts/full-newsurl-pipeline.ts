#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DiscoveryResult {
  success: boolean;
  organizationId: string;
  organizationName: string;
  batchId?: string;
  totalFound?: number;
  newsUrlUrls?: number;
  googleSearchUrls?: number;
  urls?: string[];
  error?: string;
}

interface ScrapeResult {
  success: boolean;
  batchId: string;
  organizationName: string;
  total?: number;
  successCount?: number;
  duplicateCount?: number;
  errorCount?: number;
  error?: string;
}

/**
 * Complete pipeline: Discovery → Scraping for all organizations with newsURL
 */
async function runFullNewsUrlPipeline() {
  console.log('🚀 Starting full newsURL pipeline with simple HTTP extraction...\n');
  
  try {
    // Step 1: Get all organizations with newsUrl configured
    const orgsWithNewsUrl = await prisma.organization.findMany({
      where: {
        newsUrl: { not: null }
      },
      select: {
        id: true,
        name: true,
        newsUrl: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Found ${orgsWithNewsUrl.length} organizations with newsUrl configured\n`);
    
    const discoveryResults: DiscoveryResult[] = [];
    const scrapeResults: ScrapeResult[] = [];

    // Step 2: URL Discovery for each organization
    console.log('🔍 PHASE 1: URL Discovery using Simple HTTP Extraction');
    console.log('=' .repeat(60));

    for (let i = 0; i < orgsWithNewsUrl.length; i++) {
      const org = orgsWithNewsUrl[i];
      console.log(`\n[${i + 1}/${orgsWithNewsUrl.length}] 📰 ${org.name}`);
      console.log(`   News URL: ${org.newsUrl}`);

      try {
        const discoveryResponse = await fetch('http://localhost:3000/api/url-discovery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: org.id,
            organizationName: org.name,
            timeframe: 365
          }),
        });

        if (!discoveryResponse.ok) {
          throw new Error(`HTTP ${discoveryResponse.status}: ${discoveryResponse.statusText}`);
        }

        const discoveryData = await discoveryResponse.json();
        
        const result: DiscoveryResult = {
          success: true,
          organizationId: org.id,
          organizationName: org.name,
          batchId: discoveryData.batchId,
          totalFound: discoveryData.results?.totalFound || 0,
          newsUrlUrls: discoveryData.results?.newsUrlUrls || 0,
          googleSearchUrls: discoveryData.results?.googleSearchUrls || 0,
          urls: discoveryData.results?.urls || []
        };

        discoveryResults.push(result);

        console.log(`   ✅ Success: ${result.totalFound} URLs found`);
        console.log(`      • Simple HTTP extraction: ${result.newsUrlUrls} URLs`);
        console.log(`      • Google Search backup: ${result.googleSearchUrls} URLs`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ Failed: ${errorMessage}`);
        
        discoveryResults.push({
          success: false,
          organizationId: org.id,
          organizationName: org.name,
          error: errorMessage
        });
      }

      // Be respectful with API calls
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Discovery Summary
    const successfulDiscoveries = discoveryResults.filter(r => r.success);
    const totalUrlsFound = successfulDiscoveries.reduce((sum, r) => sum + (r.totalFound || 0), 0);
    const totalNewsUrlUrls = successfulDiscoveries.reduce((sum, r) => sum + (r.newsUrlUrls || 0), 0);
    const totalGoogleUrls = successfulDiscoveries.reduce((sum, r) => sum + (r.googleSearchUrls || 0), 0);

    console.log('\n📊 DISCOVERY PHASE SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`✅ Successful organizations: ${successfulDiscoveries.length}/${orgsWithNewsUrl.length}`);
    console.log(`📍 Total URLs discovered: ${totalUrlsFound}`);
    console.log(`   🎯 From simple HTTP extraction: ${totalNewsUrlUrls} URLs`);
    console.log(`   🔍 From Google Search backup: ${totalGoogleUrls} URLs`);
    console.log(`📈 Simple HTTP success rate: ${((totalNewsUrlUrls / totalUrlsFound) * 100).toFixed(1)}%`);

    // Show breakdown
    console.log('\n📋 Results by Organization:');
    discoveryResults.forEach(result => {
      if (result.success) {
        console.log(`   ✅ ${result.organizationName}: ${result.totalFound} URLs (${result.newsUrlUrls} from newsURL, ${result.googleSearchUrls} from Google)`);
      } else {
        console.log(`   ❌ ${result.organizationName}: ${result.error}`);
      }
    });

    if (successfulDiscoveries.length === 0) {
      console.log('\n❌ No successful discoveries found. Exiting.');
      return;
    }

    // Step 3: Bulk Scraping
    console.log('\n🔄 PHASE 2: Bulk Scraping of Discovered URLs');
    console.log('=' .repeat(60));

    const batchIds = successfulDiscoveries
      .filter(r => r.batchId)
      .map(r => r.batchId!);

    if (batchIds.length === 0) {
      console.log('\n❌ No batch IDs found for scraping. Exiting.');
      return;
    }

    console.log(`📦 Processing ${batchIds.length} discovery batches...`);

    try {
      const scrapeResponse = await fetch('http://localhost:3000/api/process-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchIds: batchIds
        }),
      });

      if (!scrapeResponse.ok) {
        throw new Error(`HTTP ${scrapeResponse.status}: ${scrapeResponse.statusText}`);
      }

      const scrapeData = await scrapeResponse.json();
      console.log('✅ Bulk scraping initiated successfully');
      console.log(`📊 Processing ${scrapeData.totalBatches} batches with ${scrapeData.totalUrls} URLs`);

      // Wait a bit for scraping to process
      console.log('\n⏳ Waiting for scraping to complete (60 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 60000));

      // Check final results
      console.log('\n📊 Checking final results...');
      
      const finalStats = await prisma.article.groupBy({
        by: ['organizationId', 'status'],
        where: {
          organizationId: {
            in: successfulDiscoveries.map(r => r.organizationId)
          }
        },
        _count: {
          id: true
        }
      });

      console.log('\n📈 FINAL RESULTS BY ORGANIZATION:');
      console.log('=' .repeat(60));
      
      for (const result of successfulDiscoveries) {
        const orgStats = finalStats.filter(s => s.organizationId === result.organizationId);
        const published = orgStats.find(s => s.status === 'published')?._count.id || 0;
        const draft = orgStats.find(s => s.status === 'draft')?._count.id || 0;
        const rejected = orgStats.find(s => s.status === 'rejected')?._count.id || 0;
        const total = published + draft + rejected;
        
        console.log(`📊 ${result.organizationName}:`);
        console.log(`   🔍 URLs discovered: ${result.totalFound}`);
        console.log(`   📄 Articles created: ${total}`);
        console.log(`   ✅ Published: ${published}`);
        console.log(`   📝 Draft: ${draft}`);
        console.log(`   ❌ Rejected: ${rejected}`);
        if (result.totalFound! > 0) {
          console.log(`   📈 Success rate: ${((total / result.totalFound!) * 100).toFixed(1)}%`);
        }
        console.log('');
      }

      // Overall summary
      const totalPublished = finalStats.filter(s => s.status === 'published').reduce((sum, s) => sum + s._count.id, 0);
      const totalDraft = finalStats.filter(s => s.status === 'draft').reduce((sum, s) => sum + s._count.id, 0);
      const totalRejected = finalStats.filter(s => s.status === 'rejected').reduce((sum, s) => sum + s._count.id, 0);
      const totalArticles = totalPublished + totalDraft + totalRejected;

      console.log('🎉 PIPELINE COMPLETE - OVERALL SUMMARY:');
      console.log('=' .repeat(60));
      console.log(`📊 Organizations processed: ${successfulDiscoveries.length}/${orgsWithNewsUrl.length}`);
      console.log(`🔍 Total URLs discovered: ${totalUrlsFound}`);
      console.log(`📄 Total articles created: ${totalArticles}`);
      console.log(`✅ Published articles: ${totalPublished}`);
      console.log(`📝 Draft articles: ${totalDraft}`);
      console.log(`❌ Rejected articles: ${totalRejected}`);
      console.log(`📈 Overall success rate: ${totalUrlsFound > 0 ? ((totalArticles / totalUrlsFound) * 100).toFixed(1) : 0}%`);
      console.log(`🎯 Simple HTTP extraction effectiveness: ${((totalNewsUrlUrls / totalUrlsFound) * 100).toFixed(1)}% of URLs from curated sources`);

    } catch (scrapeError) {
      console.error('❌ Bulk scraping failed:', scrapeError);
      console.log('\n🔧 You can manually process the batches later using the process-batches API');
      console.log(`📦 Batch IDs: ${batchIds.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the pipeline
runFullNewsUrlPipeline();
