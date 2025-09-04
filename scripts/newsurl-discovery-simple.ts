#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Simple HTTP + regex approach to extract article URLs from news pages
 * This avoids Firecrawl API costs and is more reliable than Google Search
 */
async function extractArticleUrlsFromNewsPage(newsUrl: string, orgName: string): Promise<string[]> {
  try {
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

    // Extract URLs using multiple patterns for different news site structures
    const urlPatterns = [
      // Standard href links
      /href="(https?:\/\/[^"]*(?:news|article|story|press|blog|media)[^"]*?)"/gi,
      // Onclick or data attributes with URLs  
      /(?:onclick|data-href|data-url)="[^"]*?(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi,
      // JSON-LD or script tag URLs
      /"url":\s*"(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi
    ];

    let allUrls = new Set<string>();

    // Apply each pattern
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
          
          // Must be http/https
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return false;
          }
          
          // Avoid non-article paths
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

          // Prefer paths that look like individual articles
          return path.includes('/news/') || 
                 path.includes('/article/') || 
                 path.includes('/story/') || 
                 path.includes('/press/') || 
                 path.includes('/blog/') ||
                 path.includes('/media/') ||
                 /\/\d{4}\/\d{2}\//.test(path) || // Date patterns like /2025/03/
                 path.split('/').filter(p => p).length >= 2; // At least some path depth
        } catch {
          return false;
        }
      })
      .slice(0, 50); // Limit results

    console.log(`🔗 Found ${cleanUrls.length} potential article URLs`);
    
    // Show sample URLs
    if (cleanUrls.length > 0) {
      console.log(`📋 Sample URLs:`);
      cleanUrls.slice(0, 3).forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
      if (cleanUrls.length > 3) {
        console.log(`   ... and ${cleanUrls.length - 3} more`);
      }
    }

    return cleanUrls;

  } catch (error) {
    console.error(`❌ Error processing ${newsUrl}:`, error);
    return [];
  }
}

async function processNewsUrlsSimple() {
  try {
    console.log('🚀 Starting simple newsUrl extraction...\n');
    
    // Get organizations with newsUrl
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

    let totalUrls = 0;
    const results: Array<{
      org: string;
      orgId: string;
      newsUrl: string;
      urlsFound: number;
      urls: string[];
      error?: string;
    }> = [];

    // Process each organization
    for (const org of orgsWithNewsUrl.slice(0, 5)) { // Test with first 5 orgs
      try {
        console.log(`🔄 Processing: ${org.name}`);
        console.log(`   News URL: ${org.newsUrl}\n`);

        const urls = await extractArticleUrlsFromNewsPage(org.newsUrl!, org.name);
        
        results.push({
          org: org.name,
          orgId: org.id,
          newsUrl: org.newsUrl!,
          urlsFound: urls.length,
          urls
        });

        totalUrls += urls.length;
        console.log(`   ✅ Found ${urls.length} URLs for ${org.name}\n`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ Failed: ${errorMsg}\n`);
        
        results.push({
          org: org.name,
          orgId: org.id,
          newsUrl: org.newsUrl!,
          urlsFound: 0,
          urls: [],
          error: errorMsg
        });
      }

      // Be respectful with requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('📊 Summary:');
    console.log(`   Total URLs extracted: ${totalUrls}`);
    console.log(`   Organizations processed: ${results.length}`);
    console.log(`   Success rate: ${results.filter(r => !r.error).length}/${results.length}\n`);

    console.log('📋 Results by organization:');
    results.forEach(result => {
      if (result.error) {
        console.log(`   ❌ ${result.org}: ${result.error}`);
      } else {
        console.log(`   ✅ ${result.org}: ${result.urlsFound} URLs`);
      }
    });

    // Show how to scrape the found URLs
    const allUrls = results.flatMap(r => r.urls);
    if (allUrls.length > 0) {
      console.log(`\n🎯 Next step - scrape these ${allUrls.length} URLs:`);
      console.log(`   Use the existing bulk-scrape API to process these individual article URLs.`);
      console.log(`   This approach gives you curated, high-quality content instead of random Google results!`);
    }

    return results;

  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

processNewsUrlsSimple();
