const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1'

// Schema for structured article extraction (optimized for reliability)
const ArticleSchema = {
  type: "object",
  properties: {
    title: {
      type: "string", 
      description: "The main title/headline of the article"
    },
    summary: {
      type: "string", 
      description: "A concise summary of the article's main points"
    },
    publish_date: {
      type: "string", 
      description: "Publication date (YYYY-MM-DD format preferred)"
    },
    author: {
      type: "string", 
      description: "The article author's name, if available"
    },
    main_image_url: {
      type: "string", 
      description: "The main article image URL"
    },
    images: {
      type: "array",
      items: { type: "string" },
      description: "Array of all image URLs found on the page that could be used as article images"
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "5-10 relevant keywords or topics from the article"
    },
    sentiment: {
      type: "string",
      enum: ["positive", "neutral", "negative"],
      description: "Overall sentiment/tone of the article"
    },
    content: {
      type: "string", 
      description: "The full article content in clean text format"
    },
    body_markdown: {
      type: "string", 
      description: "Only the main article body content in markdown format, excluding title and metadata. Should start with the first paragraph of actual article content."
    }
  },
  required: ["title", "summary"]
}

// New function using Firecrawl JSON mode for structured extraction
export async function firecrawlExtractStructured(url: string, organizationName?: string) {
  try {
    // Check if API key is available
    if (!process.env.FIRECRAWL_API_KEY) {
      return {
        success: false,
        error: 'FIRECRAWL_API_KEY not configured',
        title: null,
        content: null,
        summary: null,
        keywords: [],
        ogImage: null,
        images: []
      }
    }

  console.log('🔥 Using Firecrawl JSON mode to extract structured data from:', url)
  console.log('🔧 Sending request with schema:', JSON.stringify(ArticleSchema, null, 2))
  
  const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ 
      url: url,
      formats: ['extract', 'markdown'],
      extract: {
        schema: ArticleSchema
      },
      onlyMainContent: true,
      waitFor: 2000,
      timeout: 30000,
      maxAge: 604800000  // 1 week cache (7 * 24 * 60 * 60 * 1000)
    }),
  })

  if (!r.ok) {
    const errorText = await r.text()
    console.error('🚨 Firecrawl JSON API Error:', r.status, errorText)
    return {
      success: false,
      error: `Firecrawl API failed: ${r.status} - ${errorText}`,
      title: null,
      content: null,
      summary: null,
      keywords: [],
      ogImage: null,
      images: []
    }
  }

  const result = await r.json()
  console.log('✅ Firecrawl structured extraction successful')
  
  // The result has the structured data in extract property
  const extractedData = result.data?.extract
  const rawMarkdown = result.data?.markdown || ''
  
  if (!extractedData || !extractedData.title) {
    console.error('❌ Failed to extract structured data, received:', JSON.stringify(result, null, 2))
    return {
      success: false,
      error: 'Failed to extract structured data from article - no title found',
      title: null,
      content: null,
      summary: null,
      keywords: [],
      ogImage: null,
      images: []
    }
  }

  // Check for error page indicators in the raw content
  const errorCheck = detectErrorPageInContent(extractedData.title, extractedData.summary || '', rawMarkdown, url)
  if (!errorCheck.isValid) {
    console.error('❌ Detected error page or hallucinated content:', errorCheck.reasons.join('; '))
    return {
      success: false,
      error: `Error page detected: ${errorCheck.reasons[0]}`,
      title: null,
      content: null,
      summary: null,
      keywords: [],
      ogImage: null,
      images: []
    }
  }

  console.log(`✅ Firecrawl extracted: "${extractedData.title}"`)
  console.log(`📊 Summary: ${extractedData.summary?.substring(0, 100)}...`)
  console.log(`👤 Author: ${extractedData.author || 'N/A'}`)
  console.log(`📅 Published: ${extractedData.publishedAt || 'N/A'}`)
  console.log(`🔑 Keywords: ${extractedData.keywords?.length || 0}`)
  console.log(`📝 Body markdown length: ${result.data?.markdown?.length || 0} characters`)

  // Sanitize all text content to remove null bytes and other problematic characters
  const sanitizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .trim();
  };

  return {
    success: true,
    data: {
      ...extractedData,
      title: sanitizeText(extractedData.title),
      summary: sanitizeText(extractedData.summary),
      content: sanitizeText(extractedData.content),
      author: sanitizeText(extractedData.author),
      // Include body markdown from structured extraction or fallback to separate markdown format
      body_markdown: sanitizeText(extractedData.body_markdown || result.data?.markdown || '')
    },
    metadata: result.data?.metadata || {},
    title: sanitizeText(extractedData.title),
    content: sanitizeText(extractedData.body_markdown || result.data?.markdown || ''),
    summary: sanitizeText(extractedData.summary),
    keywords: extractedData.keywords || [],
    ogImage: extractedData.main_image_url || null,
    images: extractedData.images || []
  }

  } catch (error) {
    console.error('🚨 Unexpected error in firecrawlExtractStructured:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      title: null,
      content: null,
      summary: null,
      keywords: [],
      ogImage: null,
      images: []
    }
  }
}

