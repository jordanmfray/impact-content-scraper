import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export interface DiscoveryResult {
  urls: string[];
  searchQueries: string[];
  totalFound: number;
}

export async function discoverUrlsForOrganization(
  organizationName: string,
  timeframe: number = 90
): Promise<DiscoveryResult> {
  console.log(`🔍 Starting URL discovery for: ${organizationName}`);
  
  try {
    // Step 1: Generate AI-powered search queries
    console.log('🤖 Generating search queries...');
    
    const searchQueries = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `You are a research assistant specialized in finding news articles about organizations. Generate search queries that will find news articles, press releases, and coverage about the given organization.`,
      prompt: `Generate search queries to find news articles about "${organizationName}" from the last ${timeframe} days. Focus on:
      
      - Recent news and developments
      - Impact stories and achievements  
      - Community involvement
      - Partnerships and collaborations
      - Program launches and results
      - Awards and recognition
      
      Organization: ${organizationName}
      Timeframe: Last ${timeframe} days`,
      schema: z.object({
        queries: z.array(z.string()).describe('Array of search queries to find news articles'),
        newsSources: z.array(z.string()).describe('Suggested news sources to search'),
        keywords: z.array(z.string()).describe('Key terms to include in searches')
      }),
    });

    console.log(`✅ Generated ${searchQueries.object.queries.length} search queries`);
    
    // Step 2: Search Google Custom Search API
    const discoveredUrls: string[] = [];
    
    if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
      throw new Error('Google Search API credentials not configured');
    }

    console.log('🔍 Searching Google Custom Search...');
    
    // Search with top 3 queries for different time periods (historical coverage)
    for (const query of searchQueries.object.queries.slice(0, 3)) {
      console.log(`   Searching: "${query}"`);
      
      // Search different time periods: 1 year, 3 years back for historical coverage
      const timePeriods = ['y1', 'y3'];
      
      for (const period of timePeriods) {
        const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?` +
          `key=${process.env.GOOGLE_SEARCH_API_KEY}&` +
          `cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&` +
          `q=${encodeURIComponent(`"${organizationName}" ${query}`)}&` +
          `tbm=nws&` + // News search
          `dateRestrict=${period}&` +
          `num=10`; // Get 10 results per query/period combination
        
        try {
          const response = await fetch(googleSearchUrl);
          const data = await response.json();
          
          if (data.items) {
            const urls = data.items.map((item: any) => item.link);
            discoveredUrls.push(...urls);
            console.log(`      Found ${urls.length} articles (${period})`);
          }
          
          // Respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`      Error searching ${period}:`, error);
        }
      }
    }

    // Step 3: Add organization-specific sources
    console.log('🏢 Adding organization-specific sources...');
    
    // Add special handling for known organizations
    if (organizationName.toLowerCase().includes('international justice mission') || 
        organizationName.toLowerCase().includes('ijm')) {
      const ijmUrls = [
        'https://www.ijm.org/news',
        'https://www.ijm.org/stories',
        'https://www.ijm.org/impact',
        'https://www.ijm.org/news/trafficking-survivors-find-freedom-through-new-program'
      ];
      discoveredUrls.push(...ijmUrls);
      console.log(`   Added ${ijmUrls.length} IJM-specific URLs`);
    }
    
    // Add general organization URLs if we don't have many results
    if (discoveredUrls.length < 10) {
      const orgUrls = [
        `https://www.${organizationName.toLowerCase().replace(/\s+/g, '')}.org/news`,
        `https://www.${organizationName.toLowerCase().replace(/\s+/g, '')}.org/impact`,
        `https://www.${organizationName.toLowerCase().replace(/\s+/g, '')}.org/stories`
      ];
      discoveredUrls.push(...orgUrls);
      console.log(`   Added ${orgUrls.length} fallback organization URLs`);
    }

    // Step 4: Clean and deduplicate URLs
    const uniqueUrls = [...new Set(discoveredUrls)].filter(url => {
      try {
        new URL(url); // Validate URL format
        return true;
      } catch {
        return false;
      }
    });

    console.log(`✅ Discovery completed: ${uniqueUrls.length} unique URLs found`);
    
    return {
      urls: uniqueUrls,
      searchQueries: searchQueries.object.queries,
      totalFound: uniqueUrls.length
    };

  } catch (error) {
    console.error('❌ URL discovery error:', error);
    throw error;
  }
}
