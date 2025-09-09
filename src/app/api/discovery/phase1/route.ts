import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { openai } from '@/lib/openai'

// Firecrawl URL extraction function
async function extractUrlsWithFirecrawl(newsUrl: string): Promise<{ success: boolean, urls: string[], error?: string }> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, urls: [], error: 'Firecrawl API key not configured' }
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: newsUrl,
        formats: ['links'], // Get all links from the page
        onlyMainContent: false, // Get all links, not just main content
        timeout: 30000
      })
    })

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`)
    }

    const result = await response.json()
    console.log('🔥 Firecrawl response:', JSON.stringify(result, null, 2))

    if (!result.success) {
      throw new Error(`Firecrawl scraping failed: ${result.error}`)
    }

    // Extract links from Firecrawl response
    const links = result.data?.linksOnPage || result.data?.links || []
    console.log(`🔗 Firecrawl extracted ${links.length} links`)

    return { success: true, urls: links }
  } catch (error) {
    console.error('🔥❌ Firecrawl URL extraction failed:', error)
    return { 
      success: false, 
      urls: [], 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

// AI-powered URL filtering to keep only content URLs
async function filterUrlsWithAI(urls: string[], organizationName: string, baseUrl: string): Promise<string[]> {
  if (urls.length === 0) return urls
  
  console.log(`🤖 Using AI to filter ${urls.length} URLs for content relevance...`)
  
  try {
    const prompt = `
You are analyzing URLs from a news/blog website for "${organizationName}" (${baseUrl}).

Your task: Return ONLY the URLs that appear to be actual CONTENT pages (articles, blog posts, news stories).

EXCLUDE these types of URLs:
- Navigation/menu links (about, contact, home, etc.)
- Category/tag pages (/category/, /tags/, /topics/)
- Social media links (facebook, twitter, instagram, youtube)
- Archive/listing pages (/archive/, /page/, pagination)
- Search/filter pages
- Privacy/legal pages
- Donation/giving pages
- Newsletter/subscription pages
- Generic directory pages

INCLUDE these types of URLs:
- Individual blog posts or articles
- News stories
- Devotionals or spiritual content
- Teaching/sermon content
- Specific dated content

Return ONLY a JSON array of the content URLs (no other text):

URLs to analyze:
${urls.map(url => `- ${url}`).join('\n')}
`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a content classification expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      console.warn('🤖❌ AI filtering failed: No response content')
      return urls // Return all URLs if AI fails
    }

    // Parse the JSON response - strip markdown code fences if present
    let jsonContent = content
    if (content.startsWith('```json')) {
      jsonContent = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    } else if (content.startsWith('```')) {
      jsonContent = content.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    const filteredUrls = JSON.parse(jsonContent)
    
    if (!Array.isArray(filteredUrls)) {
      console.warn('🤖❌ AI filtering failed: Response not an array')
      return urls
    }

    console.log(`🤖✅ AI filtered ${urls.length} URLs → ${filteredUrls.length} content URLs`)
    console.log(`🤖 Kept: ${filteredUrls.map(url => url.split('/').pop()).join(', ')}`)
    
    return filteredUrls

  } catch (error) {
    console.error('🤖❌ AI URL filtering failed:', error)
    console.log('🤖 Falling back to original URL list')
    return urls // Return all URLs if AI fails
  }
}

// URL classification function
function classifyUrls(urls: string[], newsUrl: string) {
  const newsUrlObj = new URL(newsUrl)
  
  return urls
    .filter(url => {
      try {
        const parsedUrl = new URL(url)
        const path = parsedUrl.pathname.toLowerCase()
        
        // Skip the news URL itself
        if (parsedUrl.href === newsUrl) return false
        
        // Basic protocol filtering
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false
        
        // Skip obvious non-content paths
        const skipPaths = ['/feed/', '.xml', '.rss', '/wp-json/', '/api/', '.css', '.js', '.jpg', '.png', '.gif', '.svg']
        const shouldSkip = skipPaths.some(skipPath => path.includes(skipPath))
        if (shouldSkip) return false
        
        // Skip very short paths (likely not content)
        if (path.length < 3 || (path === '/' || path === '/learn' || path === '/resources')) return false
        
        return true
      } catch {
        return false
      }
    })
    .slice(0, 100) // Limit to 100 URLs for review
    .map(url => {
      const urlObj = new URL(url)
      const newsUrlDomain = newsUrlObj.hostname
      
      // Classification logic
      const urlType = urlObj.hostname === newsUrlDomain ? 'post' : 'news'
      
      return {
        url,
        urlType,
        domain: urlObj.hostname,
        titlePreview: null // Will be populated later if needed
      }
    })
}