export async function firecrawlSearch(query: string) {
  const r = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ query, scrapeOptions: { formats: [{ type: 'markdown' }] } }),
  })
  if (!r.ok) throw new Error(`Firecrawl search failed: ${r.status}`)
  return r.json() as Promise<{ items: { url: string; title?: string; description?: string }[] }>
}

export async function firecrawlExtract(urls: string[]) {
  // Check if API key is available
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured')
  }

  console.log('🔥 Using Firecrawl to extract content from:', urls[0])
  
  const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ 
      url: urls[0],
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 2000,
      timeout: 30000,
      actions: [],
      extractorOptions: {
        mode: 'markdown'
      }
    }),
  })

  if (!r.ok) {
    const errorText = await r.text()
    console.error('🚨 Firecrawl API Error:', r.status, errorText)
    throw new Error(`Firecrawl extract failed: ${r.status} - ${errorText}`)
  }

  const result = await r.json()
  console.log('✅ Firecrawl extraction successful, content length:', result.data?.markdown?.length || 0)
  
  // Sanitize content to remove null bytes and problematic characters
  const sanitizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .trim();
  };

  const sanitizedContent = sanitizeText(result.data?.markdown || '');

  // Return format matching what the pipeline expects
  return {
    data: [{
      markdown: sanitizedContent,
      content: sanitizedContent, // Use markdown as content
      text: sanitizedContent, // Also provide as text
      title: sanitizeText(result.data?.metadata?.title || ''),
      description: sanitizeText(result.data?.metadata?.description || '')
    }]
  }
}

// Enhanced HTTP fallback with better content extraction
export async function enhancedHttpExtract(url: string) {
  console.log('🌐 Using enhanced HTTP extraction for:', url)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extract og:image and other images
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    const ogImage = ogImageMatch?.[1] || null;
    
    // Extract all images from HTML with size information
    const imageMatches = html.match(/<img[^>]*>/gi) || [];
    const imagesWithSize = imageMatches
      .map(imgTag => {
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
        const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);
        const altMatch = imgTag.match(/alt=["']([^"']+)["']/i);
        
        const src = srcMatch?.[1];
        const width = widthMatch ? parseInt(widthMatch[1]) : 0;
        const height = heightMatch ? parseInt(heightMatch[1]) : 0;
        const alt = altMatch?.[1] || '';
        
        // Calculate area (0 if no dimensions specified)
        const area = width && height ? width * height : 0;
        
        return {
          src,
          width,
          height, 
          area,
          alt: alt.toLowerCase()
        };
      })
      .filter(img => img.src && img.src.startsWith('http')) // Only full URLs
      .filter(img => {
        // Filter out obvious icons and tiny images
        if (img.area > 0 && img.area < 1000) return false; // Less than 32x32 pixels
        if (img.alt.includes('icon') || img.alt.includes('logo') || img.alt.includes('button')) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by area (largest first), then by content quality indicators
        if (a.area !== b.area) return b.area - a.area;
        
        // Prioritize images with content-related alt text
        const aIsContent = a.alt.includes('photo') || a.alt.includes('image') || a.alt.includes('picture') || a.alt.includes('story');
        const bIsContent = b.alt.includes('photo') || b.alt.includes('image') || b.alt.includes('picture') || b.alt.includes('story');
        if (aIsContent && !bIsContent) return -1;
        if (bIsContent && !aIsContent) return 1;
        
        // Prioritize images with better file extensions (jpg/png over gif/svg)
        const aGoodExt = a.src?.match(/\.(jpe?g|png|webp)$/i);
        const bGoodExt = b.src?.match(/\.(jpe?g|png|webp)$/i);
        if (aGoodExt && !bGoodExt) return -1;
        if (bGoodExt && !aGoodExt) return 1;
        
        return 0;
      })
      .slice(0, 10); // Take top 10
    
    const images = imagesWithSize.map(img => img.src).filter((src): src is string => !!src);

    // Extract main content using multiple strategies
    let content = ''
    
    // Strategy 1: Look for common article containers
    const articleSelectors = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class=["\'][^"']*content[^"']*["\'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class=["\'][^"']*article[^"']*["\'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class=["\'][^"']*post[^"']*["\'][^>]*>([\s\S]*?)<\/div>/gi,
      /<main[^>]*>([\s\S]*?)<\/main>/gi
    ]

    for (const selector of articleSelectors) {
      const matches = html.match(selector)
      if (matches && matches[0].length > content.length) {
        content = matches[0]
        break
      }
    }

    // Strategy 2: If no article found, extract paragraphs
    if (!content || content.length < 200) {
      const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
      content = paragraphs.slice(0, 10).join('\n')
    }

    // Clean up HTML tags and decode entities
    content = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    // Sanitize all content to remove problematic characters
    const sanitizeText = (text: string): string => {
      return text
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
        .trim();
    };

    const sanitizedContent = sanitizeText(content);
    const sanitizedTitle = sanitizeText(title);
    const sanitizedDescription = sanitizeText(description);

    console.log(`✅ Enhanced HTTP extraction completed: ${sanitizedContent.length} characters`)
    console.log(`🖼️ Enhanced HTTP extracted ${images.length} images${ogImage ? ' + og:image' : ''} (sorted by size from ${imageMatches.length} total)`)
    
    return {
      data: [{
        markdown: sanitizedContent,
        content: sanitizedContent,
        title: sanitizedTitle,
        description: sanitizedDescription,
        ogImage: ogImage,
        images: images
      }]
    }

  } catch (error) {
    console.error('🚨 Enhanced HTTP extraction failed:', error)
    throw error
  }
}

