import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Enhanced URL extraction function from existing newsUrl extractor
async function extractArticleUrlsWithClassification(newsUrl: string, orgName: string) {
  console.log(`📄 Phase 1: Discovering URLs from ${newsUrl}`)
  
  try {
    console.log('🌐 Attempting to fetch URL...')
    const response = await fetch(newsUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)',
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const html = await response.text()
    console.log(`📊 Fetched ${html.length} characters`)
    
    console.log('🔍 Starting URL pattern matching...')
    // Enhanced URL patterns to capture more article types
    const urlPatterns = [
      /href="(https?:\/\/[^"]*(?:news|article|story|press|blog|media|post)[^"]*?)"/gi,
      /(?:onclick|data-href|data-url)="[^"]*?(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi,
      /"url":\s*"(https?:\/\/[^"]*(?:news|article|story|press|blog)[^"]*?)"/gi,
      // Additional patterns for posts and articles
      /href="(\/[^"]*(?:news|article|story|press|blog|post)[^"]*?)"/gi, // Relative URLs
    ]
    
    let allUrls = new Set<string>()
    const newsUrlObj = new URL(newsUrl)
    
    for (const pattern of urlPatterns) {
      const matches = [...html.matchAll(pattern)]
      matches.forEach(match => {
        if (match[1]) {
          let url = match[1]
          // Convert relative URLs to absolute
          if (url.startsWith('/')) {
            url = `${newsUrlObj.protocol}//${newsUrlObj.host}${url}`
          }
          allUrls.add(url)
        }
      })
    }
    
    console.log(`🔗 Found ${allUrls.size} raw URLs before filtering`)
    
    const discoveredUrls = Array.from(allUrls)
      .filter(url => {
        try {
          const parsedUrl = new URL(url)
          const path = parsedUrl.pathname.toLowerCase()
          
          // Skip the news URL itself
          if (parsedUrl.href === newsUrl) return false
          
          // Basic filtering
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false
          if (path.includes('/category/') || path.includes('/tag/') || 
              path.includes('/page/') || path.includes('/archive/') || 
              path.includes('/feed/') || path.includes('.xml') || 
              path.includes('.rss')) return false
          
          return true
        } catch {
          return false
        }
      })
      .slice(0, 100) // Limit to 100 URLs for review
      .map(url => {
        const urlObj = new URL(url)
        const newsUrlDomain = new URL(newsUrl).hostname
        
        // Classification logic
        const urlType = urlObj.hostname === newsUrlDomain ? 'post' : 'news'
        
        return {
          url,
          urlType,
          domain: urlObj.hostname,
          titlePreview: null // Will be populated later if needed
        }
      })
    
    console.log(`🔗 Discovered ${discoveredUrls.length} URLs (${discoveredUrls.filter(u => u.urlType === 'news').length} news, ${discoveredUrls.filter(u => u.urlType === 'post').length} posts)`)
    
    console.log('✅ extractArticleUrlsWithClassification completed successfully')
    return discoveredUrls
    
  } catch (error) {
    console.error('Phase 1 discovery error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, newsUrl } = await request.json()
    
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
    
    console.log(`🚀 Starting Phase 1 discovery for ${organization.name}`)
    console.log(`📡 News URL: ${newsUrl}`)
    
    // Discover URLs
    console.log('📄 Calling extractArticleUrlsWithClassification...')
    const discoveredUrls = await extractArticleUrlsWithClassification(newsUrl, organization.name)
    console.log(`🔗 Discovery returned ${discoveredUrls.length} URLs`)
    
    // Save discovered URLs to database
    await Promise.all(
      discoveredUrls.map(urlData => 
        prisma.discoveredUrl.create({
          data: {
            discoverySessionId: session.id,
            url: urlData.url,
            urlType: urlData.urlType,
            domain: urlData.domain,
            titlePreview: urlData.titlePreview
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
            scrapeStatus: url.scrapeStatus
          }))
        }
      })
    }
    
    // Get sessions for organization
    if (organizationId) {
      const sessions = await prisma.discoverySession.findMany({
        where: { organizationId },
        include: {
          organization: { select: { id: true, name: true } }
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
