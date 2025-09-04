'use client'

import { Heading, Text, Flex, Box, Spinner, Skeleton, Card, Select, Button } from "@radix-ui/themes"
import { useState, useEffect, useCallback } from "react"
import { GridCard } from "@/components/ArticleCards"
import { X } from "@phosphor-icons/react/dist/ssr"

interface Article {
  id: string
  title: string
  url: string
  organization: {
    id: string
    name: string
  }
}

interface Organization {
  id: string
  name: string
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter state
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [isFiltering, setIsFiltering] = useState(false)

  // Fetch articles with filters
  const fetchArticles = useCallback(async () => {
    try {
      console.time('🔄 Filter articles')
      setIsFiltering(true)
      const params = new URLSearchParams({
        limit: '50' // Reduced from 100 for better performance
      })
      
      if (organizationFilter && organizationFilter !== 'all') {
        params.set('organizationId', organizationFilter)
      }
      
      console.time('📡 API call')
      const response = await fetch(`/api/articles?${params}`)
      const data = await response.json()
      console.timeEnd('📡 API call')

      if (data.success) {
        console.time('⚡ Update state')
        setArticles(data.articles)
        setError(null)
        console.timeEnd('⚡ Update state')
        console.log(`✅ Loaded ${data.articles.length} articles`)
      } else {
        setError(data.error || 'Failed to fetch articles')
      }
    } catch (err) {
      setError('Failed to fetch articles')
      console.error('Articles fetch error:', err)
    } finally {
      setIsFiltering(false)
      console.timeEnd('🔄 Filter articles')
    }
  }, [organizationFilter])

  // Fetch organizations for filter dropdown
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations')
      const data = await response.json()
      
      if (data.success) {
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }, [])

  // Filter handlers
  const handleOrganizationChange = useCallback((value: string) => {
    setOrganizationFilter(value)
  }, [])

  const fetchInitialArticles = useCallback(async () => {
    try {
      console.time('🚀 Initial load')
      setLoading(true)
      const response = await fetch('/api/articles?limit=50') // Reduced for performance
      const data = await response.json()

      if (data.success) {
        setArticles(data.articles)
        console.log(`🏁 Initial load: ${data.articles.length} articles`)
      } else {
        setError(data.error || 'Failed to fetch articles')
      }
    } catch (err) {
      setError('Failed to fetch articles')
      console.error('Articles fetch error:', err)
    } finally {
      setLoading(false)
      console.timeEnd('🚀 Initial load')
    }
  }, [])

  useEffect(() => {
    fetchInitialArticles()
    fetchOrganizations()
  }, [fetchInitialArticles, fetchOrganizations])

  // Trigger search when organization filter changes
  useEffect(() => {
    if (organizationFilter !== 'all') {
      fetchArticles()
    } else {
      fetchInitialArticles()
    }
  }, [organizationFilter, fetchArticles, fetchInitialArticles])

  if (loading) {
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
            <Heading size="6" weight="light">Articles</Heading>
          </Flex>

          {/* Filters Skeleton */}
          <Box style={{
            backgroundColor: 'var(--gray-3)',
            borderRadius: '8px',
            padding: '20px',
            height: '80px'
          }}>
            <Flex align="center" gap="4">
              <Skeleton style={{ width: '300px', height: '32px' }} />
              <Skeleton style={{ width: '200px', height: '32px' }} />
              <Skeleton style={{ width: '100px', height: '32px' }} />
            </Flex>
          </Box>

          {/* Grid Cards Skeleton */}
          <Box className="grid-cards-container">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
          <Heading size="6" weight="light">Articles</Heading>
        </Flex>

        {/* Filters Section */}
        <Flex direction="column" gap="4">
          <Flex align="center" gap="4">
            {/* Organization Filter */}
            <Flex align="center" gap="2">
              <Text size="2" weight="medium">
                Filter by organization:
              </Text>
              <Select.Root value={organizationFilter} onValueChange={handleOrganizationChange}>
                <Select.Trigger style={{ width: '200px' }} />
                <Select.Content>
                  <Select.Item value="all">All Organizations</Select.Item>
                  {organizations.map((org) => (
                    <Select.Item key={org.id} value={org.id}>
                      {org.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {isFiltering && (
                <Spinner size="2" />
              )}
            </Flex>
          </Flex>

          {/* Active Filters Display */}
          {organizationFilter !== 'all' && (
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="2" color="gray">Active filter:</Text>
              <Button 
                size="1" 
                variant="soft" 
                color="green"
                onClick={() => setOrganizationFilter('all')}
              >
                {organizations.find(org => org.id === organizationFilter)?.name || 'Organization'} <X height="12" width="12" style={{ marginLeft: '4px' }} />
              </Button>
            </Flex>
          )}
        </Flex>

        {/* Articles Grid */}
        {articles.length > 0 ? (
          <Box className="grid-cards-container">
            {articles.map((article, index) => {
              const variants: Array<'blue' | 'green' | 'yellow'> = ['blue', 'green', 'yellow']
              const variant = variants[index % variants.length]
              return (
                <GridCard key={article.id} article={article} variant={variant} />
              )
            })}
          </Box>
        ) : (
          <Card style={{ padding: '48px', textAlign: 'center' }}>
            <Flex direction="column" align="center" gap="3">
              <Text size="4" color="gray" weight="bold">
                {organizationFilter !== 'all' ? 'No articles found' : 'No articles available'}
              </Text>
              <Text size="2" color="gray">
                {organizationFilter !== 'all' ? 
                  'Try selecting a different organization' : 
                  'Articles will appear here once they are published'
                }
              </Text>
            </Flex>
          </Card>
        )}

        {/* Stats Footer */}
        <Flex justify="center" mt="6">
          <Text size="2" color="gray">
            {organizationFilter !== 'all' ? (
              <>
                Found {articles.length} article{articles.length === 1 ? '' : 's'} from {organizations.find(org => org.id === organizationFilter)?.name || 'selected organization'}
              </>
            ) : (
              <>
                Showing {articles.length} article{articles.length === 1 ? '' : 's'} from {new Set(articles.map(a => a.organization.name)).size} organization{new Set(articles.map(a => a.organization.name)).size === 1 ? '' : 's'}
              </>
            )}
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}