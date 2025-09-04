#!/usr/bin/env tsx
import { extractArticleUrlsFromNewsPage } from '../src/lib/newsUrlExtractor';

async function testNewsUrlExtraction() {
  try {
    console.log('🧪 Testing simple HTTP + AI approach for news URL extraction...\n');

    // Test with Safe House Project press page
    const testUrl = 'https://www.safehouseproject.org/press/';
    const orgName = 'Safe House Project';

    console.log(`📰 Testing with: ${orgName}`);
    console.log(`🔗 News URL: ${testUrl}\n`);

    const startTime = Date.now();
    const urls = await extractArticleUrlsFromNewsPage(testUrl, orgName);
    const endTime = Date.now();

    console.log(`\n⏱️  Extraction completed in ${endTime - startTime}ms`);
    console.log(`📊 Results:`);
    console.log(`   ✅ URLs found: ${urls.length}`);
    
    if (urls.length > 0) {
      console.log(`\n📋 Extracted URLs:`);
      urls.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
    } else {
      console.log(`\n❌ No URLs extracted`);
    }

    console.log(`\n🎯 Next step would be to scrape these ${urls.length} URLs individually using the existing bulk-scrape API.`);
    console.log(`   This approach is:`);
    console.log(`   ✅ Simple - just HTTP + AI`);
    console.log(`   ✅ Reliable - no external API dependencies`);
    console.log(`   ✅ Cost-effective - uses your curated newsUrl`);
    console.log(`   ✅ Targeted - focuses on actual articles, not random Google results`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testNewsUrlExtraction();