/**
 * Detect error pages and hallucinated content early in the scraping process
 */
function detectErrorPageInContent(title: string, summary: string, content: string, url: string): { isValid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lowerTitle = title.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  const lowerContent = content.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Check for explicit error page indicators
  const errorPatterns = [
    'error 404',
    'page not found',
    'page doesn\'t exist',
    'page does not exist',
    'oops, it looks like',
    'we can\'t find that page',
    'the page you are looking for',
    'sorry, but this page doesn\'t exist',
    'this page is not available',
    'content not found'
  ];

  for (const pattern of errorPatterns) {
    if (lowerContent.includes(pattern) || lowerTitle.includes(pattern) || lowerSummary.includes(pattern)) {
      reasons.push(`Detected error page pattern: "${pattern}"`);
      return { isValid: false, reasons };
    }
  }

  // Check for hallucinated/generic content patterns that indicate AI fabrication
  const hallucinationPatterns = [
    'latest updates from',
    'recent developments and initiatives',
    'continues to focus on innovation',
    'discusses recent developments',
    'this article discusses recent'
  ];

  const hasHallucinatedContent = hallucinationPatterns.some(pattern => 
    lowerTitle.includes(pattern) || lowerSummary.includes(pattern)
  );

  // Check for overly generic titles that suggest fabrication
  const genericTitles = [
    'latest updates',
    'recent updates',
    'latest news',
    'recent news'
  ];

  const hasGenericTitle = genericTitles.some(pattern => lowerTitle.includes(pattern));

  if (hasHallucinatedContent) {
    reasons.push(`Content appears to be AI-generated/hallucinated rather than scraped`);
    return { isValid: false, reasons };
  }

  if (hasGenericTitle) {
    reasons.push(`Title is too generic, suggesting fabricated content`);
    return { isValid: false, reasons };
  }

  // Check for insufficient content length (likely fabricated if too short)
  if (content.length < 100) {
    reasons.push(`Content too short, likely error page or fabricated content`);
    return { isValid: false, reasons };
  }

  // Check URL for error indicators
  if (lowerUrl.includes('error') || lowerUrl.includes('404') || lowerUrl.includes('not-found')) {
    reasons.push(`URL suggests this is an error page`);
    return { isValid: false, reasons };
  }

  return { isValid: true, reasons: [] };
}

