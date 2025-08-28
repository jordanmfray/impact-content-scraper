'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Flex, Text, Heading } from "@radix-ui/themes"
import { ArticlePreviewDrawer } from './ArticlePreviewDrawer'
import { OrganizationInfo } from './ArticleCards'

interface Article {
  id: string
  title: string
  summary: string | null
  content?: string | null
  url: string
  author?: string | null
  publishedAt?: Date | null
  ogImage?: string | null
  sentiment: string | null
  keywords: string[]
  createdAt: Date
  organization: {
    id: string
    name: string
    logo?: string | null
  }
}

interface SpotlightCarouselProps {
  articles: Article[]
  onFeaturedArticlesChange?: (featuredArticles: Article[]) => void
}

export function SpotlightCarousel({ articles, onFeaturedArticlesChange }: SpotlightCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [imageKey, setImageKey] = useState(0)

  // Filter for articles with images first, then fallback to all articles if needed
  const spotlightArticles = useMemo(() => {
    const articlesWithImages = articles.filter(article => article.ogImage && article.ogImage.trim() !== '')
    
    if (articlesWithImages.length >= 4) {
      return articlesWithImages.slice(0, 4)
    } else if (articlesWithImages.length > 0) {
      return articlesWithImages.slice(0, Math.max(articlesWithImages.length, 1))
    } else {
      return articles.slice(0, 4) // Fallback to any articles if none have images
    }
  }, [articles])

  const activeArticle = spotlightArticles[activeIndex]

  // Notify parent component of featured articles
  useEffect(() => {
    if (onFeaturedArticlesChange) {
      onFeaturedArticlesChange(spotlightArticles)
    }
  }, [spotlightArticles, onFeaturedArticlesChange])

  // Auto-play functionality
  const nextSlide = useCallback(() => {
    if (spotlightArticles.length <= 1) return
    setActiveIndex((prev) => (prev + 1) % spotlightArticles.length)
    setImageKey(prev => prev + 1) // Force image transition
  }, [spotlightArticles.length])

  useEffect(() => {
    if (isPaused || spotlightArticles.length <= 1) return

    const interval = setInterval(nextSlide, 4000) // Change every 4 seconds
    return () => clearInterval(interval)
  }, [nextSlide, isPaused, spotlightArticles.length])

  // Handle manual selection
  const handleCardClick = (index: number, article: Article) => {
    setActiveIndex(index)
    setImageKey(prev => prev + 1)
    setSelectedArticle(article)
    setPreviewOpen(true)
    setIsPaused(true)
    
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsPaused(false), 10000)
  }

  // Handle main image click
  const handleImageClick = () => {
    if (activeArticle) {
      setSelectedArticle(activeArticle)
      setPreviewOpen(true)
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 10000)
    }
  }

  if (spotlightArticles.length === 0) {
    return (
      <Box style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-3)' }}>
        <Text color="gray">No articles available for spotlight. Articles need images to be featured.</Text>
      </Box>
    )
  }

  return (
    <>
      <Flex gap="6" style={{ minHeight: '400px' }}>
        {/* Left Side - Clean Featured Image */}
        <Box style={{ flex: '2', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-3)' }}>
          <Box
            key={`spotlight-image-${imageKey}`} // Force re-render for fade effect
            onClick={handleImageClick}
            style={{
              height: '400px',
              background: activeArticle?.ogImage 
                ? `url(${activeArticle.ogImage})` 
                : 'linear-gradient(135deg, var(--blue-9), var(--purple-9))',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer',
              opacity: 0,
              animation: 'fadeIn 0.6s ease-in-out forwards',
              borderRadius: 'var(--radius-3)',
              overflow: 'hidden'
            }}
          >
            {/* Minimal fallback for no image */}
            {!activeArticle?.ogImage && (
              <Box
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}
              >
                <Text size="8" weight="bold" style={{ color: 'white', opacity: 0.9 }}>
                  {activeArticle?.organization.name}
                </Text>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Side - Clean Article List */}
        <Box style={{ flex: '1' }}>
          <Box>
            {spotlightArticles.map((article, index) => (
              <Box
                key={article.id}
                onClick={() => handleCardClick(index, article)}
                style={{
                  cursor: 'pointer',
                  padding: '16px 20px',
                  borderBottom: index < spotlightArticles.length - 1 ? '1px solid var(--gray-4)' : 'none',
                  borderLeft: index === activeIndex ? '2px solid #393939' : '2px solid var(--gray-6)',
                  backgroundColor: index === activeIndex ? 'var(--accent-1)' : 'transparent',
                  transition: 'all 0.3s ease',
                  marginLeft: '-1px' // Offset for border alignment
                }}
              >
                {/* Organization */}
                <Box mb="1">
                  <OrganizationInfo 
                    organization={article.organization} 
                    variant="small"
                    colorScheme="blue"
                  />
                </Box>

                {/* Article title */}
                <Text 
                  size="3" 
                  weight="bold" 
                  style={{ 
                    lineHeight: '1.4',
                    fontWeight: '400',
                    height: '2.8em', // Fixed height for exactly 2 lines (1.4 * 2)
                    color: index === activeIndex ? '#404040' : '#8F8F8F',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {article.title}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Flex>

      {/* Preview Drawer */}
      {selectedArticle && (
        <ArticlePreviewDrawer
          article={selectedArticle}
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false)
            setSelectedArticle(null)
          }}
        />
      )}

      {/* CSS for fade animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(1.05);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  )
}
