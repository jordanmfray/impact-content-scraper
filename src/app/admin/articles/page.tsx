'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Button, Card, Badge, Spinner, Table, IconButton, Dialog, TextField, TextArea, Select, Checkbox } from '@radix-ui/themes'
import { CheckCircle, XCircle, Eye, PencilSimple, Trash, CaretLeft, CaretRight, ArrowCounterClockwise, X, Check, Prohibit } from "@phosphor-icons/react/dist/ssr"

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
  inspirationRating?: string | null
  organizationSentiment?: string | null
  contentType?: string | null
  organizationRelevance?: string | null
  validationReasons: string[]
  organization: {
    id: string
    name: string
  }
}

interface Organization {
  id: string
  name: string
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
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Multi-select state
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set())
  const [isBulkActing, setIsBulkActing] = useState(false)
  
  // Pagination state
  const [pageSize, setPageSize] = useState<number>(100)
  
  // Edit modal state
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    content: '',
    ogImage: ''
  })

  // Load organizations on component mount
  useEffect(() => {
    fetchOrganizations()
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [statusFilter, organizationFilter, pagination?.page, pageSize])

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations')
      const data = await response.json()
      
      if (data.success) {
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }

  const fetchArticles = async (page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        status: statusFilter
      })
      
      if (organizationFilter && organizationFilter !== 'all') {
        params.set('organizationId', organizationFilter)
      }
      
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

  const getRootDomain = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, '')
    } catch {
      // Fallback for invalid URLs
      return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    }
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
    await updateArticle(article.id, { status: 'published' })
  }

  const handleDelete = async (article: Article) => {
    const confirmed = confirm(`Are you sure you want to delete "${article.title}"? This action cannot be undone.`)
    if (confirmed) {
      await deleteArticle(article.id)
    }
  }

  const handleReject = async (article: Article) => {
    await updateArticle(article.id, { 
      status: 'rejected',
      validationReasons: ['Manually rejected by admin']
    })
  }

  const handleRestoreFromRejected = async (article: Article) => {
    const confirmed = confirm(`Are you sure you want to restore "${article.title}" from rejected status? This will move it back to draft for review.`)
    if (confirmed) {
      await updateArticle(article.id, { status: 'draft' })
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

  // Multi-select handlers
  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles)
    if (checked) {
      newSelected.add(articleId)
    } else {
      newSelected.delete(articleId)
    }
    setSelectedArticles(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(articles.map(article => article.id))
      setSelectedArticles(allIds)
    } else {
      setSelectedArticles(new Set())
    }
  }

  const handleBulkPublish = async () => {
    if (selectedArticles.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to publish ${selectedArticles.size} selected articles?`)
    if (!confirmed) return

    setIsBulkActing(true)
    const errors: string[] = []
    
    try {
      for (const articleId of selectedArticles) {
        try {
          const success = await updateArticle(articleId, { status: 'published' })
          if (!success) {
            const article = articles.find(a => a.id === articleId)
            errors.push(article?.title || articleId)
          }
        } catch (error) {
          const article = articles.find(a => a.id === articleId)
          errors.push(article?.title || articleId)
        }
      }
      
      if (errors.length > 0) {
        alert(`Failed to publish ${errors.length} articles:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
      } else {
        alert(`Successfully published ${selectedArticles.size} articles!`)
      }
      
      // Clear selection
      setSelectedArticles(new Set())
      
    } catch (error) {
      alert('Bulk publish operation failed')
    } finally {
      setIsBulkActing(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedArticles.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to reject ${selectedArticles.size} selected articles?`)
    if (!confirmed) return

    setIsBulkActing(true)
    const errors: string[] = []
    
    try {
      for (const articleId of selectedArticles) {
        try {
          const success = await updateArticle(articleId, { 
            status: 'rejected',
            validationReasons: ['Bulk rejected by admin']
          })
          if (!success) {
            const article = articles.find(a => a.id === articleId)
            errors.push(article?.title || articleId)
          }
        } catch (error) {
          const article = articles.find(a => a.id === articleId)
          errors.push(article?.title || articleId)
        }
      }
      
      if (errors.length > 0) {
        alert(`Failed to reject ${errors.length} articles:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
      } else {
        alert(`Successfully rejected ${selectedArticles.size} articles!`)
      }
      
      // Clear selection
      setSelectedArticles(new Set())
      
    } catch (error) {
      alert('Bulk reject operation failed')
    } finally {
      setIsBulkActing(false)
    }
  }

  const clearSelection = () => {
    setSelectedArticles(new Set())
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPagination(prev => prev ? { ...prev, page: 1 } : null)
    setSelectedArticles(new Set()) // Clear selection when filter changes
  }

  const handleOrganizationFilterChange = (value: string) => {
    setOrganizationFilter(value)
    setPagination(prev => prev ? { ...prev, page: 1 } : null)
    setSelectedArticles(new Set()) // Clear selection when filter changes
  }

  const handlePageChange = (newPage: number) => {
    if (pagination && newPage >= 1 && newPage <= pagination.totalPages) {
      fetchArticles(newPage)
    }
  }

  const handlePageSizeChange = (newPageSize: string) => {
    const size = parseInt(newPageSize)
    setPageSize(size)
    setPagination(prev => prev ? { ...prev, page: 1 } : null) // Reset to page 1
    setSelectedArticles(new Set()) // Clear selection when page size changes
  }

  const getInspirationPill = (rating: string | null) => {
    if (!rating) return <Badge variant="soft" color="gray">Unknown</Badge>
    
    switch (rating) {
      case 'high':
        return <Badge variant="solid" color="green">High ⭐</Badge>
      case 'medium':
        return <Badge variant="soft" color="orange">Medium</Badge>
      case 'low':
        return <Badge variant="soft" color="gray">Low</Badge>
      default:
        return <Badge variant="soft" color="gray">Unknown</Badge>
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
      case 'rejected':
        return <Badge color="red">Rejected</Badge>
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
        <Flex direction="column" gap="4">
          {/* Status Filter */}
          <Flex gap="3" align="center" wrap="wrap">
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
            <Button 
              variant={statusFilter === 'rejected' ? 'solid' : 'soft'} 
              onClick={() => handleStatusFilterChange('rejected')}
              size="2"
              color="red"
            >
              Rejected
            </Button>
          </Flex>
          
          {/* Organization Filter */}
          <Flex gap="3" align="center">
            <Text weight="medium">Filter by organization:</Text>
            <Select.Root value={organizationFilter} onValueChange={handleOrganizationFilterChange}>
              <Select.Trigger style={{ width: '300px' }} />
              <Select.Content>
                <Select.Item value="all">All Organizations</Select.Item>
                {organizations.map((org) => (
                  <Select.Item key={org.id} value={org.id}>
                    {org.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
      </Card>

      {/* Bulk Actions */}
      {selectedArticles.size > 0 && (
        <Card>
          <Flex align="center" justify="between">
            <Flex align="center" gap="3">
              <Text weight="medium" color="blue">
                {selectedArticles.size} article{selectedArticles.size !== 1 ? 's' : ''} selected
              </Text>
              <Button 
                size="2" 
                variant="soft" 
                color="gray" 
                onClick={clearSelection}
                disabled={isBulkActing}
              >
                Clear Selection
              </Button>
            </Flex>
            <Flex gap="2">
              <Button 
                size="2" 
                color="green" 
                onClick={handleBulkPublish}
                disabled={isBulkActing || isUpdating}
                loading={isBulkActing}
              >
                <Check size={16} />
                Publish Selected
              </Button>
              <Button 
                size="2" 
                color="red" 
                variant="soft"
                onClick={handleBulkReject}
                disabled={isBulkActing || isUpdating}
                loading={isBulkActing}
              >
                <Prohibit size={16} />
                Reject Selected
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}

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
                <Table.ColumnHeaderCell>
                  <Checkbox
                    checked={selectedArticles.size === articles.length && articles.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    disabled={isUpdating || isBulkActing}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>State</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Published Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Date Scraped</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Article Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Validation</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Organization</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Images</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Sentiment</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Inspiration</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tools</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {articles.map((article) => (
                <Table.Row key={article.id}>
                  <Table.Cell>
                    <Checkbox
                      checked={selectedArticles.has(article.id)}
                      onCheckedChange={(checked) => handleSelectArticle(article.id, checked === true)}
                      disabled={isUpdating || isBulkActing}
                    />
                  </Table.Cell>
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
                    {article.status === 'rejected' && article.validationReasons && article.validationReasons.length > 0 ? (
                      <Text size="1" color="red" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }} title={article.validationReasons.join('; ')}>
                        {article.validationReasons.join('; ')}
                      </Text>
                    ) : article.organizationSentiment ? (
                      <Text size="1" color="gray">
                        {article.organizationSentiment} • {article.contentType} • {article.organizationRelevance}
                      </Text>
                    ) : (
                      <Text size="1" color="gray">-</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '200px' }}>
                    <Text size="2" color="blue" style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }} title={article.url} onClick={() => window.open(article.url, '_blank')}>
                      {getRootDomain(article.url)}
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
                    {getInspirationPill(article.inspirationRating || null)}
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
                        <>
                          <IconButton 
                            size="1" 
                            variant="soft" 
                            color="green"
                            onClick={() => handlePublish(article)}
                            disabled={isUpdating}
                            title="Publish Article"
                          >
                            <CheckCircle size={14} />
                          </IconButton>
                          <IconButton 
                            size="1" 
                            variant="soft" 
                            color="orange"
                            onClick={() => handleReject(article)}
                            disabled={isUpdating}
                            title="Reject Article"
                          >
                            <X size={14} />
                          </IconButton>
                        </>
                      )}
                      {article.status === 'rejected' && (
                        <IconButton 
                          size="1" 
                          variant="soft" 
                          color="blue"
                          onClick={() => handleRestoreFromRejected(article)}
                          disabled={isUpdating}
                          title="Restore to Draft"
                        >
                          <ArrowCounterClockwise size={14} />
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
      {pagination && (
        <Card>
          <Flex justify="between" align="center" wrap="wrap" gap="4">
            {/* Left side - Results info and page size selector */}
            <Flex align="center" gap="4" wrap="wrap">
              <Text size="2" color="gray">
                Showing {((pagination.page - 1) * pageSize) + 1}-{Math.min(pagination.page * pageSize, pagination.totalCount)} of {pagination.totalCount.toLocaleString()} articles
              </Text>
              <Flex align="center" gap="2">
                <Text size="2" color="gray">Show:</Text>
                <Select.Root value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <Select.Trigger style={{ width: '80px' }} />
                  <Select.Content>
                    <Select.Item value="50">50</Select.Item>
                    <Select.Item value="100">100</Select.Item>
                    <Select.Item value="200">200</Select.Item>
                    <Select.Item value="500">500</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Flex>
            
            {/* Right side - Pagination controls */}
            {pagination.totalPages > 1 && (
              <Flex align="center" gap="2">
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1 || loading}
                >
                  First
                </Button>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev || loading}
                >
                  <CaretLeft size={16} />
                  Previous
                </Button>
                
                <Flex align="center" gap="1">
                  <Text size="2" color="gray">Page</Text>
                  <Text size="2" weight="bold">{pagination.page}</Text>
                  <Text size="2" color="gray">of</Text>
                  <Text size="2" weight="bold">{pagination.totalPages}</Text>
                </Flex>
                
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext || loading}
                >
                  Next
                  <CaretRight size={16} />
                </Button>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages || loading}
                >
                  Last
                </Button>
              </Flex>
            )}
          </Flex>
        </Card>
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