// New function to map organization website and find news/media URLs
export async function discoverOrganizationNewsUrls(websiteUrl: string, organizationName: string): Promise<string[]> {
  console.log(`🗺️ Mapping website structure for ${organizationName}: ${websiteUrl}`)

  try {
    // Step 1: Map the entire website to get all URLs
    const mapResponse = await fetch(`${FIRECRAWL_BASE}/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url: websiteUrl,
        search: `news articles blog press releases media ${organizationName}`,
        ignoreSitemap: false,
        limit: 50  // Reduced from 500 to save credits
      })
    })

    if (!mapResponse.ok) {
      throw new Error(`Firecrawl map failed: ${mapResponse.status} ${mapResponse.statusText}`)
    }

    const mapData = await mapResponse.json()
    console.log(`📍 Found ${mapData.links?.length || 0} URLs on ${websiteUrl}`)

    if (!mapData.links || mapData.links.length === 0) {
      console.log('❌ No URLs found during mapping')
      return []
    }

    // Step 2: Filter URLs that look like news/media content
    const newsPatterns = [
      /\/news\//i,
      /\/media\//i, 
      /\/blog\//i,
      /\/press\//i,
      /\/stories\//i,
      /\/articles\//i,
      /\/updates\//i,
      /\/announcements\//i,
      /\/releases\//i
    ]

    const potentialNewsUrls = mapData.links.filter((url: string) => {
      // Skip listing pages and archives
      if (url.includes('?') || url.includes('#') || url.includes('/page/') || url.includes('/archive/')) {
        return false
      }
      
      // Check if URL matches news patterns
      return newsPatterns.some(pattern => pattern.test(url))
    })

    console.log(`📰 Found ${potentialNewsUrls.length} potential news URLs`)
    console.log(`   Sample URLs: ${potentialNewsUrls.slice(0, 3).join(', ')}`)

    // Step 3: If we found specific news URLs, return them
    if (potentialNewsUrls.length > 0) {
      return potentialNewsUrls.slice(0, 50) // Limit to 50 URLs
    }

    // Step 4: Fallback - look for any URLs containing organization name or news keywords
    const fallbackUrls = mapData.links.filter((url: string) => {
      const urlLower = url.toLowerCase()
      const orgNameLower = organizationName.toLowerCase()
      
      return (
        urlLower.includes(orgNameLower) ||
        urlLower.includes('news') ||
        urlLower.includes('press') ||
        urlLower.includes('blog') ||
        urlLower.includes('story') ||
        urlLower.includes('update')
      )
    }).slice(0, 30)

    console.log(`🔄 Fallback found ${fallbackUrls.length} URLs with relevant keywords`)
    return fallbackUrls

  } catch (error) {
    console.error('❌ Error during website mapping:', error)
    return []
  }
}

// Enhanced function to crawl organization's news section systematically
export async function crawlOrganizationNewsSection(websiteUrl: string, organizationName: string): Promise<string[]> {
  console.log(`🕸️ Crawling news section for ${organizationName}: ${websiteUrl}`)

  try {
    // Common news section paths to try
    const newsSectionPaths = [
      '/news',
      '/media', 
      '/blog',
      '/press',
      '/stories',
      '/articles',
      '/updates',
      '/press-releases',
      '/newsroom'
    ]

    const baseUrl = new URL(websiteUrl).origin
    const discoveredUrls: string[] = []

    // Try crawling each potential news section
    for (const path of newsSectionPaths) {
      const crawlUrl = `${baseUrl}${path}`
      console.log(`🔍 Attempting to crawl: ${crawlUrl}`)

      try {
        const crawlResponse = await fetch(`${FIRECRAWL_BASE}/crawl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
          },
          body: JSON.stringify({
            url: crawlUrl,
            limit: 20,
            scrapeOptions: {
              formats: ['links']
            },
            webhook: null // Synchronous crawl
          })
        })

        if (crawlResponse.ok) {
          const crawlData = await crawlResponse.json()
          const foundUrls = crawlData.data?.map((item: any) => item.metadata?.sourceURL).filter(Boolean) || []
          discoveredUrls.push(...foundUrls)
          console.log(`✅ Found ${foundUrls.length} URLs in ${path}`)
        }
      } catch (error) {
        console.log(`⚠️ Failed to crawl ${crawlUrl}:`, error)
        continue
      }
    }

    // Remove duplicates and filter for article-like URLs
    const uniqueUrls = [...new Set(discoveredUrls)].filter(url => {
      // Filter out listing pages, archives, etc.
      return !url.includes('?page=') && 
             !url.includes('#') && 
             !url.includes('/tag/') &&
             !url.includes('/category/') &&
             url.length > baseUrl.length + 10 // Must be more than just the base path
    })

    console.log(`📑 Discovered ${uniqueUrls.length} unique article URLs from crawling`)
    return uniqueUrls.slice(0, 50) // Limit results

  } catch (error) {
    console.error('❌ Error during news section crawling:', error)
    return []
  }
}
