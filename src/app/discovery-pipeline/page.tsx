'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heading, Text, Flex, Box, Card, Button, Select, Table, Checkbox, Badge, Progress, Separator, IconButton, TextArea } from '@radix-ui/themes'
import { Play, CheckCircle, Clock, Eye, Sparkle, ArrowRight, PencilSimple, Trash, X, Link } from '@phosphor-icons/react'

interface Organization {
  id: string
  name: string
  newsUrl?: string | null
  publishedArticleCount?: number
}

interface DiscoverySession {
  id: string
  organizationId: string
  organizationName: string
  newsUrl: string
  status: string
  totalUrls: number
  selectedUrls: number
  processedUrls: number
  scrapedArticles?: number
  createdAt: string
  updatedAt: string
}

interface DiscoveredUrl {
  id: string
  url: string
  urlType: 'news' | 'post'
  domain: string
  titlePreview?: string
  selectedForScraping: boolean
  scrapeStatus: string
}

interface ScrapedContent {
  id: string
  title?: string
  summary?: string
  url: string
  urlType: 'news' | 'post'
  domain: string
  sentimentScore?: number
  sentimentReasoning?: string
  keywords: string[]
  selectedForFinalization: boolean
  createdAt: string
}

interface CreatedArticle {
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

const SENTIMENT_LABELS = {
  '-1': { label: 'Negative', color: 'red' as const, description: 'Organization mentioned negatively' },
  '0': { label: 'Not Mentioned', color: 'gray' as const, description: 'Organization not mentioned' },
  '1': { label: 'Brief Mention', color: 'blue' as const, description: 'Mentioned but not main focus' },
  '2': { label: 'Main Focus', color: 'green' as const, description: 'Main focus, informational' },
  '3': { label: 'Social Impact', color: 'purple' as const, description: 'Main focus, inspiring impact' }
}

export default function DiscoveryPipelinePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all')
  const [sessions, setSessions] = useState<DiscoverySession[]>([])
  const [activeSession, setActiveSession] = useState<DiscoverySession | null>(null)
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3>(1)
  
  // Phase 1 state
  const [discoveredUrls, setDiscoveredUrls] = useState<DiscoveredUrl[]>([])
  const [selectedUrlIds, setSelectedUrlIds] = useState<Set<string>>(new Set())
  const [phase1Loading, setPhase1Loading] = useState(false)
  
  // Manual URL input state
  const [manualUrls, setManualUrls] = useState('')
  const [useManualUrls, setUseManualUrls] = useState(false)
  const [manualUrlsLoading, setManualUrlsLoading] = useState(false)
  
