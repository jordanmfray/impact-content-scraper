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
  featured: boolean
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Prioritize featured articles, then fallback to articles with images
  const spotlightArticles = useMemo(() => {
    // First, get featured articles
    const featuredArticles = articles.filter(article => article.featured)
    
    if (featuredArticles.length >= 4) {
      return featuredArticles.slice(0, 4)
    }
    
    // If we don't have enough featured articles, add non-featured articles with images
    const remainingSlots = 4 - featuredArticles.length
    const nonFeaturedWithImages = articles
      .filter(article => !article.featured && article.ogImage && article.ogImage.trim() !== '')
      .slice(0, remainingSlots)
    
    const combined = [...featuredArticles, ...nonFeaturedWithImages]
    
    if (combined.length > 0) {
      return combined
    } else {
      // Fallback to any articles if none have images or are featured
      return articles.slice(0, 4)
    }
  }, [articles])

  // Use hovered article when hovering, otherwise use active article
  const displayIndex = isHovering && hoveredIndex !== null ? hoveredIndex : activeIndex
  const activeArticle = spotlightArticles[displayIndex]

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
    if (isPaused || isHovering || spotlightArticles.length <= 1) return

    const interval = setInterval(nextSlide, 4000) // Change every 4 seconds
    return () => clearInterval(interval)
  }, [nextSlide, isPaused, isHovering, spotlightArticles.length])

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

  // Handle hover on article list items
  const handleMouseEnter = (index: number) => {
    setHoveredIndex(index)
    setIsHovering(true)
    setImageKey(prev => prev + 1) // Trigger image transition
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
    setIsHovering(false)
    setImageKey(prev => prev + 1) // Trigger image transition back
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
            {spotlightArticles.map((article, index) => {
              const isActive = index === activeIndex
              const isHovered = hoveredIndex === index
              const isDisplayed = isActive || isHovered
              
              return (
                <Box
                  key={article.id}
                  onClick={() => handleCardClick(index, article)}
                  onMouseEnter={() => handleMouseEnter(index)}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    cursor: 'pointer',
                    padding: '16px 20px',
                    borderBottom: index < spotlightArticles.length - 1 ? '1px solid var(--gray-4)' : 'none',
                    borderLeft: isDisplayed ? '2px solid #393939' : '2px solid var(--gray-6)',
                    backgroundColor: isDisplayed ? 'var(--accent-1)' : (isHovered ? 'var(--gray-1)' : 'transparent'),
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
                    color: isDisplayed ? '#404040' : (isHovered ? '#606060' : '#8F8F8F'),
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {article.title}
                </Text>
              </Box>
              )
            })}
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
