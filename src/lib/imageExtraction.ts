import axios from 'axios'
import { JSDOM } from 'jsdom'
import { openai } from './openai'
import { z } from 'zod'

// Firecrawl configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev'

export interface ExtractedImage {
  url: string
  width?: number
  height?: number
  size?: number
  alt?: string
}

export interface ImageSelectionResult {
  selectedImageUrl: string
  reason: string
}

export interface TitleFormattingResult {
  formattedTitle: string
  changes: string[]
}

/**
 * Extract images using Firecrawl as a fallback when axios fails
 */
async function extractImagesWithFirecrawl(url: string): Promise<ExtractedImage[]> {
  console.log('🔥 Checking Firecrawl config...')
  console.log('🔥 FIRECRAWL_API_KEY exists:', !!FIRECRAWL_API_KEY)
  console.log('🔥 FIRECRAWL_API_KEY length:', FIRECRAWL_API_KEY?.length || 0)
  
  if (!FIRECRAWL_API_KEY) {
    throw new Error('Firecrawl API key not configured')
  }

  console.log(`🔥 Using Firecrawl to scrape ${url} for images...`)
  
  try {
    const requestBody = {
      url: url,
      formats: ['html'], // Request HTML first, fallback to content if needed
      onlyMainContent: false, // We want full page HTML for images
      timeout: 30000
    }
    
    const requestHeaders = {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    }
    
    console.log('🔥 Making request to:', `${FIRECRAWL_BASE_URL}/v0/scrape`)
    console.log('🔥 Request body:', JSON.stringify(requestBody, null, 2))
    console.log('🔥 Request headers:', { ...requestHeaders, Authorization: `Bearer ${FIRECRAWL_API_KEY?.substring(0, 10)}...` })
    
    // Use Firecrawl's scrape endpoint to get HTML content
    const scrapeResponse = await axios.post(
      `${FIRECRAWL_BASE_URL}/v0/scrape`,
      requestBody,
      {
        headers: requestHeaders,
        timeout: 45000
      }
    )

    console.log('🔥 Firecrawl response status:', scrapeResponse.status)
    console.log('🔥 Firecrawl response keys:', Object.keys(scrapeResponse.data || {}))
    console.log('🔥 Firecrawl data keys:', Object.keys(scrapeResponse.data?.data || {}))
    console.log('🔥 Firecrawl success:', scrapeResponse.data?.success)
    console.log('🔥 Firecrawl has content:', !!scrapeResponse.data?.data?.content)
    console.log('🔥 Firecrawl has direct content:', !!scrapeResponse.data?.content)
    console.log('🔥 Firecrawl has html:', !!scrapeResponse.data?.data?.html)
    console.log('🔥 Firecrawl has markdown:', !!scrapeResponse.data?.data?.markdown)
    
    // Determine the correct content path
    let htmlContent: string
    
    if (!scrapeResponse.data?.success) {
      throw new Error(`Firecrawl request failed. Success: ${scrapeResponse.data?.success}`)
    }
    
    // Priority: HTML > content > markdown (we need HTML for image parsing)
    if (scrapeResponse.data?.data?.html) {
      htmlContent = scrapeResponse.data.data.html
      console.log('🔥 Using HTML content: data.data.html')
    } else if (scrapeResponse.data?.html) {
      htmlContent = scrapeResponse.data.html
      console.log('🔥 Using HTML content: data.html')
    } else if (scrapeResponse.data?.data?.content) {
      htmlContent = scrapeResponse.data.data.content
      console.log('🔥 Using content field: data.data.content (might be markdown)')
    } else if (scrapeResponse.data?.content) {
      htmlContent = scrapeResponse.data.content
      console.log('🔥 Using content field: data.content (might be markdown)')
    } else {
      throw new Error(`Firecrawl failed to retrieve any content. Available fields: ${Object.keys(scrapeResponse.data?.data || {}).join(', ')}`)
    }
    console.log(`🔥 Firecrawl successfully retrieved HTML content (${htmlContent.length} chars)`)
    
    // Debug: Check if the specific image is in the content
    const hasExpectedImage = htmlContent.includes('GettyImages-1380036977-scaled.jpg')
    console.log(`🔍 Content includes expected image: ${hasExpectedImage}`)
    
    // Debug: Show first 500 chars of content to see format
    console.log(`🔍 First 500 chars of Firecrawl content:`)
    console.log(htmlContent.substring(0, 500))
    
    // Parse HTML with JSDOM (same logic as axios version)
    const dom = new JSDOM(htmlContent)
    const document = dom.window.document

    // Extract all img elements  
    const imgElements = Array.from(document.querySelectorAll('img'))
    console.log(`🔍 Found ${imgElements.length} img elements via querySelectorAll`)
    
    // Debug: If we found img elements, log the first few
    if (imgElements.length > 0) {
      imgElements.slice(0, 3).forEach((img, i) => {
        console.log(`🔍 Img ${i + 1}: src="${img.getAttribute('src')}", alt="${img.getAttribute('alt')}"`)
      })
    }
    
    const images: ExtractedImage[] = []
    
    // If no HTML img elements found, try parsing as Markdown
    if (imgElements.length === 0) {
      console.log('🔍 No HTML img elements found, trying to parse Markdown images...')
      console.log('🔍 Content sample for markdown parsing:', htmlContent.substring(0, 200))
      const markdownImages = extractMarkdownImages(htmlContent, url)
      images.push(...markdownImages)
      console.log(`🔍 Found ${markdownImages.length} images in Markdown format`)
      if (markdownImages.length > 0) {
        console.log('🔍 First markdown image:', markdownImages[0])
      }
    } else {
      console.log('🔍 Processing HTML img elements...')
    }

    // 1. Process traditional <img> tags
    for (const img of imgElements) {
      const src = img.getAttribute('src')
      const alt = img.getAttribute('alt') || ''
      
      console.log(`🔍 Processing img: src="${src}", alt="${alt}"`)
      
      if (!src) {
        console.log(`❌ Skipping img: no src attribute`)
        continue
      }

      // Convert relative URLs to absolute
      let imageUrl: string
      try {
        imageUrl = new URL(src, url).href
        console.log(`✅ Converted to absolute URL: ${imageUrl}`)
      } catch {
        console.log(`❌ Skipping img: invalid URL format for src="${src}"`)
        continue // Skip invalid URLs
      }

      // Skip common non-content images
      const isFiltered = isNonContentImage(imageUrl, alt)
      console.log(`🔍 Image filter result: ${isFiltered ? 'FILTERED OUT' : 'KEPT'} for ${imageUrl}`)
      
      if (isFiltered) {
        continue
      }

      images.push({
        url: imageUrl,
        width: parseInt(img.getAttribute('width') || '0') || undefined,
        height: parseInt(img.getAttribute('height') || '0') || undefined,
        alt: alt
      })
      
      console.log(`✅ Added image to collection: ${imageUrl}`)
    }

    // 2. Process CSS background images from inline styles
    const elementsWithBackgrounds = Array.from(document.querySelectorAll('[style*="background"]'))
    let inlineBackgroundCount = 0
    
    for (const element of elementsWithBackgrounds) {
      const style = element.getAttribute('style') || ''
      const backgroundUrls = extractBackgroundImageUrls(style, url)
      
      for (const bgUrl of backgroundUrls) {
        if (!isNonContentImage(bgUrl, '')) {
          images.push({
            url: bgUrl,
            alt: `Background image from ${element.tagName.toLowerCase()}`,
            width: undefined,
            height: undefined
          })
          inlineBackgroundCount++
        }
      }
    }

    // 3. Process CSS background images from <style> tags
    const styleTags = Array.from(document.querySelectorAll('style'))
    let styleTagBackgroundCount = 0
    
    for (const styleTag of styleTags) {
      const cssContent = styleTag.textContent || ''
      const backgroundUrls = extractBackgroundImageUrls(cssContent, url)
      
      for (const bgUrl of backgroundUrls) {
        if (!isNonContentImage(bgUrl, '')) {
          images.push({
            url: bgUrl,
            alt: 'Background image from CSS',
            width: undefined,
            height: undefined
          })
          styleTagBackgroundCount++
        }
      }
    }

    // Remove duplicates
    const uniqueImages = images.filter((image, index, array) => 
      array.findIndex(img => img.url === image.url) === index
    )

    console.log(`🔥 Firecrawl extracted ${uniqueImages.length} potential content images:`)
    console.log(`   • ${imgElements.length} from <img> tags`)
    console.log(`   • ${inlineBackgroundCount} from inline background styles`) 
    console.log(`   • ${styleTagBackgroundCount} from <style> tag backgrounds`)
    console.log(`   • ${images.length - uniqueImages.length} duplicates removed`)
    
    return uniqueImages

  } catch (error) {
    console.error('🔥❌ Firecrawl image extraction failed:', error)
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any
      console.error('🔥❌ Firecrawl error response status:', axiosError.response?.status)
      console.error('🔥❌ Firecrawl error response data:', JSON.stringify(axiosError.response?.data, null, 2))
    }
    throw error
  }
}

