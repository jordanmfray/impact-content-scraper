'use client'

import { Heading, Text, Flex, Box, Spinner, Skeleton } from "@radix-ui/themes"
import { useState, useEffect, useCallback } from "react"
import { HeroCard, RowCard, GridCard } from "@/components/ArticleCards"
import { SpotlightCarousel } from "@/components/SpotlightCarousel"

interface Article {
  id: string
  title: string
  summary: string | null
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

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize the callback to prevent infinite re-renders
  const handleFeaturedArticlesChange = useCallback((newFeaturedArticles: Article[]) => {
    setFeaturedArticles(newFeaturedArticles)
  }, [])

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true)
        const response = await fetch('/api/articles?limit=50')
        const data = await response.json()

        if (data.success) {
          setArticles(data.articles)
        } else {
          setError(data.error || 'Failed to fetch articles')
        }
      } catch (err) {
        setError('Failed to fetch articles')
        console.error('Articles fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [])

  if (loading) {
    return (
      <Box style={{ 
        marginLeft: '310px',
        marginRight: '34px',
        paddingTop: '24px',
        paddingBottom: '24px'
      }}>
        <Flex direction="column" gap="6">
          {/* Spotlight Section Header */}
          <Flex direction="column" gap="2">
            <Heading size="6" weight="light">Spotlight</Heading>
          </Flex>

          {/* Hero + Row Cards Skeleton Layout */}
          <Flex gap="6" style={{ minHeight: '400px' }}>
            {/* Left Side - Hero Card Skeleton */}
            <Box style={{ flex: '2' }}>
              <Box style={{
                backgroundColor: 'var(--gray-3)',
                borderRadius: '8px',
                padding: '24px',
                height: '400px',
                position: 'relative'
              }}>
                <Flex direction="column" gap="4" height="100%">
                  {/* Organization info skeleton */}
                  <Flex align="center" gap="2">
                    <Skeleton style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                    <Skeleton style={{ width: '120px', height: '16px' }} />
                  </Flex>
                  
                  {/* Title skeleton */}
                  <Flex direction="column" gap="2">
                    <Skeleton style={{ width: '100%', height: '32px' }} />
                    <Skeleton style={{ width: '80%', height: '32px' }} />
                  </Flex>
                  
                  {/* Summary skeleton */}
                  <Flex direction="column" gap="2">
                    <Skeleton style={{ width: '100%', height: '16px' }} />
                    <Skeleton style={{ width: '100%', height: '16px' }} />
                    <Skeleton style={{ width: '60%', height: '16px' }} />
                  </Flex>
                  
                  {/* Date skeleton */}
                  <Box style={{ marginTop: 'auto' }}>
                    <Skeleton style={{ width: '100px', height: '14px' }} />
                  </Box>
                </Flex>
              </Box>
            </Box>

            {/* Right Side - Row Cards Skeletons */}
            <Box style={{ flex: '1' }}>
              <Flex direction="column" gap="3">
                {[1, 2, 3].map((i) => (
                  <Box key={i} style={{
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '8px',
                    padding: '16px',
                    height: '120px'
                  }}>
                    <Flex gap="3" height="100%">
                      {/* Image skeleton */}
                      <Skeleton style={{ width: '80px', height: '80px', borderRadius: '4px', flexShrink: 0 }} />
                      
                      {/* Content skeleton */}
                      <Flex direction="column" gap="2" style={{ flex: 1 }}>
                        <Flex align="center" gap="2">
                          <Skeleton style={{ width: '16px', height: '16px', borderRadius: '2px' }} />
                          <Skeleton style={{ width: '80px', height: '12px' }} />
                        </Flex>
                        <Skeleton style={{ width: '100%', height: '16px' }} />
                        <Skeleton style={{ width: '80%', height: '16px' }} />
                        <Box style={{ marginTop: 'auto' }}>
                          <Skeleton style={{ width: '60px', height: '12px' }} />
                        </Box>
                      </Flex>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Box>
          </Flex>

          {/* Most Recent Section */}
          <Flex direction="column" gap="2" mt="4">
            <Heading size="6" weight="light">Most Recent</Heading>
          </Flex>

          {/* Grid Cards Skeleton */}
          <Box className="grid-cards-container">
            {[1, 2, 3, 4].map((i) => (
              <Box key={i} style={{
                backgroundColor: 'var(--gray-3)',
                borderRadius: '4px',
                padding: '20px',
                minHeight: '200px'
              }}>
                <Flex direction="column" gap="3">
                  {/* Organization info skeleton */}
                  <Flex align="center" gap="2">
                    <Skeleton style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                    <Skeleton style={{ width: '100px', height: '14px' }} />
                  </Flex>
                  
                  {/* Title skeleton */}
                  <Flex direction="column" gap="2">
                    <Skeleton style={{ width: '100%', height: '24px' }} />
                    <Skeleton style={{ width: '80%', height: '24px' }} />
                  </Flex>
                  
                  {/* Date skeleton */}
                  <Skeleton style={{ width: '80px', height: '12px' }} />
                  
                  {/* Source skeleton */}
                  <Skeleton style={{ width: '120px', height: '12px' }} />
                </Flex>
              </Box>
            ))}
          </Box>

          {/* Loading indicator */}
          <Flex justify="center" align="center" gap="2" mt="4">
            <Spinner size="2" />
            <Text size="2" color="gray">Loading articles...</Text>
          </Flex>
        </Flex>
      </Box>
    )
  }

  if (error) {
    return (
      <Box style={{ 
        marginLeft: '310px',
        marginRight: '34px',
        paddingTop: '24px',
        paddingBottom: '24px'
      }}>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="2">
            <Heading size="6" weight="light">Articles</Heading>
          </Flex>
          
          <Flex align="center" justify="center" style={{ minHeight: '300px' }}>
            <Flex direction="column" align="center" gap="3">
              <Text size="5" color="red" weight="bold">Error</Text>
              <Text color="gray" style={{ textAlign: 'center' }}>
                {error}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    )
  }

  if (articles.length === 0) {
    return (
      <Box style={{ 
        marginLeft: '310px',
        marginRight: '34px',
        paddingTop: '24px',
        paddingBottom: '24px'
      }}>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="2">
            <Heading size="6" weight="light">Articles</Heading>
          </Flex>
          
          <Flex align="center" justify="center" style={{ minHeight: '300px' }}>
            <Flex direction="column" align="center" gap="3">
              <Text size="5" color="gray" weight="bold">No Articles Found</Text>
              <Text color="gray" style={{ textAlign: 'center' }}>
                No articles have been seeded yet. Run the seeding script to populate with sample articles.
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    )
  }

  // Articles for grid section (exclude featured articles from spotlight)
  const featuredIds = new Set(featuredArticles.map(article => article.id))
  const gridArticles = articles
    .filter(article => !featuredIds.has(article.id))
    .slice(0, 46) // Show up to 46 grid articles (4 in spotlight + 46 in grid = 50 total)

  return (
    <Box style={{ 
      marginLeft: '310px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Heading size="6" weight="light">Spotlight</Heading>
        </Flex>

        {/* Spotlight Carousel */}
        <SpotlightCarousel 
          articles={articles} 
          onFeaturedArticlesChange={handleFeaturedArticlesChange}
        />

        {/* Grid Cards Section */}
        {gridArticles.length > 0 && (
          <>
            <Flex direction="column" gap="2" mt="4">
              <Heading size="6" weight="light">Most Recent</Heading>
            </Flex>

            <Box className="grid-cards-container">
              {gridArticles.map((article, index) => {
                const variants: Array<'blue' | 'green' | 'yellow'> = ['blue', 'green', 'yellow']
                const variant = variants[index % variants.length]
                return (
                  <GridCard key={article.id} article={article} variant={variant} />
                )
              })}
            </Box>
          </>
        )}

        {/* Stats Footer */}
        <Flex justify="center" mt="6">
          <Text size="2" color="gray">
            Showing {articles.length} article{articles.length === 1 ? '' : 's'} from {new Set(articles.map(a => a.organization.name)).size} organization{new Set(articles.map(a => a.organization.name)).size === 1 ? '' : 's'}
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}