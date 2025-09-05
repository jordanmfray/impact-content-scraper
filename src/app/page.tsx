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

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
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
  
  // Pagination state
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch articles with filters
  const fetchArticles = useCallback(async (page: number = currentPage) => {
    try {
      console.time('🔄 Filter articles')
      setIsFiltering(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20' // Better pagination with smaller pages
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
        setPagination(data.pagination)
        setCurrentPage(page)
        setError(null)
        console.timeEnd('⚡ Update state')
        console.log(`✅ Loaded ${data.articles.length} articles (page ${page}/${data.pagination?.totalPages})`)
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
  }, [organizationFilter, currentPage])

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
    setCurrentPage(1) // Reset to first page when filter changes
  }, [])

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
    fetchArticles(newPage)
  }, [fetchArticles])

  const handlePrevPage = useCallback(() => {
    if (pagination?.hasPrevPage) {
      handlePageChange(currentPage - 1)
    }
  }, [pagination?.hasPrevPage, currentPage, handlePageChange])

  const handleNextPage = useCallback(() => {
    if (pagination?.hasNextPage) {
      handlePageChange(currentPage + 1)
    }
  }, [pagination?.hasNextPage, currentPage, handlePageChange])

  const fetchInitialArticles = useCallback(async () => {
    try {
      console.time('🚀 Initial load')
      setLoading(true)
      const response = await fetch('/api/articles?page=1&limit=20')
      const data = await response.json()

      if (data.success) {
        setArticles(data.articles)
        setPagination(data.pagination)
        setCurrentPage(1)
        console.log(`🏁 Initial load: ${data.articles.length} articles (page 1/${data.pagination?.totalPages})`)
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

  // Trigger search when filters change (but not on initial load)
  useEffect(() => {
    if (organizationFilter !== 'all') {
      fetchArticles(1) // Always start from page 1 when filter changes
    } else if (currentPage === 1) {
      fetchInitialArticles()
    } else {
      fetchArticles(currentPage)
    }
  }, [organizationFilter]) // Remove fetchArticles from deps to prevent loops

  // Handle page changes
  useEffect(() => {
    // Only fetch if not initial load (currentPage starts at 1)
    if (currentPage > 1 || (currentPage === 1 && organizationFilter === 'all' && articles.length > 0)) {
      fetchArticles(currentPage)
    }
  }, [currentPage]) // Simplified deps

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

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <Flex justify="center" align="center" gap="4" mt="6">
            <Button
              variant="soft"
              disabled={!pagination.hasPrevPage || isFiltering}
              onClick={handlePrevPage}
            >
              Previous
            </Button>
            
            <Flex align="center" gap="2">
              <Text size="2" color="gray">
                Page
              </Text>
              <Text size="2" weight="bold">
                {currentPage}
              </Text>
              <Text size="2" color="gray">
                of {pagination.totalPages}
              </Text>
            </Flex>
            
            <Button
              variant="soft" 
              disabled={!pagination.hasNextPage || isFiltering}
              onClick={handleNextPage}
            >
              Next
            </Button>
          </Flex>
        )}

        {/* Stats Footer */}
        <Flex justify="center" mt="6">
          <Text size="2" color="gray">
            {pagination ? (
              organizationFilter !== 'all' ? (
                <>
                  Found {pagination.total} article{pagination.total === 1 ? '' : 's'} from {organizations.find(org => org.id === organizationFilter)?.name || 'selected organization'}
                  {pagination.totalPages > 1 && (
                    <> • Showing {articles.length} on this page</>
                  )}
                </>
              ) : (
                <>
                  Showing {pagination.total} article{pagination.total === 1 ? '' : 's'} from {new Set(articles.map(a => a.organization.name)).size} organization{new Set(articles.map(a => a.organization.name)).size === 1 ? '' : 's'}
                  {pagination.totalPages > 1 && (
                    <> • Page {currentPage} of {pagination.totalPages}</>
                  )}
                </>
              )
            ) : (
              <>Loading...</>
            )}
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}