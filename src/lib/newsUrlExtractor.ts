import { openai } from './openai';
import { z } from 'zod';

/**
 * Extract individual article URLs from a news/press page using AI
 */
export async function extractArticleUrlsFromNewsPage(
  newsPageUrl: string,
  organizationName: string
): Promise<string[]> {
  console.log(`📄 Fetching news page: ${newsPageUrl}`);
  
  try {
    // Step 1: Fetch the news page HTML
    const response = await fetch(newsPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0; +https://example.com/bot)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`📊 Fetched ${html.length} characters from ${newsPageUrl}`);

    // Step 2: Use AI to extract individual article URLs
    const aiResponse = await openai('gpt-4o-mini').generateObject({
      system: `You are an expert at extracting article URLs from news/press pages. 
      
Your task is to find individual article URLs from the HTML content of a news or press page.

WHAT TO EXTRACT:
- Individual news article URLs
- Individual blog post URLs  
- Individual press release URLs
- Individual story/announcement URLs

WHAT TO IGNORE:
- Navigation links (About, Contact, etc.)
- Social media links
- Category/tag pages
- Archive pages with query parameters (?page=, ?category=)
- Image URLs
- JavaScript/CSS files
- The news page URL itself

REQUIREMENTS:
- Return only HTTP/HTTPS URLs
- Prefer absolute URLs, convert relative URLs to absolute using the base domain
- Focus on recent content (ignore very old archives)
- Maximum 50 URLs to avoid overwhelming the system

Return the URLs as a clean array.`,
      
      prompt: `Extract individual article URLs from this ${organizationName} news/press page:

Base URL: ${newsPageUrl}
Organization: ${organizationName}

HTML Content:
${html.substring(0, 12000)}${html.length > 12000 ? '\n\n[Content truncated...]' : ''}

Find all individual article/story/press release URLs from this page.`,
      
      schema: z.object({
        articleUrls: z.array(z.string().url()).describe('Array of individual article URLs found on the page'),
        totalFound: z.number().describe('Total number of article URLs found'),
        reasoning: z.string().describe('Brief explanation of what types of links were found')
      }),
    });

    const result = aiResponse.object;
    console.log(`🔍 AI found ${result.totalFound} article URLs`);
    console.log(`💡 AI reasoning: ${result.reasoning}`);

    // Step 3: Clean and validate URLs
    const cleanUrls = result.articleUrls
      .filter(url => {
        try {
          const parsedUrl = new URL(url);
          // Basic validation - must be http/https
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return false;
          }
          // Avoid common non-article paths
          const path = parsedUrl.pathname.toLowerCase();
          if (path.includes('/category/') || 
              path.includes('/tag/') || 
              path.includes('/page/') ||
              path.includes('/archive/') ||
              path === '/' || 
              path === newsPageUrl) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, 50); // Limit to 50 URLs

    console.log(`✅ Returning ${cleanUrls.length} clean article URLs`);
    
    // Log a sample of URLs for debugging
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
    console.error(`❌ Error extracting URLs from ${newsPageUrl}:`, error);
    throw error;
  }
}

/**
 * Process multiple organizations' news pages
 */
export async function extractUrlsFromMultipleNewsPages(
  newsPages: Array<{ organizationName: string; newsUrl: string }>
): Promise<Array<{ organizationName: string; urls: string[]; error?: string }>> {
  const results: Array<{ organizationName: string; urls: string[]; error?: string }> = [];

  for (const { organizationName, newsUrl } of newsPages) {
    try {
      console.log(`\n🔄 Processing: ${organizationName}`);
      const urls = await extractArticleUrlsFromNewsPage(newsUrl, organizationName);
      results.push({
        organizationName,
        urls
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process ${organizationName}: ${errorMessage}`);
      results.push({
        organizationName,
        urls: [],
        error: errorMessage
      });
    }

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
