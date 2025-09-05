import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  extractImagesFromHtml, 
  sortImagesBySize, 
  selectBestImage, 
  formatArticleTitle 
} from '@/lib/imageExtraction'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, selectedContentIds, selectAll } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 })
    }

    // Handle selectAll or selectedContentIds
    let contentIds: string[] = []
    
    if (selectAll) {
      // Get all scraped content for this session
      const scrapedContent = await prisma.scrapedContent.findMany({
        where: { discoverySessionId: sessionId },
        select: { id: true }
      })
      contentIds = scrapedContent.map(content => content.id)
      console.log(`🚀 Auto-selecting ${contentIds.length} scraped articles for automated pipeline`)
    } else if (selectedContentIds && Array.isArray(selectedContentIds)) {
      contentIds = selectedContentIds
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either selectAll=true or selectedContentIds array is required'
      }, { status: 400 })
    }

    console.log(`🎯 Starting Phase 3: Finalizing ${contentIds.length} articles for session ${sessionId}`)
    
    // Get the discovery session
    const session = await prisma.discoverySession.findUnique({
      where: { id: sessionId },
      include: { 
        organization: true,
        scrapedContent: {
          where: { id: { in: contentIds } },
          include: {
            discoveredUrl: true
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Discovery session not found'
      }, { status: 404 })
    }

    if (session.scrapedContent.length === 0) {
      return NextResponse.json({
        success: false,
        error: selectAll ? 'No scraped content found for session' : 'No scraped content found for the provided IDs'
      }, { status: 404 })
    }

    console.log(`📋 Found ${session.scrapedContent.length} scraped content records to finalize`)

    // Update session status to finalizing
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: { 
        status: 'finalizing',
        updatedAt: new Date()
      }
    })

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    const createdArticles: string[] = []
    const articleIds: string[] = []

    // Use the same sentiment labels as Phase 2 UI for consistency
    const SENTIMENT_LABELS = {
      '-1': 'Negative',
      '0': 'Not Mentioned', 
      '1': 'Brief Mention',
      '2': 'Main Focus',
      '3': 'Social Impact'
    }

    // Helper function to get user-friendly organization sentiment label (matching Phase 2 UI)
    const getOrganizationSentiment = (score: number | null): string => {
      if (score === null || score === undefined) return 'Not Mentioned'
      return SENTIMENT_LABELS[score.toString() as keyof typeof SENTIMENT_LABELS] || 'Not Mentioned'
    }

    // Helper function to map organization relevance score  
    const getOrganizationRelevance = (score: number | null): string => {
      if (score === null || score === undefined) return 'low'
      if (score === -1) return 'medium'  // -1: Mentioned negatively (still relevant)
      if (score === 0) return 'low'      // 0: Not mentioned
      if (score === 1) return 'medium'   // 1: Mentioned but not main focus
      if (score === 2) return 'high'     // 2: Main focus (informational)
      if (score === 3) return 'high'     // 3: Main focus (inspiring)
      return 'low' // fallback
    }

    // Helper function for legacy sentiment field (based on organization sentiment)
    const getLegacySentiment = (score: number | null): string => {
      if (score === null || score === undefined) return 'neu'
      if (score === -1) return 'neg'  // -1: Organization mentioned negatively
      if (score === 3) return 'pos'   // 3: Inspiring social impact content
      return 'neu' // 0, 1, 2: Not negative, not inspiring
    }

    // Helper function to decode score meaning for logging
    const getScoreMeaning = (score: number | null): string => {
      if (score === null) return 'Unknown'
      if (score === -1) return 'Mentioned negatively'
      if (score === 0) return 'Not mentioned'
      if (score === 1) return 'Mentioned (not main focus)'
      if (score === 2) return 'Main focus (informational)'
      if (score === 3) return 'Main focus (inspiring impact)'
      return 'Unknown'
    }

    // Convert each scraped content into an Article
    for (const scrapedContent of session.scrapedContent) {
      try {
        console.log(`📝 Creating article: ${scrapedContent.title}`)

        // Check if article already exists with this URL
        const existingArticle = await prisma.article.findFirst({
          where: { url: scrapedContent.discoveredUrl?.url }
        })

        if (existingArticle) {
          console.log(`⚠️ Article already exists for URL: ${scrapedContent.discoveredUrl?.url}`)
          console.log(`🔄 Enhancing existing article with Phase 3 processing...`)
          
          // Phase 3.1: Extract images from the article HTML (with fallback)
          console.log(`🖼️ Phase 3.1: Extracting images for existing article`)
          let extractedImages: any[] = []
          let sortedImages: any[] = []
          try {
            extractedImages = await extractImagesFromHtml(scrapedContent.discoveredUrl?.url || '')
            sortedImages = await sortImagesBySize(extractedImages)
            console.log(`📸 Successfully extracted ${sortedImages.length} images`)
            if (sortedImages.length > 0) {
              console.log(`🔍 Sample image data:`, { url: sortedImages[0]?.url, width: sortedImages[0]?.width, height: sortedImages[0]?.height })
            }
          } catch (error) {
            console.warn(`⚠️ Image extraction failed, continuing without images:`, error instanceof Error ? error.message : String(error))
            extractedImages = []
            sortedImages = []
          }
          
          // Phase 3.2: Use AI to select the best representative image (with fallback)
          console.log(`🤖 Phase 3.2: AI selecting best image from ${sortedImages.length} options`)
          let imageSelection: any = null
          try {
            imageSelection = await selectBestImage(
              sortedImages, 
              scrapedContent.title || existingArticle.title, 
              scrapedContent.summary || existingArticle.summary
            )
          } catch (error) {
            console.warn(`⚠️ AI image selection failed, continuing without featured image:`, error instanceof Error ? error.message : String(error))
          }
          
          // Phase 3.3: Use AI to format and improve the title (with fallback)
          console.log(`✏️ Phase 3.3: AI formatting title`)
          let titleFormatting: any = { 
            formattedTitle: scrapedContent.title || existingArticle.title, 
            changes: ['Fallback: kept original title'] 
          }
          try {
            titleFormatting = await formatArticleTitle(scrapedContent.title || existingArticle.title)
          } catch (error) {
            console.warn(`⚠️ AI title formatting failed, using original title:`, error instanceof Error ? error.message : String(error))
          }

          // Prepare image data for updating
          const imagesToUpdate = sortedImages.slice(0, 10).map(img => img.url)
          console.log(`💾 Updating with ${imagesToUpdate.length} images:`, imagesToUpdate.slice(0, 3))

          // Update existing article with enhanced data
          const updatedArticle = await prisma.article.update({
            where: { id: existingArticle.id },
            data: {
              title: titleFormatting.formattedTitle,
              content: scrapedContent.markdownContent || existingArticle.content,
              summary: scrapedContent.summary || existingArticle.summary,
              author: scrapedContent.author || existingArticle.author, // Use extracted author if available
              publishedAt: scrapedContent.publishedAt || existingArticle.publishedAt, // Use extracted publication date if available
              keywords: scrapedContent.keywords,
              images: imagesToUpdate,
              ogImage: imageSelection?.selectedImageUrl || existingArticle.ogImage,
              sentiment: getLegacySentiment(scrapedContent.sentimentScore), // Legacy format for admin UI
              organizationSentiment: getOrganizationSentiment(scrapedContent.sentimentScore),
              organizationRelevance: getOrganizationRelevance(scrapedContent.sentimentScore),
              validationReasons: scrapedContent.sentimentReasoning ? [scrapedContent.sentimentReasoning] : [],
              status: 'draft', // Set to draft for review
              updatedAt: new Date()
            }
          })

          console.log(`✅ Enhanced existing article:`)
          console.log(`   📝 Title: ${titleFormatting.formattedTitle}`)
          console.log(`   👤 Author: ${scrapedContent.author || existingArticle.author || 'None extracted'}`)
          console.log(`   📅 Published: ${scrapedContent.publishedAt?.toISOString() || existingArticle.publishedAt?.toISOString() || 'No date extracted'}`)
          console.log(`   🖼️ Images: ${sortedImages.length} extracted, OG: ${imageSelection?.selectedImageUrl ? 'Set' : 'Kept existing'}`)
          console.log(`   💭 AI changes: ${titleFormatting.changes.join(', ')}`)
          console.log(`   🎯 Image reason: ${imageSelection?.reason || 'No image selected'}`)
          console.log(`   📊 Score: ${scrapedContent.sentimentScore} - ${getScoreMeaning(scrapedContent.sentimentScore)}`)
          console.log(`   🏢 Org Classification: ${getOrganizationSentiment(scrapedContent.sentimentScore)}`)
          console.log(`   🎯 Org Relevance: ${getOrganizationRelevance(scrapedContent.sentimentScore)}`)


          createdArticles.push(updatedArticle.title || 'Untitled')
          articleIds.push(updatedArticle.id)
          successCount++
          continue
        }

        // Phase 3.1: Extract images from the article HTML (with fallback)
        console.log(`🖼️ Phase 3.1: Extracting images for "${scrapedContent.title}"`)
        let extractedImages: any[] = []
        let sortedImages: any[] = []
        try {
          extractedImages = await extractImagesFromHtml(scrapedContent.discoveredUrl?.url || '')
          sortedImages = await sortImagesBySize(extractedImages)
          console.log(`📸 Successfully extracted ${sortedImages.length} images`)
          if (sortedImages.length > 0) {
            console.log(`🔍 Sample image data:`, { url: sortedImages[0]?.url, width: sortedImages[0]?.width, height: sortedImages[0]?.height })
          }
        } catch (error) {
          console.warn(`⚠️ Image extraction failed, continuing without images:`, error instanceof Error ? error.message : String(error))
          extractedImages = []
          sortedImages = []
        }
        
        // Phase 3.2: Use AI to select the best representative image (with fallback)
        console.log(`🤖 Phase 3.2: AI selecting best image from ${sortedImages.length} options`)
        let imageSelection: any = null
        try {
          imageSelection = await selectBestImage(
            sortedImages, 
            scrapedContent.title || '', 
            scrapedContent.summary || ''
          )
        } catch (error) {
          console.warn(`⚠️ AI image selection failed, continuing without featured image:`, error instanceof Error ? error.message : String(error))
        }
        
        // Phase 3.3: Use AI to format and improve the title (with fallback)
        console.log(`✏️ Phase 3.3: AI formatting title`)
        let titleFormatting: any = { 
          formattedTitle: scrapedContent.title || 'Untitled Article', 
          changes: ['Fallback: kept original title'] 
        }
        try {
          titleFormatting = await formatArticleTitle(scrapedContent.title || 'Untitled Article')
        } catch (error) {
          console.warn(`⚠️ AI title formatting failed, using original title:`, error instanceof Error ? error.message : String(error))
        }

        // Prepare image data for saving
        const imagesToSave = sortedImages.slice(0, 10).map(img => img.url)
        console.log(`💾 Saving ${imagesToSave.length} images to database:`, imagesToSave.slice(0, 3))

        // Create new Article record with enhanced data
        const newArticle = await prisma.article.create({
          data: {
            organizationId: session.organizationId,
            title: titleFormatting.formattedTitle,
            content: scrapedContent.markdownContent || '',
            summary: scrapedContent.summary || '',
            url: scrapedContent.discoveredUrl?.url || '',
            author: scrapedContent.author || null, // Use extracted author
            publishedAt: scrapedContent.publishedAt || null, // Use extracted publication date
            keywords: scrapedContent.keywords,
            images: imagesToSave,
            ogImage: imageSelection?.selectedImageUrl || null,
            sentiment: getLegacySentiment(scrapedContent.sentimentScore), // Legacy format for admin UI
            organizationSentiment: getOrganizationSentiment(scrapedContent.sentimentScore),
            organizationRelevance: getOrganizationRelevance(scrapedContent.sentimentScore),
            validationReasons: scrapedContent.sentimentReasoning ? [scrapedContent.sentimentReasoning] : [],
            contentType: scrapedContent.discoveredUrl?.urlType || 'news',
            status: 'draft', // Set to draft for review
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })


        console.log(`✅ Enhanced article created:`)
        console.log(`   📝 Title: ${titleFormatting.formattedTitle}`)
        console.log(`   👤 Author: ${scrapedContent.author || 'None extracted'}`)
        console.log(`   📅 Published: ${scrapedContent.publishedAt?.toISOString() || 'No date extracted'}`)
        console.log(`   🖼️ Images: ${sortedImages.length} extracted, OG: ${imageSelection?.selectedImageUrl ? 'Set' : 'None'}`)
        console.log(`   💭 AI changes: ${titleFormatting.changes.join(', ')}`)
        console.log(`   🎯 Image reason: ${imageSelection?.reason || 'No image selected'}`)
        console.log(`   📊 Score: ${scrapedContent.sentimentScore} - ${getScoreMeaning(scrapedContent.sentimentScore)}`)
        console.log(`   🏢 Org Classification: ${getOrganizationSentiment(scrapedContent.sentimentScore)}`)
        console.log(`   🎯 Org Relevance: ${getOrganizationRelevance(scrapedContent.sentimentScore)}`)

        console.log(`✅ Created article: ${newArticle.title} (ID: ${newArticle.id})`)
        createdArticles.push(newArticle.title)
        articleIds.push(newArticle.id)
        successCount++

        // Update the scraped content to mark it as finalized
        await prisma.scrapedContent.update({
          where: { id: scrapedContent.id },
          data: { selectedForFinalization: true }
        })

      } catch (error) {
        console.error(`❌ Failed to create article from scraped content ${scrapedContent.id}:`, error)
        errors.push(`${scrapedContent.title || 'Untitled'}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        failedCount++
      }
    }

    // Update session status to completed
    await prisma.discoverySession.update({
      where: { id: sessionId },
      data: { 
        status: 'completed',
        updatedAt: new Date()
      }
    })

    console.log(`🎯 Phase 3 complete: ${successCount} articles created, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Successfully finalized ${successCount} articles`,
      successCount,
      failedCount,
      totalProcessed: selectedContentIds.length,
      createdArticles,
      articleIds,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Phase 3 POST error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during finalization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
