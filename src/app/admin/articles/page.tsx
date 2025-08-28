'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Button, Card, Badge, Spinner, Table, IconButton, Dialog, TextField, TextArea } from '@radix-ui/themes'
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
  featured: boolean
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
  
  // Edit modal state
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    content: '',
    ogImage: ''
  })

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

  const formatUrl = (url: string) => {
    // Remove common URL prefixes
    let cleanUrl = url
      .replace(/^https?:\/\/www\./, '')
      .replace(/^https?:\/\//, '')
    
    // If the cleaned URL is short enough, return it as is
    if (cleanUrl.length <= 27) { // 12 + 3 (dots) + 12 = 27
      return cleanUrl
    }
    
    // Take first 12 chars of cleaned URL + ... + last 12 chars of original URL
    const firstPart = cleanUrl.substring(0, 12)
    const lastPart = url.substring(url.length - 12)
    
    return `${firstPart}...${lastPart}`
  }

  const toggleFeatured = async (articleId: string, currentFeatured: boolean) => {
    try {
      setIsUpdating(true)
      const response = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: articleId,
          featured: !currentFeatured
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update the article in the local state
        setArticles(prev => prev.map(article => 
          article.id === articleId 
            ? { ...article, featured: !currentFeatured }
            : article
        ))
      } else {
        setError(data.error || 'Failed to update featured status')
      }
    } catch (err) {
      setError('Failed to update featured status')
      console.error('Featured toggle error:', err)
    } finally {
      setIsUpdating(false)
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

  const handleEdit = (article: Article) => {
    setEditingArticle(article)
    setEditForm({
      title: article.title,
      summary: article.summary || '',
      content: article.content || '',
      ogImage: article.ogImage || ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingArticle) return
    
    setIsUpdating(true)
    try {
      const success = await updateArticle(editingArticle.id, {
        title: editForm.title,
        summary: editForm.summary || null,
        content: editForm.content || null,
        ogImage: editForm.ogImage || null
      })
      
      if (success) {
        setEditingArticle(null)
        setEditForm({ title: '', summary: '', content: '', ogImage: '' })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingArticle(null)
    setEditForm({ title: '', summary: '', content: '', ogImage: '' })
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
        
        <Heading size="6" weight="light" mb="1">Article Management</Heading>

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
                <Table.ColumnHeaderCell>Published Date</Table.ColumnHeaderCell>
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
                      {article.publishedAt ? formatDate(article.publishedAt) : 'Not published'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatDate(article.createdAt)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '300px' }}>
                    <Text size="2" style={{ 
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
                      {formatUrl(article.url)}
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
                      <Button
                        size="1"
                        variant={article.featured ? "solid" : "soft"}
                        color={article.featured ? "orange" : "gray"}
                        onClick={() => toggleFeatured(article.id, article.featured)}
                        disabled={isUpdating}
                      >
                        {article.featured ? "★" : "☆"}
                      </Button>
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
                        onClick={() => handleEdit(article)}
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

      {/* Edit Article Dialog */}
      <Dialog.Root open={!!editingArticle} onOpenChange={(open) => !open && handleCancelEdit()}>
        <Dialog.Content style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
          <Dialog.Title>Edit Article</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Update the article title, summary, content, and main image.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            {/* Title Field */}
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Title</Text>
              <TextField.Root
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Article title..."
                size="3"
              />
            </Flex>

            {/* Summary Field */}
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Summary</Text>
              <TextArea
                value={editForm.summary}
                onChange={(e) => setEditForm(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Article summary..."
                rows={3}
                resize="vertical"
              />
            </Flex>

            {/* Content Field */}
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Content (Markdown)</Text>
              <TextArea
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Article content in markdown format..."
                rows={8}
                resize="vertical"
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            </Flex>

            {/* Image Selection */}
            {editingArticle && editingArticle.images.length > 0 && (
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Main Image ({editingArticle.images.length} available)
                </Text>
                <Flex gap="2" wrap="wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {editingArticle.images.map((imageUrl, index) => (
                    <Box
                      key={index}
                      onClick={() => setEditForm(prev => ({ ...prev, ogImage: imageUrl }))}
                      style={{
                        width: '120px',
                        height: '80px',
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: editForm.ogImage === imageUrl ? '3px solid var(--blue-9)' : '2px solid var(--gray-6)',
                        transition: 'border-color 0.2s',
                        position: 'relative'
                      }}
                    >
                      {editForm.ogImage === imageUrl && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'var(--blue-9)',
                            color: 'white',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px'
                          }}
                        >
                          ✓
                        </Box>
                      )}
                    </Box>
                  ))}
                </Flex>
                {editForm.ogImage && (
                  <Button
                    variant="soft"
                    size="1"
                    color="gray"
                    onClick={() => setEditForm(prev => ({ ...prev, ogImage: '' }))}
                  >
                    Clear Selection
                  </Button>
                )}
              </Flex>
            )}

            {/* Action Buttons */}
            <Flex gap="3" justify="end" mt="4">
              <Dialog.Close>
                <Button variant="soft" color="gray" disabled={isUpdating}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button 
                onClick={handleSaveEdit}
                disabled={isUpdating || !editForm.title.trim()}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      </Flex>
    </Box>
  )
}