/**
 * Fetch HTML content from a URL and extract all image URLs
 */
export async function extractImagesFromHtml(url: string): Promise<ExtractedImage[]> {
  try {
    console.log(`🖼️ Extracting images from: ${url}`)
    
    // Multiple user agents to rotate through
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]
    
    // Comprehensive browser-like headers
    const headers: Record<string, string> = {
      'User-Agent': randomUserAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }

    let response
    let attempt = 0
    const maxAttempts = 3
    
    // Retry logic with different approaches
    while (attempt < maxAttempts) {
      try {
        attempt++
        console.log(`📡 Attempt ${attempt}/${maxAttempts} to fetch HTML...`)
        
        // Add random delay to avoid being detected as a bot (except first attempt)
        if (attempt > 1) {
          const delay = Math.random() * 2000 + 1000 // 1-3 seconds
          console.log(`⏳ Adding ${Math.round(delay)}ms delay...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        response = await axios.get(url, {
          headers: headers,
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500, // Accept 4xx errors but retry 5xx
        })
        
        if (response.status === 200) {
          break // Success!
        } else if (response.status === 403 || response.status === 429) {
          console.log(`⚠️ Got ${response.status} response, trying with different headers...`)
          // Try with more minimal headers for next attempt - create new object
          Object.assign(headers, {
            'User-Agent': userAgents[(attempt) % userAgents.length]
          })
          delete headers['Sec-Fetch-Dest']
          delete headers['Sec-Fetch-Mode']
          delete headers['Sec-Fetch-Site']
          delete headers['Sec-Fetch-User']
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
        
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error))
        
        if (attempt === maxAttempts) {
          throw error // Re-throw on final attempt
        }
        
        // For the next attempt, try with even simpler headers
        headers['User-Agent'] = userAgents[(attempt) % userAgents.length]
        if (attempt === 2) {
          // Last attempt: use very minimal headers - rebuild the object
          const minimalHeaders: Record<string, string> = {
            'User-Agent': headers['User-Agent'],
            'Accept': headers['Accept']
          }
          Object.keys(headers).forEach(key => {
            delete headers[key]
          })
          Object.assign(headers, minimalHeaders)
        }
      }
    }

    if (!response || response.status !== 200) {
      throw new Error(`Failed to fetch after ${maxAttempts} attempts`)
    }

    // Parse HTML with JSDOM
    const dom = new JSDOM(response.data)
    const document = dom.window.document

    // Extract all img elements
    const imgElements = Array.from(document.querySelectorAll('img'))
    const images: ExtractedImage[] = []

    // 1. Process traditional <img> tags
    for (const img of imgElements) {
      const src = img.getAttribute('src')
      const alt = img.getAttribute('alt') || ''
      
      if (!src) continue

      // Convert relative URLs to absolute
      let imageUrl: string
      try {
        imageUrl = new URL(src, url).href
      } catch {
        continue // Skip invalid URLs
      }

      // Skip common non-content images
      if (isNonContentImage(imageUrl, alt)) {
        continue
      }

      images.push({
        url: imageUrl,
        width: parseInt(img.getAttribute('width') || '0') || undefined,
        height: parseInt(img.getAttribute('height') || '0') || undefined,
        alt: alt
      })
    }

    // 2. Process CSS background images from inline styles
    const elementsWithBackgrounds = Array.from(document.querySelectorAll('[style*="background"]'))
    let inlineBackgroundCount = 0
    
    for (const element of elementsWithBackgrounds) {
      const style = element.getAttribute('style') || ''
      const backgroundUrls = extractBackgroundImageUrls(style, url)
      
      for (const bgUrl of backgroundUrls) {
        if (!isNonContentImage(bgUrl, '')) {
          images.push({
            url: bgUrl,
            alt: `Background image from ${element.tagName.toLowerCase()}`,
            width: undefined,
            height: undefined
          })
          inlineBackgroundCount++
        }
      }
    }

    // 3. Process CSS background images from <style> tags
    const styleTags = Array.from(document.querySelectorAll('style'))
    let styleTagBackgroundCount = 0
    
    for (const styleTag of styleTags) {
      const cssContent = styleTag.textContent || ''
      const backgroundUrls = extractBackgroundImageUrls(cssContent, url)
      
      for (const bgUrl of backgroundUrls) {
        if (!isNonContentImage(bgUrl, '')) {
          images.push({
            url: bgUrl,
            alt: 'Background image from CSS',
            width: undefined,
            height: undefined
          })
          styleTagBackgroundCount++
        }
      }
    }

    // Remove duplicates (in case same image appears as both <img> and background)
    const uniqueImages = images.filter((image, index, array) => 
      array.findIndex(img => img.url === image.url) === index
    )

    console.log(`📸 Found ${uniqueImages.length} potential content images:`)
    console.log(`   • ${imgElements.length} from <img> tags`)
    console.log(`   • ${inlineBackgroundCount} from inline background styles`) 
    console.log(`   • ${styleTagBackgroundCount} from <style> tag backgrounds`)
    console.log(`   • ${images.length - uniqueImages.length} duplicates removed`)
    
    return uniqueImages

  } catch (error) {
    console.error('❌ Failed to extract images with axios:', error)
    
    // Fallback: Try using Firecrawl to get the HTML content
    console.log('🔄 Attempting Firecrawl fallback for image extraction...')
    try {
      const firecrawlImages = await extractImagesWithFirecrawl(url)
      if (firecrawlImages.length > 0) {
        console.log(`✅ Firecrawl fallback successful: ${firecrawlImages.length} images found`)
        return firecrawlImages
      }
    } catch (firecrawlError) {
      console.error('❌ Firecrawl fallback also failed:', firecrawlError)
    }
    
    console.error('❌ All image extraction methods failed')
    return []
  }
}

/**
 * Check image dimensions by making a HEAD request
 */
export async function getImageDimensions(imageUrl: string): Promise<{ width: number, height: number } | null> {
  try {
    // Use browser-like headers for image requests too
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]
    
    const response = await axios.head(imageUrl, { 
      timeout: 10000,
      maxRedirects: 3,
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'DNT': '1',
        'Connection': 'keep-alive'
      },
      validateStatus: (status) => status < 500
    })
    
    if (response.status !== 200) {
      return null
    }
    
    const contentLength = response.headers['content-length']
    
    // For now, we'll use a simple approach - if we can't get dimensions,
    // we'll estimate size based on content-length
    if (contentLength) {
      const size = parseInt(contentLength)
      // Rough estimation: assume square image, calculate side length
      const estimatedSide = Math.sqrt(size / 3) // 3 bytes per pixel average
      return { width: estimatedSide, height: estimatedSide }
    }
    
    return null
  } catch {
    // Fail gracefully - return null if we can't get image info
    return null
  }
}

/**
 * Sort images by estimated size (largest first)
 */
export async function sortImagesBySize(images: ExtractedImage[]): Promise<ExtractedImage[]> {
  console.log(`📏 Sorting ${images.length} images by size...`)
  
  // Get dimensions for each image
  const imagesWithSize = await Promise.all(
    images.map(async (image) => {
      // Use existing dimensions if available
      if (image.width && image.height) {
        return { ...image, size: image.width * image.height }
      }
      
      // Try to get dimensions
      const dimensions = await getImageDimensions(image.url)
      if (dimensions) {
        return { 
          ...image, 
          width: dimensions.width, 
          height: dimensions.height,
          size: dimensions.width * dimensions.height 
        }
      }
      
      return { ...image, size: 0 }
    })
  )

  // Sort by size (largest first)
  const sorted = imagesWithSize.sort((a, b) => (b.size || 0) - (a.size || 0))
  
  console.log(`✅ Sorted images - largest: ${sorted[0]?.size || 0}px²`)
  return sorted
}

/**
 * Use AI to select the best representative image
 */
export async function selectBestImage(images: ExtractedImage[], articleTitle: string, articleSummary: string): Promise<ImageSelectionResult | null> {
  if (images.length === 0) {
    return null
  }

  if (images.length === 1) {
    return {
      selectedImageUrl: images[0].url,
      reason: 'Only one image available'
    }
  }

  try {
    console.log(`🤖 Using AI to select best image from ${images.length} options...`)

    const imageDescriptions = images.slice(0, 10).map((img, index) => 
      `${index + 1}. ${img.url} (${img.width}x${img.height}, alt: "${img.alt}")`
    ).join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use gpt-4o which supports JSON mode
      messages: [
        {
          role: 'system',
          content: `You are an expert at selecting the most representative image for news articles. 
          Choose the image that best represents the article content and would be most engaging as a featured image.
          
          Consider:
          - Image size and quality (larger is generally better)
          - Alt text relevance to the article
          - Avoid generic logos, ads, or decorative images
          - Prefer images that directly relate to the article content
          
          Respond with ONLY a JSON object in this format:
          {
            "selectedIndex": 1,
            "reason": "Brief explanation of why this image was chosen"
          }`
        },
        {
          role: 'user',
          content: `Article Title: "${articleTitle}"
          
Article Summary: "${articleSummary}"

Available Images:
${imageDescriptions}

Select the best image (respond with JSON only):`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    const selectedIndex = result.selectedIndex - 1 // Convert to 0-based index

    if (selectedIndex >= 0 && selectedIndex < images.length) {
      console.log(`✅ AI selected image ${selectedIndex + 1}: ${result.reason}`)
      return {
        selectedImageUrl: images[selectedIndex].url,
        reason: result.reason
      }
    }

    // Fallback to largest image
    return {
      selectedImageUrl: images[0].url,
      reason: 'AI selection failed, using largest image'
    }

  } catch (error) {
    console.error('❌ AI image selection failed:', error)
    // Fallback to largest image
    return {
      selectedImageUrl: images[0].url,
      reason: 'AI selection failed, using largest image'
    }
  }
}

/**
 * Use AI to format and improve the article title
 */
export async function formatArticleTitle(title: string): Promise<TitleFormattingResult> {
  try {
    console.log(`✏️ Formatting title: "${title}"`)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use gpt-4o which supports JSON mode
      messages: [
        {
          role: 'system',
          content: `You are an expert editor specializing in news article titles. 
          Your job is to clean up and improve article titles while preserving their meaning.
          
          Tasks:
          1. Decode any HTML entities (e.g., &amp; → &, &quot; → ")
          2. Fix spelling and grammar errors
          3. Ensure proper capitalization
          4. Shorten to 80 characters or less if needed (while preserving key information)
          5. Remove redundant words or phrases
          6. Make it engaging and clear
          
          Respond with ONLY a JSON object in this format:
          {
            "formattedTitle": "The cleaned up title",
            "changes": ["List of changes made", "Another change"]
          }`
        },
        {
          role: 'user',
          content: `Please format this title: "${title}"`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    console.log(`✅ Title formatted: "${result.formattedTitle}"`)
    if (result.changes && result.changes.length > 0) {
      console.log(`📝 Changes made: ${result.changes.join(', ')}`)
    }

    return {
      formattedTitle: result.formattedTitle || title,
      changes: result.changes || []
    }

  } catch (error) {
    console.error('❌ Title formatting failed:', error)
    // Fallback: basic HTML decoding
    const basicCleaned = title
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .slice(0, 80)

    return {
      formattedTitle: basicCleaned,
      changes: ['Basic HTML entity decoding', 'Length limited to 80 characters']
    }
  }
}

/**
 * Extract background image URLs from CSS content
 */
function extractBackgroundImageUrls(cssContent: string, baseUrl: string): string[] {
  const imageUrls: string[] = []
  
  // Regex to match various background-image patterns:
  // - background-image: url('image.jpg')
  // - background: url("image.jpg") no-repeat center
  // - background-image: url(image.jpg)
  const backgroundImageRegex = /background(?:-image)?\s*:\s*[^;}]*url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi
  
  let match
  while ((match = backgroundImageRegex.exec(cssContent)) !== null) {
    const imageUrl = match[1].trim()
    
    if (!imageUrl) continue
    
    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(imageUrl, baseUrl).href
      // Avoid duplicates
      if (!imageUrls.includes(absoluteUrl)) {
        imageUrls.push(absoluteUrl)
      }
    } catch {
      // Skip invalid URLs
      continue
    }
  }
  
  return imageUrls
}

/**
 * Extract images from Markdown format content
 */
function extractMarkdownImages(markdownContent: string, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = []
  
  console.log(`🔍 Extracting markdown images from ${markdownContent.length} chars of content`)
  
  // Regex to match markdown images: ![alt](url) and [![alt](url)](link)
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  
  let match
  let matchCount = 0
  while ((match = markdownImageRegex.exec(markdownContent)) !== null) {
    matchCount++
    const alt = match[1] || ''
    const imageUrl = match[2].trim()
    
    console.log(`🔍 Found Markdown image: ![${alt}](${imageUrl})`)
    
    if (!imageUrl) continue
    
    // Convert relative URLs to absolute
    let absoluteImageUrl: string
    try {
      absoluteImageUrl = new URL(imageUrl, baseUrl).href
      console.log(`✅ Converted to absolute URL: ${absoluteImageUrl}`)
    } catch {
      console.log(`❌ Skipping image: invalid URL format for "${imageUrl}"`)
      continue
    }
    
    // Skip common non-content images
    const isFiltered = isNonContentImage(absoluteImageUrl, alt)
    console.log(`🔍 Image filter result: ${isFiltered ? 'FILTERED OUT' : 'KEPT'} for ${absoluteImageUrl}`)
    
    if (isFiltered) {
      continue
    }
    
    images.push({
      url: absoluteImageUrl,
      alt: alt,
      width: undefined, // Markdown doesn't specify dimensions
      height: undefined
    })
    
    console.log(`✅ Added Markdown image to collection: ${absoluteImageUrl}`)
  }
  
  console.log(`🔍 Markdown parsing complete: found ${matchCount} total matches, ${images.length} valid images`)
  return images
}

/**
 * Helper function to filter out non-content images
 */
function isNonContentImage(url: string, alt: string): boolean {
  const lowercaseUrl = url.toLowerCase()
  const lowercaseAlt = alt.toLowerCase()
  
  // Since we have AI image selection, only filter the most obvious non-content images
  // Let the AI decide what's appropriate vs not
  
  // Only filter obvious tracking/technical images
  const obviousNonContentPatterns = [
    // Tracking pixels and technical images
    'tracking', 'pixel', '1x1', 'spacer', 'separator', 'blank.gif', 'transparent.png',
    // Very specific ad-serving patterns
    'doubleclick', 'googleadservices', 'googlesyndication', 'adsystem', 
    // Social media icons (usually tiny)
    '16x16', '24x24', '32x32', '1px', '2px'
  ]
  
  // Debug: Find which pattern matches (if any)
  const matchingPattern = obviousNonContentPatterns.find(pattern => 
    lowercaseUrl.includes(pattern) || lowercaseAlt.includes(pattern)
  )
  
  if (matchingPattern) {
    console.log(`🚫 Image filtered: URL="${url}", ALT="${alt}"`)
    console.log(`   → Obvious non-content pattern: "${matchingPattern}"`)
    return true
  }
  
  // Let everything else through - AI will pick the best one
  console.log(`✅ Image passed filtering: ${url}`)
  return false
}
