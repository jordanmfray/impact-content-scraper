'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Button, Card, Badge, Spinner, Table, IconButton } from '@radix-ui/themes'
import { CheckCircle, XCircle, Eye, PencilSimple, Trash, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr"

interface Article {
  id: string
  title: string
  summary: string | null
  content: string | null
  url: string
  author?: string | null
  publishedAt?: Date | null
  ogImage?: string | null
  images: string[]
  sentiment: string | null
  keywords: string[]
  createdAt: Date
  updatedAt: Date
  status: string
  organization: {
    id: string
    name: string
    logo?: string | null
  }
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchArticles()
  }, [statusFilter, pagination?.page])

  const fetchArticles = async (page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        status: statusFilter
      })
      
      const response = await fetch(`/api/admin/articles?${params}`)
      const data = await response.json()

      if (data.success) {
        setArticles(data.articles)
        setPagination(data.pagination)
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

  const updateArticle = async (articleId: string, updates: any) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: articleId,
          ...updates
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setArticles(prev => prev.map(article => 
          article.id === articleId ? { ...article, ...updates } : article
        ))
        return true
      } else {
        alert(`Error updating article: ${data.error}`)
        return false
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update article')
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteArticle = async (articleId: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: articleId })
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setArticles(prev => prev.filter(article => article.id !== articleId))
        return true
      } else {
        alert(`Error deleting article: ${data.error}`)
        return false
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete article')
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePublish = async (article: Article) => {
    const confirmed = confirm(`Are you sure you want to publish "${article.title}"? This will make it visible on the homepage.`)
    if (confirmed) {
      await updateArticle(article.id, { status: 'published' })
    }
  }

  const handleDelete = async (article: Article) => {
    const confirmed = confirm(`Are you sure you want to delete "${article.title}"? This action cannot be undone.`)
    if (confirmed) {
      await deleteArticle(article.id)
    }
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPagination(prev => prev ? { ...prev, page: 1 } : null)
  }

  const handlePageChange = (newPage: number) => {
    if (pagination && newPage >= 1 && newPage <= pagination.totalPages) {
      fetchArticles(newPage)
    }
  }

  const getSentimentPill = (sentiment: string | null) => {
    if (!sentiment) return <Badge color="gray">Unknown</Badge>
    
    switch (sentiment.toLowerCase()) {
      case 'pos':
      case 'positive':
        return <Badge color="green">Positive</Badge>
      case 'neg':
      case 'negative':
        return <Badge color="red">Negative</Badge>
      case 'neu':
      case 'neutral':
        return <Badge color="gray">Neutral</Badge>
      default:
        return <Badge color="gray">{sentiment}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge color="green">Published</Badge>
      case 'draft':
        return <Badge color="blue">Draft</Badge>
      case 'processing':
        return <Badge color="orange">Processing</Badge>
      case 'failed':
        return <Badge color="red">Failed</Badge>
      default:
        return <Badge color="gray">{status}</Badge>
    }
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && articles.length === 0) {
    return (
      <Flex direction="column" gap="6">
        <Heading size="6" weight="light">All Articles</Heading>
        <Flex justify="center" align="center" style={{ minHeight: '200px' }}>
          <Flex direction="column" align="center" gap="3">
            <Spinner size="3" />
            <Text color="gray">Loading articles...</Text>
          </Flex>
        </Flex>
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex direction="column" gap="6">
        <Heading size="6" weight="light">All Articles</Heading>
        <Flex justify="center" align="center" style={{ minHeight: '200px' }}>
          <Flex direction="column" align="center" gap="3">
            <Text size="5" color="red" weight="bold">Error</Text>
            <Text color="gray">{error}</Text>
            <Button onClick={() => fetchArticles()}>Retry</Button>
          </Flex>
        </Flex>
      </Flex>
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
        <Box mb="6" pb="4" style={{ borderBottom: '1px solid var(--gray-6)' }}>
          <Heading size="7" weight="bold" mb="1">📄 Article Management</Heading>
          <Text size="3" color="gray">
            Manage all articles with filtering and bulk actions
          </Text>
        </Box>

        <Flex justify="between" align="center">
          <Box>
            <Heading size="6" weight="light">All Articles</Heading>
            <Text size="3" color="gray">
              {pagination?.totalCount || 0} total article{(pagination?.totalCount || 0) !== 1 ? 's' : ''}
            </Text>
          </Box>
          <Button onClick={() => fetchArticles(pagination?.page || 1)} variant="soft">
            Refresh
          </Button>
        </Flex>

      {/* Filters */}
      <Card>
        <Flex gap="3" align="center">
          <Text weight="medium">Filter by status:</Text>
          <Button 
            variant={statusFilter === 'all' ? 'solid' : 'soft'} 
            onClick={() => handleStatusFilterChange('all')}
            size="2"
          >
            All
          </Button>
          <Button 
            variant={statusFilter === 'draft' ? 'solid' : 'soft'} 
            onClick={() => handleStatusFilterChange('draft')}
            size="2"
          >
            Draft
          </Button>
          <Button 
            variant={statusFilter === 'published' ? 'solid' : 'soft'} 
            onClick={() => handleStatusFilterChange('published')}
            size="2"
          >
            Published
          </Button>
        </Flex>
      </Card>

      {/* Articles Table */}
      {articles.length === 0 ? (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <Text size="4" color="gray">
            No articles found for the selected filter.
          </Text>
        </Card>
      ) : (
        <Card>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>State</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Date Scraped</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Article Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Organization</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Images</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Sentiment</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tools</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {articles.map((article) => (
                <Table.Row key={article.id}>
                  <Table.Cell>
                    {getStatusBadge(article.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatDate(article.createdAt)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '300px' }}>
                    <Text size="2" weight="medium" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {article.title}
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '200px' }}>
                    <Text size="2" color="gray" style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={article.url}>
                      {article.url.length > 40 ? `${article.url.substring(0, 40)}...` : article.url}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {article.organization.name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" color="blue">
                      {article.images.length}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {getSentimentPill(article.sentiment)}
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      <IconButton 
                        size="1" 
                        variant="soft" 
                        color="gray"
                        onClick={() => window.open(article.url, '_blank')}
                        disabled={isUpdating}
                      >
                        <Eye size={14} />
                      </IconButton>
                      <IconButton 
                        size="1" 
                        variant="soft" 
                        color="blue"
                        disabled={isUpdating}
                      >
                        <PencilSimple size={14} />
                      </IconButton>
                      {article.status === 'draft' && (
                        <IconButton 
                          size="1" 
                          variant="soft" 
                          color="green"
                          onClick={() => handlePublish(article)}
                          disabled={isUpdating}
                        >
                          <CheckCircle size={14} />
                        </IconButton>
                      )}
                      <IconButton 
                        size="1" 
                        variant="soft" 
                        color="red"
                        onClick={() => handleDelete(article)}
                        disabled={isUpdating}
                      >
                        <Trash size={14} />
                      </IconButton>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Flex justify="center" align="center" gap="4">
          <Button
            variant="soft"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev || loading}
          >
            <CaretLeft size={16} />
            Previous
          </Button>
          
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Page {pagination.page} of {pagination.totalPages}
            </Text>
          </Flex>
          
          <Button
            variant="soft"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
          >
            Next
            <CaretRight size={16} />
          </Button>
        </Flex>
      )}
      </Flex>
    </Box>
  )
}
