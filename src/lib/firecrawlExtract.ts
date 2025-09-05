import { z } from 'zod'

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v2'

// Schema for article extraction using Firecrawl Extract
const ArticleExtractionSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "The main title/headline of the article"
    },
    summary: {
      type: "string", 
      description: "A concise 2-3 sentence summary of the article's main points"
    },
    author: {
      type: "string",
      description: "The article author's name, if available"
    },
    publish_date: {
      type: "string",
      description: "Publication date in any recognizable format"
    },
    main_image: {
      type: "string",
      description: "The main article image URL"
    },
    content: {
      type: "string",
      description: "The full article content in clean text format, focusing on the main body text"
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "5-10 relevant keywords or topics from the article"
    },
    organization_mentions: {
      type: "array", 
      items: { type: "string" },
      description: "All mentions of organizations or companies in the article"
    }
  },
  required: ["title", "summary", "content"]
}

export interface ExtractedArticle {
  title: string
  summary: string
  author?: string
  publish_date?: string
  main_image?: string
  content: string
  keywords: string[]
  organization_mentions: string[]
  url: string  // We'll add this from the source
}

export interface FirecrawlExtractResult {
  success: boolean
  data?: ExtractedArticle[]
  error?: string
  jobs?: { url: string, jobId: string }[]
}

/**
 * Extract structured article data from multiple URLs using Firecrawl's /extract endpoint
 */
export async function extractArticlesFromUrls(urls: string[], organizationName?: string): Promise<FirecrawlExtractResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return {
      success: false,
      error: 'FIRECRAWL_API_KEY not configured'
    }
  }

  console.log(`🔥 Using Firecrawl Extract to process ${urls.length} URLs`)
  console.log('📄 All URLs being sent:', urls)
  console.log('🔧 Schema being used:', JSON.stringify(ArticleExtractionSchema, null, 2))

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        urls: urls,
        schema: ArticleExtractionSchema,
        prompt: organizationName 
          ? `Extract article information with special attention to mentions of "${organizationName}"`
          : "Extract article information focusing on news, stories, and content that would be relevant for social impact organizations",
        // Enable web search to get more context if needed
        enableWebSearch: false // Keep false to avoid extra charges unless needed
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🚨 Firecrawl Extract API Error:', response.status, errorText)
      return {
        success: false,
        error: `Firecrawl Extract failed: ${response.status} - ${errorText}`
      }
    }

    const result = await response.json()
    console.log('📊 Firecrawl Extract response:', JSON.stringify(result, null, 2))
    
    // Check if we got a job ID (for async processing) - Firecrawl uses 'id' field
    if (result.id && !result.data) {
      console.log(`⏳ Extract job started with ID: ${result.id}`)
      return {
        success: true,
        jobId: result.id,
        data: []
      }
    }

    // Check if we got immediate results
    if (result.success && result.data) {
      console.log(`✅ Extract completed: ${Array.isArray(result.data) ? result.data.length : 1} articles extracted`)
      
      // Normalize the response - could be single object or array
      let articles = Array.isArray(result.data) ? result.data : [result.data]
      
      // Add source URLs to each article (1:1 mapping only)
      articles = articles
        .map((article: any, index: number) => {
          // Only map if we have a corresponding URL at this index
          if (index < urls.length) {
            return {
              ...article,
              url: urls[index],
              keywords: article.keywords || [],
              organization_mentions: article.organization_mentions || []
            }
          }
          return null
        })
        .filter(Boolean) // Remove null entries
        
      console.log(`🔗 Immediate extraction: mapped ${articles.length} articles to URLs`)

      return {
        success: true,
        data: articles
      }
    }

    // If we got a job ID but no immediate data, it's async processing
    if (result.success && result.id) {
      console.log(`⏳ Extract job queued with ID: ${result.id}`)
      return {
        success: true,
        jobId: result.id,
        data: []
      }
    }

    // If we get here, something unexpected happened
    console.error('❌ Unexpected Extract response:', result)
    return {
      success: false,
      error: 'Unexpected response format from Firecrawl Extract'
    }

  } catch (error) {
    console.error('🚨 Extract request failed:', error)
    return {
      success: false,
      error: `Extract request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Check the status of an extract job
 */
export async function getExtractJobStatus(jobId: string): Promise<FirecrawlExtractResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return {
      success: false,
      error: 'FIRECRAWL_API_KEY not configured'
    }
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/extract/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to get job status: ${response.status} - ${errorText}`
      }
    }

    const result = await response.json()
    console.log(`📊 Job status response:`, JSON.stringify(result, null, 2))
    
    if (result.status === 'completed' && result.success && result.data) {
      console.log(`✅ Extract job ${jobId} completed: ${Array.isArray(result.data) ? result.data.length : 1} articles`)
      
      let articles = Array.isArray(result.data) ? result.data : [result.data]
      console.log(`📄 Articles data:`, articles.map((a: any) => ({ title: a.title, hasContent: !!a.content, url: a.url })))
      
      return {
        success: true,
        data: articles
      }
    }
    
    if (result.status === 'processing') {
      console.log(`⏳ Extract job ${jobId} still processing...`)
      return {
        success: true,
        data: []
      }
    }
    
    if (result.status === 'failed') {
      return {
        success: false,
        error: `Extract job failed: ${result.error || 'Unknown error'}`
      }
    }

    return {
      success: false,
      error: `Unexpected job status: ${result.status}`
    }

  } catch (error) {
    return {
      success: false,
      error: `Failed to check job status: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
