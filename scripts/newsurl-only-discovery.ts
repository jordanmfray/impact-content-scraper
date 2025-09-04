#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple HTTP + regex extraction function (no external APIs needed)
async function extractArticleUrlsSimple(newsUrl: string, orgName: string): Promise<string[]> {
  console.log(`📄 Fetching news page: ${newsUrl}`);
  
  const response = await fetch(newsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log(`📊 Fetched ${html.length} characters`);

  // Extract URLs using multiple patterns
  const urlPatterns = [
    /href="(https?:\/\/[^"]*(?:news|article|story|press|blog|media)[^"]*?)"/gi,
    /(?:onclick|data-href|data-url)="[^"]*?(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi,
    /"url":\s*"(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi
  ];

  let allUrls = new Set<string>();

  for (const pattern of urlPatterns) {
    const matches = [...html.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        allUrls.add(match[1]);
      }
    });
  }

  // Clean and filter URLs
  const cleanUrls = Array.from(allUrls)
    .filter(url => {
      try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname.toLowerCase();
        
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return false;
        }
        
        if (path.includes('/category/') || 
            path.includes('/tag/') || 
            path.includes('/page/') ||
            path.includes('/archive/') ||
            path.includes('/feed/') ||
            path.includes('.xml') ||
            path.includes('.rss') ||
            parsedUrl.href === newsUrl) {
          return false;
        }

        return path.includes('/news/') || 
               path.includes('/article/') || 
               path.includes('/story/') || 
               path.includes('/press/') || 
               path.includes('/blog/') ||
               path.includes('/media/') ||
               /\/\d{4}\/\d{2}\//.test(path) ||
               path.split('/').filter(p => p).length >= 2;
      } catch {
        return false;
      }
    })
    .slice(0, 50);

  console.log(`🔗 Found ${cleanUrls.length} article URLs via simple HTTP extraction`);
  return cleanUrls;
}

interface DiscoveryResult {
  organizationName: string;
  organizationId: string;
  newsUrl: string;
  urls: string[];
  urlCount: number;
  batchId?: string;
  error?: string;
}

/**
 * Discover URLs ONLY from newsURL pages using simple HTTP extraction
 * Skips Google Search entirely to avoid garbage results
 */
async function discoverNewsUrlOnlyPipeline() {
  console.log('🎯 Starting NewsURL-ONLY discovery pipeline...');
  console.log('   ✅ Using simple HTTP extraction from curated newsURL pages');
  console.log('   ❌ Skipping Google Search (to avoid garbage results)');
  console.log('   ❌ Skipping Firecrawl website mapping\n');

  try {
    // Get organizations with newsUrl configured
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

    const results: DiscoveryResult[] = [];
    let totalUrlsFound = 0;

    for (let i = 0; i < orgsWithNewsUrl.length; i++) {
      const org = orgsWithNewsUrl[i];
      console.log(`[${i + 1}/${orgsWithNewsUrl.length}] 📰 ${org.name}`);
      console.log(`   NewsURL: ${org.newsUrl}`);

      try {
        // Extract URLs using simple HTTP approach only
        const urls = await extractArticleUrlsSimple(org.newsUrl!, org.name);

        // Filter out any existing articles to avoid duplicates
        const existingArticles = await prisma.article.findMany({
          where: {
            url: { in: urls },
            organizationId: org.id
          },
          select: { url: true }
        });

        const existingUrls = new Set(existingArticles.map(a => a.url));
        const newUrls = urls.filter(url => !existingUrls.has(url));

        console.log(`   📊 Found: ${urls.length} total URLs, ${newUrls.length} new URLs`);

        if (newUrls.length > 0) {
          // Create a discovery batch for these URLs
          const batch = await prisma.urlDiscoveryBatch.create({
            data: {
              organizationId: org.id,
              status: 'completed', // Mark as completed since we have the URLs
              timeframe: 365,
              totalUrls: newUrls.length,
              processedUrls: 0,
              discoveredUrls: newUrls,
              startedAt: new Date(),
              discoveredAt: new Date()
            }
          });

          console.log(`   ✅ Created batch ${batch.id} with ${newUrls.length} URLs`);

          results.push({
            organizationName: org.name,
            organizationId: org.id,
            newsUrl: org.newsUrl!,
            urls: newUrls,
            urlCount: newUrls.length,
            batchId: batch.id
          });

          totalUrlsFound += newUrls.length;
        } else {
          console.log(`   ⏭️ No new URLs (all ${urls.length} already exist)`);
          results.push({
            organizationName: org.name,
            organizationId: org.id,
            newsUrl: org.newsUrl!,
            urls: [],
            urlCount: 0
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ Failed: ${errorMessage}`);
        
        results.push({
          organizationName: org.name,
          organizationId: org.id,
          newsUrl: org.newsUrl!,
          urls: [],
          urlCount: 0,
          error: errorMessage
        });
      }

      // Be respectful with requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    const successfulOrgs = results.filter(r => !r.error);
    const orgsWithUrls = results.filter(r => r.urlCount > 0);
    const batchIds = orgsWithUrls.map(r => r.batchId).filter(Boolean);

    console.log('\n🎯 NEWSURL-ONLY DISCOVERY SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`✅ Organizations processed: ${successfulOrgs.length}/${orgsWithNewsUrl.length}`);
    console.log(`📍 Total new URLs found: ${totalUrlsFound}`);
    console.log(`🏢 Organizations with new content: ${orgsWithUrls.length}`);
    console.log(`📦 Batches created: ${batchIds.length}`);
    
    console.log('\n📋 Results by Organization:');
    results.forEach(result => {
      if (result.error) {
        console.log(`   ❌ ${result.organizationName}: ${result.error}`);
      } else if (result.urlCount > 0) {
        console.log(`   ✅ ${result.organizationName}: ${result.urlCount} new URLs → batch ${result.batchId}`);
      } else {
        console.log(`   ⏭️ ${result.organizationName}: 0 new URLs (all existing)`);
      }
    });

    if (batchIds.length > 0) {
      console.log('\n🚀 Next Steps:');
      console.log(`   1. These ${totalUrlsFound} URLs are 100% from curated newsURL pages`);
      console.log(`   2. No garbage from Google Search included`);
      console.log(`   3. Ready to process with bulk-scrape API`);
      console.log(`\n📦 Batch IDs for processing:`);
      batchIds.forEach((batchId, i) => {
        const result = results.find(r => r.batchId === batchId);
        console.log(`   ${i + 1}. ${result?.organizationName}: ${batchId} (${result?.urlCount} URLs)`);
      });

      console.log(`\n🎯 Command to process all batches:`);
      console.log(`   curl -X POST http://localhost:3000/api/process-batches \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"batchIds": [${batchIds.map(id => `"${id}"`).join(', ')}]}'`);
    } else {
      console.log('\n📝 No new URLs found. All discovered content already exists in database.');
    }

    return results;

  } catch (error) {
    console.error('❌ Discovery failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

discoverNewsUrlOnlyPipeline();