  // Phase 2 state
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent[]>([])
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set())
  const [phase2Loading, setPhase2Loading] = useState(false)
  const [scrapeProgress, setScrapeProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 })
  
  // Phase 3 state
  const [phase3Loading, setPhase3Loading] = useState(false)
  const [phase3Results, setPhase3Results] = useState<{
    successCount: number
    failedCount: number
    createdArticles: string[]
    errors?: string[]
  } | null>(null)
  const [createdArticles, setCreatedArticles] = useState<CreatedArticle[]>([])
  const [loadingCreatedArticles, setLoadingCreatedArticles] = useState(false)
  const [selectedCreatedArticles, setSelectedCreatedArticles] = useState<Set<string>>(new Set())
  const [updatingArticles, setUpdatingArticles] = useState(false)

  // Helper functions for article management
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

  const getRootDomain = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, '')
    } catch {
      return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
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

  // Fetch created articles from the API
  const fetchCreatedArticles = async (articleIds?: string[]) => {
    const idsToFetch = articleIds || (phase3Results as any)?.articleIds
    if (!idsToFetch || idsToFetch.length === 0) return

    setLoadingCreatedArticles(true)
    try {
      const response = await fetch('/api/admin/articles?' + new URLSearchParams({
        ids: idsToFetch.join(','),
        limit: '50'
      }))

      const data = await response.json()
      if (data.success) {
        setCreatedArticles(data.articles)
      }
    } catch (error) {
      console.error('Failed to fetch created articles:', error)
    } finally {
      setLoadingCreatedArticles(false)
    }
  }

  // Update article status
  const updateArticleStatus = async (articleId: string, status: string) => {
    setUpdatingArticles(true)
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: articleId, status })
      })

      const result = await response.json()
      if (result.success) {
        setCreatedArticles(prev => prev.map(article => 
          article.id === articleId ? { ...article, status } : article
        ))
      }
      return result.success
    } catch (error) {
      console.error('Failed to update article status:', error)
      return false
    } finally {
      setUpdatingArticles(false)
    }
  }

  const handlePublishArticle = async (article: CreatedArticle) => {
    await updateArticleStatus(article.id, 'published')
  }

  const handleRejectArticle = async (article: CreatedArticle) => {
    await updateArticleStatus(article.id, 'rejected')
  }

  const handleSelectCreatedArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedCreatedArticles)
    if (checked) {
      newSelected.add(articleId)
    } else {
      newSelected.delete(articleId)
    }
    setSelectedCreatedArticles(newSelected)
  }

  const handleBulkPublish = async () => {
    if (selectedCreatedArticles.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to publish ${selectedCreatedArticles.size} selected articles?`)
    if (!confirmed) return

    setUpdatingArticles(true)
    for (const articleId of selectedCreatedArticles) {
      await updateArticleStatus(articleId, 'published')
    }
    setSelectedCreatedArticles(new Set())
  }
  
  // Proceed to Phase 3: Finalization
  const proceedToPhase3 = async () => {
    if (!activeSession || selectedContentIds.size === 0) return
    
    try {
      setPhase3Loading(true)
      setCurrentPhase(3)
      
      console.log(`🎯 Starting Phase 3: Finalizing ${selectedContentIds.size} articles...`)
      
      // Call the Phase 3 API to create actual Article records
      const response = await fetch('/api/discovery/phase3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          selectedContentIds: Array.from(selectedContentIds)
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Phase 3 successful: ${result.successCount} articles created`)
        console.log(`📝 Created articles:`, result.createdArticles)
        
        // Store results for UI display
        setPhase3Results({
          successCount: result.successCount,
          failedCount: result.failedCount || 0,
          createdArticles: result.createdArticles || [],
          errors: result.errors
        })
        
        if (result.errors && result.errors.length > 0) {
          console.warn(`⚠️ Some articles failed:`, result.errors)
        }

        // Fetch the created articles for immediate display and management
        if (result.articleIds && result.articleIds.length > 0) {
          await fetchCreatedArticles(result.articleIds)
        }
      } else {
        console.error(`❌ Phase 3 failed: ${result.error}`)
        alert(`Finalization failed: ${result.error}`)
        setPhase3Results(null)
      }
      
    } catch (error) {
      console.error('Failed to proceed to Phase 3:', error)
      alert(`Phase 3 error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setPhase3Loading(false)
    }
  }
  
  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations?requireNewsUrl=true&includeArticleCounts=true')
      const data = await response.json()
      if (data.success) {
        // Organizations are already filtered by newsUrl at the API level
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }, [])
  
  // Fetch sessions for selected organization
  const fetchSessions = useCallback(async (orgId: string) => {
    if (orgId === 'all') {
      setSessions([])
      return
    }
    
    try {
      const response = await fetch(`/api/discovery/phase1?organizationId=${orgId}`)
      const data = await response.json()
      if (data.success) {
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }, [])
  
  // Start Phase 1: URL Discovery
  const startPhase1 = async () => {
    if (selectedOrgId === 'all') return
    
    const org = organizations.find(o => o.id === selectedOrgId)
    if (!org || !org.newsUrl) return
    
    setPhase1Loading(true)
    try {
      const response = await fetch('/api/discovery/phase1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          newsUrl: org.newsUrl
        })
      })
      
      const data = await response.json()
      if (data.success) {
        console.log(`✅ Phase 1 complete: ${data.totalUrls} URLs discovered`)
        // Fetch the created session
        await fetchSessions(selectedOrgId)
        // Load the discovered URLs for the new session
        loadDiscoveredUrls(data.sessionId)
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Phase 1 failed:', error)
      alert(`Phase 1 failed: ${error}`)
    } finally {
      setPhase1Loading(false)
    }
  }

  // Process manual URLs (skip Phase 1)
  const processManualUrls = async () => {
    if (selectedOrgId === 'all' || !manualUrls.trim()) return
    
    const org = organizations.find(o => o.id === selectedOrgId)
    if (!org) return

    setManualUrlsLoading(true)
    try {
      // Parse URLs from textarea
      const urlList = manualUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && url.startsWith('http'))

      if (urlList.length === 0) {
        throw new Error('No valid URLs found. Please enter URLs starting with http:// or https://')
      }

      console.log(`📝 Processing ${urlList.length} manual URLs...`)

      // Create discovery session with manual URLs
      const response = await fetch('/api/discovery/phase1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          newsUrl: org.newsUrl || 'manual-input', // Fallback for orgs without newsUrl
          manualUrls: urlList // Pass the manual URLs
        })
      })

      const data = await response.json()
      if (data.success) {
        console.log(`✅ Manual URLs processed: ${urlList.length} URLs added`)
        // Fetch the created session
        await fetchSessions(selectedOrgId)
        // Load the URLs and jump to Phase 2
        await loadDiscoveredUrls(data.sessionId)
        
        // Auto-select all URLs and proceed to Phase 2
        setTimeout(() => {
          // Set the active session
          const createdSession = sessions.find(s => s.id === data.sessionId)
          if (createdSession) {
            setActiveSession(createdSession)
            // URLs are already pre-selected in the API, so start Phase 2 directly
            startPhase2()
          }
        }, 1000) // Give a bit more time for state to update
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Manual URL processing failed:', error)
      alert(`Failed to process manual URLs: ${error}`)
    } finally {
      setManualUrlsLoading(false)
    }
  }
  
  // Load discovered URLs for a session
  const loadDiscoveredUrls = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/discovery/phase1?sessionId=${sessionId}`)
      const data = await response.json()
      if (data.success) {
        setActiveSession(data.session)
        setDiscoveredUrls(data.session.discoveredUrls)
        setCurrentPhase(1)
        
        // Pre-populate the selected URLs from the previous session
        const previouslySelectedUrls = data.session.discoveredUrls
          .filter((url: any) => url.selected)
          .map((url: any) => url.id)
        setSelectedUrlIds(new Set(previouslySelectedUrls))
        
        // Load existing scraped content if it exists (Phase 2 results)
        if (data.session.scrapedContent && data.session.scrapedContent.length > 0) {
          console.log(`📋 Loading ${data.session.scrapedContent.length} existing scraped content records`)
          setScrapedContent(data.session.scrapedContent)
          
          // Pre-populate previously selected content for finalization
          const previouslySelectedContent = data.session.scrapedContent
            .filter((content: any) => content.selectedForFinalization)
            .map((content: any) => content.id)
          setSelectedContentIds(new Set(previouslySelectedContent))
          
          // Jump to Phase 2 since we have scraped content
          setCurrentPhase(2)
          console.log(`✅ Jumping to Phase 2 - found existing scraped content`)
        } else {
          // No scraped content, clear Phase 2/3 state and stay at Phase 1
          setScrapedContent([])
          setSelectedContentIds(new Set())
          console.log(`📝 No scraped content found - staying at Phase 1 for fresh scraping`)
        }
        
        // Clear loading states
        setPhase2Loading(false)
        setPhase3Loading(false)
        setPhase3Results(null)
      }
    } catch (error) {
      console.error('Failed to load discovered URLs:', error)
    }
  }
  
  // Handle URL selection for Phase 1
  const handleUrlSelection = (urlId: string, checked: boolean) => {
    const newSelection = new Set(selectedUrlIds)
    if (checked) {
      newSelection.add(urlId)
    } else {
      newSelection.delete(urlId)
    }
    setSelectedUrlIds(newSelection)
  }
  
  // Proceed to Phase 2 and start scraping immediately (one-click)
  const proceedToPhase2 = async () => {
    if (!activeSession || selectedUrlIds.size === 0) return
    
    try {
      // Update URL selections first
      const updateResponse = await fetch('/api/discovery/phase2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          selectedUrls: Array.from(selectedUrlIds)
        })
      })
      
      if (updateResponse.ok) {
        setCurrentPhase(2)
        // Immediately start Phase 2 scraping
        await startPhase2()
      }
    } catch (error) {
      console.error('Failed to proceed to Phase 2:', error)
    }
  }
  
  // Start Phase 2: Batch Extraction
  const startPhase2 = async () => {
    if (!activeSession) return
    
    setPhase2Loading(true)
    setScrapeProgress({ current: 0, total: selectedUrlIds.size })
    
    try {
      const response = await fetch('/api/discovery/phase2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id })
      })
      
      const data = await response.json()
      if (data.success) {
        console.log(`✅ Phase 2 complete: ${data.scrapedCount} articles extracted via batch processing`)
        // Load scraped content
        loadScrapedContent(activeSession.id)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Phase 2 failed:', error)
      alert(`Phase 2 failed: ${error}`)
    } finally {
      setPhase2Loading(false)
    }
  }
  
  // Load scraped content
  const loadScrapedContent = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/discovery/phase2?sessionId=${sessionId}`)
      const data = await response.json()
      if (data.success) {
        setScrapedContent(data.scrapedContent)
        setCurrentPhase(2)
      }
    } catch (error) {
      console.error('Failed to load scraped content:', error)
    }
  }
  
  // Get sentiment badge
  const getSentimentBadge = (score?: number) => {
    if (score === undefined || score === null) return <Badge color="gray">Unknown</Badge>
    
    const sentiment = SENTIMENT_LABELS[score.toString() as keyof typeof SENTIMENT_LABELS]
    if (!sentiment) return <Badge color="gray">Unknown</Badge>
    
    return (
      <Badge color={sentiment.color} title={sentiment.description}>
        {sentiment.label}
      </Badge>
    )
  }
  
  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])
  
  useEffect(() => {
    fetchSessions(selectedOrgId)
  }, [selectedOrgId, fetchSessions])
  
  return (
    <Box style={{ marginLeft: '310px', marginRight: '34px', paddingTop: '24px' }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Heading size="6" weight="light">Discovery Pipeline</Heading>
          <Text size="2" color="gray">
            Human-in-the-loop content discovery and processing pipeline
          </Text>
        </Flex>
        
        {/* Organization Selection */}
        <Card>
          <Flex direction="column" gap="4">
            <Heading size="4">Select Organization</Heading>
            <Flex align="center" gap="4">
              <Select.Root value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <Select.Trigger style={{ width: '400px' }} />
                <Select.Content>
                  <Select.Item value="all">Select an organization</Select.Item>
                  {organizations.map((org) => (
                    <Select.Item key={org.id} value={org.id}>
                      <Flex justify="between" align="center" width="100%">
                        <Text>{org.name}</Text>
                        <Badge variant="soft" color="blue" size="1">
                          {org.publishedArticleCount || 0} published
                        </Badge>
                      </Flex>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              
              {selectedOrgId !== 'all' && (
                <Flex align="center" gap="2">
                  <Button 
                    onClick={startPhase1} 
                    loading={phase1Loading}
                    disabled={phase1Loading || useManualUrls}
                  >
                    <Play size={16} />
                    Start New Discovery
                  </Button>
                  
                  <Text size="2" color="gray">or</Text>
                  
                  <Button 
                    variant={useManualUrls ? 'solid' : 'outline'}
                    onClick={() => setUseManualUrls(!useManualUrls)}
                    disabled={phase1Loading}
                  >
                    <Link size={16} />
                    Manual URLs
                  </Button>
                </Flex>
              )}
            </Flex>

            {/* Manual URL Input Section */}
            {selectedOrgId !== 'all' && useManualUrls && (
              <Flex direction="column" gap="3" style={{ 
                marginTop: '16px', 
                padding: '16px', 
                border: '1px solid var(--gray-6)', 
                borderRadius: '8px',
                backgroundColor: 'var(--gray-2)'
              }}>
                <Flex justify="between" align="center">
                  <Text size="3" weight="bold">Manual URL Input</Text>
                  <IconButton
                    variant="ghost"
                    size="1"
                    onClick={() => {
                      setUseManualUrls(false)
                      setManualUrls('')
                    }}
                  >
                    <X size={14} />
                  </IconButton>
                </Flex>
                
                <Text size="2" color="gray">
                  Enter URLs to scrape (one per line). This will skip automatic discovery and go directly to scraping.
                </Text>
                
                <TextArea
                  placeholder="https://example.com/article-1
https://example.com/article-2
https://example.com/article-3"
                  value={manualUrls}
                  onChange={(e) => setManualUrls(e.target.value)}
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '14px' }}
                />
                
                {manualUrls.trim() && (
                  <Text size="2" color="gray">
                    {manualUrls.split('\n').filter(url => url.trim() && url.startsWith('http')).length} valid URLs found
                  </Text>
                )}
                
                <Button 
                  onClick={processManualUrls}
                  loading={manualUrlsLoading}
                  disabled={manualUrlsLoading || !manualUrls.trim()}
                >
                  <ArrowRight size={16} />
                  Process URLs & Skip to Scraping
                </Button>
              </Flex>
            )}
          </Flex>
        </Card>
        
        {/* Existing Sessions */}
        {sessions.length > 0 && (
          <Card>
            <Flex direction="column" gap="4">
              <Heading size="4">Previous Sessions</Heading>
              <Box style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>URLs</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Progress</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Scraped</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sessions.map((session) => (
                      <Table.Row key={session.id}>
                        <Table.Cell>
                          <Text size="2">{new Date(session.createdAt).toLocaleDateString()}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={
                            session.status === 'completed' ? 'green' :
                            session.status === 'ready_for_review' ? 'blue' :
                            session.status.includes('ing') ? 'orange' : 'gray'
                          }>
                            {session.status.replace('_', ' ')}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{session.totalUrls} total</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{session.selectedUrls} selected, {session.processedUrls} processed</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color={(session.scrapedArticles || 0) > 0 ? 'green' : 'gray'}>
                            {session.scrapedArticles || 0} articles
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Button 
                            size="1" 
                            variant="soft"
                            onClick={() => loadDiscoveredUrls(session.id)}
                            title={(session.scrapedArticles || 0) > 0 
                              ? "Resume at Phase 2/3 - no additional credits needed"
                              : "View and re-scrape URLs from this session"
                            }
                          >
                            <Eye size={14} />
                            {(session.scrapedArticles || 0) > 0 ? 'Resume Pipeline' : 'View & Re-scrape'}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Flex>
          </Card>
        )}
        
        {/* Phase Progress */}
        {activeSession && (
          <Card>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">Pipeline Progress</Heading>
                <Text size="2" color="gray">
                  Session: {activeSession.organizationName} • {new Date(activeSession.createdAt).toLocaleDateString()}
                </Text>
              </Flex>
              
              <Flex align="center" gap="4">
                <Flex align="center" gap="2">
                  <Box style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentPhase >= 1 ? 'var(--accent-9)' : 'var(--gray-6)',
                    color: 'white'
                  }}>
                    {currentPhase > 1 ? <CheckCircle size={16} /> : '1'}
                  </Box>
                  <Text size="2" weight={currentPhase === 1 ? 'bold' : 'regular'}>
                    Discovery
                  </Text>
                </Flex>
                
                <Box style={{ flex: 1, height: '2px', backgroundColor: currentPhase >= 2 ? 'var(--accent-9)' : 'var(--gray-6)' }} />
                
                <Flex align="center" gap="2">
                  <Box style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentPhase >= 2 ? 'var(--accent-9)' : 'var(--gray-6)',
                    color: 'white'
                  }}>
                    {currentPhase > 2 ? <CheckCircle size={16} /> : phase2Loading ? <Clock size={16} /> : '2'}
                  </Box>
                  <Text size="2" weight={currentPhase === 2 ? 'bold' : 'regular'}>
                    Scraping & Analysis
                  </Text>
                </Flex>
                
                <Box style={{ flex: 1, height: '2px', backgroundColor: currentPhase >= 3 ? 'var(--accent-9)' : 'var(--gray-6)' }} />
                
                <Flex align="center" gap="2">
                  <Box style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentPhase >= 3 ? 'var(--accent-9)' : 'var(--gray-6)',
                    color: 'white'
                  }}>
                    {currentPhase > 3 ? <CheckCircle size={16} /> : phase3Loading ? <Clock size={16} /> : '3'}
                  </Box>
                  <Text size="2" weight={currentPhase === 3 ? 'bold' : 'regular'}>
                    Finalization
                  </Text>
                </Flex>
              </Flex>
            </Flex>
          </Card>
        )}
        
        {/* Phase 1: URL Discovery Review */}
        {currentPhase === 1 && discoveredUrls.length > 0 && (
          <Card>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">
                  Phase 1: Review Discovered URLs
                  {activeSession && activeSession.status !== 'discovering' && (
                    <Text size="2" color="blue" style={{ marginLeft: '8px', fontWeight: 'normal' }}>
                      (Re-scraping session from {new Date(activeSession.createdAt).toLocaleDateString()})
                    </Text>
                  )}
                </Heading>
                <Flex align="center" gap="2">
                  <Text size="2" color="gray">
                    {selectedUrlIds.size} of {discoveredUrls.length} selected
                  </Text>
                  <Button 
                    onClick={proceedToPhase2}
                    disabled={selectedUrlIds.size === 0}
                  >
                    Proceed to Scraping
                  </Button>
                </Flex>
              </Flex>
              
              <Box style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>
                        <Checkbox 
                          checked={selectedUrlIds.size === discoveredUrls.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUrlIds(new Set(discoveredUrls.map(u => u.id)))
                            } else {
                              setSelectedUrlIds(new Set())
                            }
                          }}
                        />
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Domain</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {discoveredUrls.map((url) => (
                      <Table.Row key={url.id}>
                        <Table.Cell>
                          <Checkbox 
                            checked={selectedUrlIds.has(url.id)}
                            onCheckedChange={(checked) => handleUrlSelection(url.id, checked === true)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={url.urlType === 'news' ? 'blue' : 'green'}>
                            {url.urlType}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{url.domain}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="1" style={{ wordBreak: 'break-all' }}>
                            {url.url.length > 80 ? `${url.url.substring(0, 80)}...` : url.url}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Flex>
          </Card>
        )}
        
        {/* Phase 2: Scraping Results Review */}
        {currentPhase === 2 && (
          <Card>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Flex direction="column" gap="1">
                  <Heading size="4">Phase 2: Review Scraped Content</Heading>
                  {scrapedContent.length > 0 && !phase2Loading && (
                    <Text size="2" color="green">
                      ✅ Loaded from previous session - no credits used
                    </Text>
                  )}
                </Flex>
                <Flex align="center" gap="2">
                  {phase2Loading && scrapeProgress.total > 0 && (
                    <Progress value={(scrapeProgress.current / scrapeProgress.total) * 100} style={{ width: '200px' }} />
                  )}
                  {!phase2Loading && scrapedContent.length === 0 && (
                    <Text size="2" color="gray">
                      Batch extraction will start automatically...
                    </Text>
                  )}
                </Flex>
              </Flex>
              
              {phase2Loading && (
                <Card style={{ padding: '20px', textAlign: 'center' }}>
                  <Flex direction="column" align="center" gap="2">
                    <Clock size={24} />
                    <Text>Firecrawl Extract batch processing in progress...</Text>
                    <Text size="2" color="gray">
                      Step 1: Submitting {scrapeProgress.total} URLs to Firecrawl Extract
                    </Text>
                    <Text size="2" color="gray">
                      Step 2: Polling for completion (up to 2 minutes)
                    </Text>
                    <Text size="2" color="gray">
                      Step 3: Processing results with sentiment analysis
                    </Text>
                  </Flex>
                </Card>
              )}
              
              {scrapedContent.length > 0 && (
                <>
                  <Box style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>
                            <Checkbox 
                              checked={selectedContentIds.size === scrapedContent.length}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedContentIds(new Set(scrapedContent.map(c => c.id)))
                                } else {
                                  setSelectedContentIds(new Set())
                                }
                              }}
                            />
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Sentiment</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Summary</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {scrapedContent.map((content) => (
                          <Table.Row key={content.id}>
                            <Table.Cell>
                              <Checkbox 
                                checked={selectedContentIds.has(content.id)}
                                onCheckedChange={(checked) => {
                                  const newSelection = new Set(selectedContentIds)
                                  if (checked) {
                                    newSelection.add(content.id)
                                  } else {
                                    newSelection.delete(content.id)
                                  }
                                  setSelectedContentIds(newSelection)
                                }}
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Text size="2" weight="medium">
                                {content.title || 'No title'}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color={content.urlType === 'news' ? 'blue' : 'green'}>
                                {content.urlType}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              {getSentimentBadge(content.sentimentScore)}
                            </Table.Cell>
                            <Table.Cell>
                              <Text size="1" style={{ maxWidth: '300px' }}>
                                {content.summary?.substring(0, 100) || content.sentimentReasoning?.substring(0, 100) || 'No summary'}
                                {(content.summary && content.summary.length > 100) && '...'}
                              </Text>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>

                  {/* Proceed to Finalization Button */}
                  <Flex justify="between" align="center" style={{ paddingTop: '16px' }}>
                    <Text size="2" color="gray">
                      {selectedContentIds.size} of {scrapedContent.length} selected for finalization
                    </Text>
                    <Button 
                      onClick={proceedToPhase3}
                      disabled={selectedContentIds.size === 0}
                    >
                      <ArrowRight size={16} />
                      Proceed to Finalization
                    </Button>
                  </Flex>
                </>
              )}
            </Flex>
          </Card>
        )}
        
        {/* Phase 3: Finalization */}
        {currentPhase === 3 && (
          <Card>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">Phase 3: Article Finalization</Heading>
                {phase3Loading && (
                  <Flex align="center" gap="2">
                    <Clock size={16} />
                    <Text size="2">Finalizing articles...</Text>
                  </Flex>
                )}
              </Flex>
              
              {phase3Loading ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                  <Flex direction="column" align="center" gap="3">
                    <Clock size={32} />
                    <Heading size="3">Creating Final Articles</Heading>
                    <Text color="gray">
                      Processing {selectedContentIds.size} selected articles...
                    </Text>
                    <Text size="2" color="gray">
                      This will create draft articles ready for review and publishing.
                    </Text>
                  </Flex>
                </Card>
              ) : (
                <Flex direction="column" gap="4">
                  {/* Success Summary */}
                  <Card style={{ padding: '24px', textAlign: 'center' }}>
                    <Flex direction="column" align="center" gap="3">
                      <CheckCircle size={32} color="green" />
                      <Heading size="3">Articles Successfully Created!</Heading>
                      
                      {phase3Results && (
                        <Flex direction="column" align="center" gap="2">
                          <Text color="green" size="4" weight="bold">
                            ✅ {phase3Results.successCount} articles created successfully
                          </Text>
                          
                          {phase3Results.failedCount > 0 && (
                            <Text color="red">
                              ❌ {phase3Results.failedCount} articles failed to create
                            </Text>
                          )}
                        </Flex>
                      )}
                      
                      <Text size="2" color="gray" style={{ marginTop: '8px' }}>
                        All created articles are in <strong>draft</strong> status. Review and publish them below.
                      </Text>
                    </Flex>
                  </Card>

                  {/* Bulk Actions for Created Articles */}
                  {selectedCreatedArticles.size > 0 && (
                    <Card>
                      <Flex align="center" justify="between" style={{ padding: '16px' }}>
                        <Flex align="center" gap="3">
                          <Text weight="medium" color="blue">
                            {selectedCreatedArticles.size} article{selectedCreatedArticles.size !== 1 ? 's' : ''} selected
                          </Text>
                        </Flex>
                        <Flex gap="2">
                          <Button 
                            size="2" 
                            color="green" 
                            onClick={handleBulkPublish}
                            disabled={updatingArticles}
                          >
                            <CheckCircle size={16} />
                            Publish Selected
                          </Button>
                        </Flex>
                      </Flex>
                    </Card>
                  )}

                  {/* Created Articles Table */}
                  {loadingCreatedArticles ? (
                    <Card style={{ padding: '40px', textAlign: 'center' }}>
                      <Text color="gray">Loading articles...</Text>
                    </Card>
                  ) : createdArticles.length > 0 ? (
                    <Card>
                      <Table.Root>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell>
                              <Checkbox
                                checked={selectedCreatedArticles.size === createdArticles.length && createdArticles.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCreatedArticles(new Set(createdArticles.map(a => a.id)))
                                  } else {
                                    setSelectedCreatedArticles(new Set())
                                  }
                                }}
                                disabled={updatingArticles}
                              />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Article Title</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Images</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Sentiment</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {createdArticles.map((article) => (
                            <Table.Row key={article.id}>
                              <Table.Cell>
                                <Checkbox
                                  checked={selectedCreatedArticles.has(article.id)}
                                  onCheckedChange={(checked) => handleSelectCreatedArticle(article.id, checked === true)}
                                  disabled={updatingArticles}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                {getStatusBadge(article.status)}
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
                                <Badge variant="soft" color="blue">
                                  {article.images.length}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                {getSentimentPill(article.organizationSentiment || article.sentiment)}
                              </Table.Cell>
                              <Table.Cell>
                                <Flex gap="2">
                                  <IconButton 
                                    size="1" 
                                    variant="soft" 
                                    color="gray"
                                    onClick={() => window.open(article.url, '_blank')}
                                    disabled={updatingArticles}
                                  >
                                    <Eye size={14} />
                                  </IconButton>
                                  {article.status === 'draft' && (
                                    <>
                                      <IconButton 
                                        size="1" 
                                        variant="soft" 
                                        color="green"
                                        onClick={() => handlePublishArticle(article)}
                                        disabled={updatingArticles}
                                        title="Publish Article"
                                      >
                                        <CheckCircle size={14} />
                                      </IconButton>
                                      <IconButton 
                                        size="1" 
                                        variant="soft" 
                                        color="orange"
                                        onClick={() => handleRejectArticle(article)}
                                        disabled={updatingArticles}
                                        title="Reject Article"
                                      >
                                        <X size={14} />
                                      </IconButton>
                                    </>
                                  )}
                                </Flex>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Card>
                  ) : phase3Results && (
                    <Card style={{ padding: '40px', textAlign: 'center' }}>
                      <Text color="gray">No articles to display</Text>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  <Card style={{ padding: '20px', textAlign: 'center' }}>
                    <Flex gap="3" justify="center">
                      <Button variant="outline" onClick={() => window.open('/admin/articles', '_blank')}>
                        <Eye size={16} />
                        View All Articles
                      </Button>
                      <Button onClick={() => {
                        setCurrentPhase(1)
                        setActiveSession(null)
                        setDiscoveredUrls([])
                        setScrapedContent([])
                        setSelectedUrlIds(new Set())
                        setSelectedContentIds(new Set())
                        setPhase3Results(null)
                        setCreatedArticles([])
                        setSelectedCreatedArticles(new Set())
                      }}>
                        Start New Session
                      </Button>
                    </Flex>
                  </Card>
                </Flex>
              )}
            </Flex>
          </Card>
        )}
      </Flex>
    </Box>
  )
}
