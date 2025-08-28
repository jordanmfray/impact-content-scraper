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
export async function firecrawlExtractStructured(url: string) {
  // Check if API key is available
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured')
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
    throw new Error(`Firecrawl structured extract failed: ${r.status} - ${errorText}`)
  }

  const result = await r.json()
  console.log('✅ Firecrawl structured extraction successful')
  
  // The result has the structured data in extract property
  const extractedData = result.data?.extract
  
  if (!extractedData || !extractedData.title) {
    console.error('❌ Failed to extract structured data, received:', JSON.stringify(result, null, 2))
    throw new Error('Failed to extract structured data from article')
  }

  console.log(`✅ Firecrawl extracted: "${extractedData.title}"`)
  console.log(`📊 Summary: ${extractedData.summary?.substring(0, 100)}...`)
  console.log(`👤 Author: ${extractedData.author || 'N/A'}`)
  console.log(`📅 Published: ${extractedData.publishedAt || 'N/A'}`)
  console.log(`🔑 Keywords: ${extractedData.keywords?.length || 0}`)
  console.log(`📝 Body markdown length: ${result.data?.markdown?.length || 0} characters`)

  return {
    data: {
      ...extractedData,
      // Include body markdown from structured extraction or fallback to separate markdown format
      body_markdown: extractedData.body_markdown || result.data?.markdown || ''
    },
    metadata: result.data?.metadata || {}
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
  
  // Return format matching what the pipeline expects
  return {
    data: [{
      markdown: result.data?.markdown || '',
      content: result.data?.markdown || '', // Use markdown as content
      text: result.data?.markdown || '', // Also provide as text
      title: result.data?.metadata?.title || '',
      description: result.data?.metadata?.description || ''
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

    console.log(`✅ Enhanced HTTP extraction completed: ${content.length} characters`)
    
    return {
      data: [{
        markdown: content,
        content: content,
        title: title,
        description: description
      }]
    }

  } catch (error) {
    console.error('🚨 Enhanced HTTP extraction failed:', error)
    throw error
  }
}
