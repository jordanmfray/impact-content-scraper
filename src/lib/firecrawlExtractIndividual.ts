import { z } from 'zod'

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1'

const ArticleExtractionSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "The main title/headline of the article"
    },
    summary: {
      type: "string", 
      description: "A brief summary of the article content (2-3 sentences)"
    },
    content: {
      type: "string",
      description: "The main body content of the article in markdown format"
    },
    keywords: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Key topics, themes, or important terms mentioned in the article"
    },
    organization_mentions: {
      type: "array", 
      items: {
        type: "string"
      },
      description: "Direct quotes or specific mentions of organizations in the article"
    },
    publish_date: {
      type: "string",
      description: "Publication date in any recognizable format (ISO date preferred, e.g. 2024-01-15 or January 15, 2024)"
    },
    author: {
      type: "string",
      description: "The article author's name, if available"
    }
  },
  required: ["title", "content", "summary", "keywords", "organization_mentions"],
  additionalProperties: false
}

export interface ExtractedArticle {
  title: string
  summary: string
  content: string
  keywords: string[]
  organization_mentions: string[]
  publish_date?: string
  author?: string
  url: string  // We'll add this from the source
}

export interface FirecrawlExtractResult {
  success: boolean
  data?: ExtractedArticle[]
  error?: string
  jobs?: { url: string, jobId: string }[]
}

/**
 * Extract structured article data from URLs individually using Firecrawl's /extract endpoint
 * Each URL is processed as a separate job to ensure proper 1:1 mapping
 */
export async function extractArticlesFromUrls(urls: string[], organizationName?: string): Promise<FirecrawlExtractResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return {
      success: false,
      error: 'FIRECRAWL_API_KEY not configured'
    }
  }

  console.log(`🔥 Using Firecrawl Extract to process ${urls.length} URLs individually`)
  console.log('📄 URLs to process:', urls.map((url, i) => `${i}: ${url}`).join('\n'))
  console.log('🔧 Schema being used:', JSON.stringify(ArticleExtractionSchema, null, 2))

  const jobs: { url: string, jobId: string }[] = []
  const errors: string[] = []

  // Submit each URL as a separate extraction job
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    console.log(`📤 Submitting job ${i + 1}/${urls.length}: ${url}`)
    
    try {
      const response = await fetch(`${FIRECRAWL_BASE}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify({
          urls: [url], // Single URL per job
          schema: ArticleExtractionSchema,
          prompt: organizationName 
            ? `Extract article information with special attention to mentions of "${organizationName}"`
            : "Extract article information focusing on news, stories, and content that would be relevant for social impact organizations",
          enableWebSearch: false
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`🚨 Job ${i + 1} failed:`, response.status, errorText)
        errors.push(`Job ${i + 1} (${url}): ${response.status} - ${errorText}`)
        continue
      }

      const result = await response.json()
      console.log(`📊 Job ${i + 1} response:`, JSON.stringify(result, null, 2))
      
      // Check if we got a job ID (async processing)
      if (result.id) {
        console.log(`✅ Job ${i + 1} queued with ID: ${result.id}`)
        jobs.push({ url, jobId: result.id })
      } else if (result.success && result.data) {
        // Immediate result - this shouldn't happen with Extract but handle it
        console.log(`⚡ Job ${i + 1} completed immediately`)
        const articles = Array.isArray(result.data) ? result.data : [result.data]
        return {
          success: true,
          data: articles.map((article: any) => ({ 
            ...article, 
            url, 
            keywords: article.keywords || [], 
            organization_mentions: article.organization_mentions || [] 
          }))
        }
      } else {
        console.error(`🚨 Job ${i + 1} unexpected response:`, result)
        errors.push(`Job ${i + 1} (${url}): Unexpected response format`)
      }

      // Add small delay between job submissions to be nice to the API
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

    } catch (error) {
      console.error(`🚨 Job ${i + 1} error:`, error)
      errors.push(`Job ${i + 1} (${url}): ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (jobs.length === 0) {
    return {
      success: false,
      error: `All extraction jobs failed: ${errors.join('; ')}`
    }
  }

  console.log(`✅ Submitted ${jobs.length}/${urls.length} extraction jobs successfully`)
  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} jobs failed:`, errors.join('; '))
  }

  return {
    success: true,
    jobs: jobs,
    data: []
  }
}

/**
 * Poll multiple extraction jobs and collect results
 */
export async function pollAllExtractJobs(jobs: { url: string, jobId: string }[]): Promise<{ success: boolean, data: ExtractedArticle[], errors: string[] }> {
  console.log(`🔄 Polling ${jobs.length} extraction jobs...`)
  
  const results: ExtractedArticle[] = []
  const errors: string[] = []
  
  // Poll each job with timeout
  const maxAttempts = 60 // 2 minutes
  const pollInterval = 2000 // 2 seconds
  
  const jobPromises = jobs.map(async ({ url, jobId }) => {
    console.log(`📊 Starting to poll job ${jobId} for ${url}`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
        const jobStatus = await getExtractJobStatus(jobId)
        
        if (jobStatus.success && jobStatus.data && jobStatus.data.length > 0) {
          console.log(`✅ Job ${jobId} completed: ${jobStatus.data.length} articles`)
          const articles = jobStatus.data.map((article: any) => ({
            ...article,
            url,
            keywords: article.keywords || [],
            organization_mentions: article.organization_mentions || []
          }))
          results.push(...articles)
          return
        } else if (!jobStatus.success && jobStatus.error?.includes('failed')) {
          console.error(`❌ Job ${jobId} failed: ${jobStatus.error}`)
          errors.push(`${url}: ${jobStatus.error}`)
          return
        }
        
        // Still processing, continue polling
        if (attempt % 10 === 0) {
          console.log(`⏳ Job ${jobId} still processing (attempt ${attempt}/${maxAttempts})...`)
        }
        
      } catch (error) {
        console.error(`🚨 Error polling job ${jobId}:`, error)
        errors.push(`${url}: Polling error - ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      }
    }
    
    // Timeout
    console.error(`⏰ Job ${jobId} timed out after ${maxAttempts * pollInterval / 1000}s`)
    errors.push(`${url}: Job timed out`)
  })
  
  // Wait for all jobs to complete or timeout
  await Promise.all(jobPromises)
  
  console.log(`🎯 Job polling complete: ${results.length} successful, ${errors.length} failed`)
  
  return {
    success: results.length > 0,
    data: results,
    errors
  }
}

/**
 * Get the status of a specific extraction job
 */
export async function getExtractJobStatus(jobId: string): Promise<{ success: boolean, data?: any[], error?: string }> {
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
      console.error(`🚨 Failed to get job status: ${response.status} - ${errorText}`)
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
    console.error('🚨 Error getting job status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