// Enhanced URL extraction using Firecrawl for better dynamic content handling
async function extractArticleUrlsWithClassification(newsUrl: string, orgName: string) {
  console.log(`📄 Phase 1: Discovering URLs from ${newsUrl} using Firecrawl`)
  
  try {
    // Try Firecrawl first for better dynamic content support
    console.log('🔥 Using Firecrawl to scrape URL for link discovery...')
    const firecrawlResult = await extractUrlsWithFirecrawl(newsUrl)
    
    if (firecrawlResult.success && firecrawlResult.urls.length > 0) {
      console.log(`🔥 Firecrawl found ${firecrawlResult.urls.length} URLs`)
      
      // Filter URLs with AI before classification
      const filteredUrls = await filterUrlsWithAI(firecrawlResult.urls, orgName, newsUrl)
      
      return classifyUrls(filteredUrls, newsUrl)
    }
    
    // Fallback to basic HTTP if Firecrawl fails
    console.log('🌐 Firecrawl failed, falling back to basic HTTP...')
    const response = await fetch(newsUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)',
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const html = await response.text()
    console.log(`📊 Fetched ${html.length} characters via fallback`)
    
    console.log('🔍 Starting URL pattern matching...')
    
    // Simplified regex patterns for fallback (Firecrawl is primary)
    const urlPatterns = [
      /href="(https?:\/\/[^"]*(?:news|article|story|press|blog|media|post)[^"]*?)"/gi,
      /href="(\/[^"]*(?:news|article|story|press|blog|post)[^"]*?)"/gi,
      /href="(\/[a-zA-Z0-9\-]{5,}(?:\/[a-zA-Z0-9\-]{2,})*\/?)"/gi, // Blog-style URLs
    ]
    
    let allUrls = new Set<string>()
    const newsUrlObj = new URL(newsUrl)
    
    const patternNames = [
      'Content keywords (absolute)',
      'Content keywords (relative)', 
      'Blog-style URLs'
    ]
    
    for (let i = 0; i < urlPatterns.length; i++) {
      const pattern = urlPatterns[i]
      const patternName = patternNames[i] || `Pattern ${i + 1}`
      const matches = [...html.matchAll(pattern)]
      console.log(`🔍 Pattern "${patternName}": found ${matches.length} matches`)
      
      matches.forEach(match => {
        if (match[1]) {
          let url = match[1]
          // Convert relative URLs to absolute
          if (url.startsWith('/')) {
            url = `${newsUrlObj.protocol}//${newsUrlObj.host}${url}`
          }
          console.log(`   → ${url}`)
          allUrls.add(url)
        }
      })
    }
    
    console.log(`🔗 Found ${allUrls.size} raw URLs before regex fallback filtering`)
    
    const fallbackUrls = Array.from(allUrls)
    
    // Filter URLs with AI before classification  
    const filteredFallbackUrls = await filterUrlsWithAI(fallbackUrls, orgName, newsUrl)
    
    const discoveredUrls = classifyUrls(filteredFallbackUrls, newsUrl)
    
    console.log(`🔗 Regex fallback discovered ${discoveredUrls.length} URLs (${discoveredUrls.filter(u => u.urlType === 'news').length} news, ${discoveredUrls.filter(u => u.urlType === 'post').length} posts)`)
    
    console.log('✅ extractArticleUrlsWithClassification completed successfully')
    return discoveredUrls
    
  } catch (error) {
    console.error('Phase 1 discovery error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, newsUrl, manualUrls } = await request.json()
    
    if (!organizationId || !newsUrl) {
      return NextResponse.json({
        success: false,
        error: 'organizationId and newsUrl are required'
      }, { status: 400 })
    }
    
    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, newsUrl: true }
    })
    
    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found'
      }, { status: 404 })
    }
    
    // Create discovery session
    const session = await prisma.discoverySession.create({
      data: {
        organizationId,
        newsUrl,
        status: 'discovering'
      }
    })
    
    let discoveredUrls: any[] = []

    if (manualUrls && Array.isArray(manualUrls)) {
      // Process manual URLs (skip discovery)
      console.log(`📝 Processing ${manualUrls.length} manual URLs for ${organization.name}`)
      
      discoveredUrls = manualUrls.map((url: string) => {
        const urlObj = new URL(url)
        return {
          url,
          urlType: 'post' as const, // Default to 'post' for manual URLs
          domain: urlObj.hostname,
          titlePreview: `Manual: ${urlObj.pathname}`
        }
      })
      
      console.log(`🔗 Manual URLs processed: ${discoveredUrls.length} URLs`)
    } else {
      // Standard discovery process
      console.log(`🚀 Starting Phase 1 discovery for ${organization.name}`)
      console.log(`📡 News URL: ${newsUrl}`)
      
      // Discover URLs
      console.log('📄 Calling extractArticleUrlsWithClassification...')
      discoveredUrls = await extractArticleUrlsWithClassification(newsUrl, organization.name)
      console.log(`🔗 Discovery returned ${discoveredUrls.length} URLs`)
    }
    
    // Save discovered URLs to database
    await Promise.all(
      discoveredUrls.map(urlData => 
        prisma.discoveredUrl.create({
          data: {
            discoverySessionId: session.id,
            url: urlData.url,
            urlType: urlData.urlType,
            domain: urlData.domain,
            titlePreview: urlData.titlePreview,
            selectedForScraping: manualUrls ? true : false // Auto-select manual URLs
          }
        })
      )
    )
    
    // Update session status and counts
    await prisma.discoverySession.update({
      where: { id: session.id },
      data: {
        status: 'ready_for_review',
        totalUrls: discoveredUrls.length,
        updatedAt: new Date()
      }
    })
    
    console.log(`✅ Phase 1 complete: ${discoveredUrls.length} URLs ready for review`)
    
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      totalUrls: discoveredUrls.length,
      newsCount: discoveredUrls.filter(u => u.urlType === 'news').length,
      postCount: discoveredUrls.filter(u => u.urlType === 'post').length,
      urls: discoveredUrls
    })
    
  } catch (error) {
    console.error('Phase 1 API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Discovery failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve existing discovery sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const sessionId = searchParams.get('sessionId')
    
    if (sessionId) {
      // Get specific session with discovered URLs
      const session = await prisma.discoverySession.findUnique({
        where: { id: sessionId },
        include: {
          organization: { select: { id: true, name: true } },
          discoveredUrls: {
            orderBy: { createdAt: 'asc' }
          },
          scrapedContent: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })
      
      if (!session) {
        return NextResponse.json({
          success: false,
          error: 'Session not found'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          organizationId: session.organizationId,
          organizationName: session.organization.name,
          newsUrl: session.newsUrl,
          status: session.status,
          totalUrls: session.totalUrls,
          selectedUrls: session.selectedUrls,
          processedUrls: session.processedUrls,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          discoveredUrls: session.discoveredUrls.map(url => ({
            id: url.id,
            url: url.url,
            urlType: url.urlType,
            domain: url.domain,
            titlePreview: url.titlePreview,
            selectedForScraping: url.selectedForScraping,
            scrapeStatus: url.scrapeStatus,
            selected: url.selectedForScraping // For UI consistency
          })),
          scrapedContent: session.scrapedContent.map(content => ({
            id: content.id,
            discoveredUrlId: content.discoveredUrlId,
            title: content.title,
            summary: content.summary,
            markdownContent: content.markdownContent,
            keywords: content.keywords,
            sentimentScore: content.sentimentScore,
            sentimentReasoning: content.sentimentReasoning,
            selectedForFinalization: content.selectedForFinalization,
            createdAt: content.createdAt,
            urlType: session.discoveredUrls.find(url => url.id === content.discoveredUrlId)?.urlType || 'news'
          }))
        }
      })
    }
    
    // Get sessions for organization
    if (organizationId) {
      const sessions = await prisma.discoverySession.findMany({
        where: { organizationId },
        include: {
          organization: { select: { id: true, name: true } },
          scrapedContent: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      return NextResponse.json({
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          organizationId: session.organizationId,
          organizationName: session.organization.name,
          newsUrl: session.newsUrl,
          status: session.status,
          totalUrls: session.totalUrls,
          selectedUrls: session.selectedUrls,
          processedUrls: session.processedUrls,
          scrapedArticles: session.scrapedContent.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }))
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'organizationId or sessionId parameter required'
    }, { status: 400 })
    
  } catch (error) {
    console.error('Phase 1 GET API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch discovery sessions'
    }, { status: 500 })
  }
}
