'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heading, Text, Flex, Box, Card, Button, Select, Table, Checkbox, Badge, Progress, Separator } from '@radix-ui/themes'
import { Play, CheckCircle, Clock, AlertCircle, Eye, Sparkle } from '@phosphor-icons/react'

interface Organization {
  id: string
  name: string
  newsUrl?: string | null
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
  
  // Phase 2 state
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent[]>([])
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set())
  const [phase2Loading, setPhase2Loading] = useState(false)
  const [scrapeProgress, setScrapeProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 })
  
  // Phase 3 state
  const [phase3Loading, setPhase3Loading] = useState(false)
  
  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations')
      const data = await response.json()
      if (data.success) {
        setOrganizations(data.organizations.filter((org: Organization) => org.newsUrl))
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
  
  // Load discovered URLs for a session
  const loadDiscoveredUrls = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/discovery/phase1?sessionId=${sessionId}`)
      const data = await response.json()
      if (data.success) {
        setActiveSession(data.session)
        setDiscoveredUrls(data.session.discoveredUrls)
        setCurrentPhase(1)
        
        // If URLs are already selected, move to next phase
        if (data.session.status === 'reviewed' || data.session.status === 'scraping') {
          setCurrentPhase(2)
        }
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
  
  // Proceed to Phase 2
  const proceedToPhase2 = async () => {
    if (!activeSession || selectedUrlIds.size === 0) return
    
    try {
      // Update URL selections
      const response = await fetch('/api/discovery/phase2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          selectedUrls: Array.from(selectedUrlIds)
        })
      })
      
      if (response.ok) {
        setCurrentPhase(2)
      }
    } catch (error) {
      console.error('Failed to proceed to Phase 2:', error)
    }
  }
  
  // Start Phase 2: Scraping
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
        console.log(`✅ Phase 2 complete: ${data.scrapedCount} articles scraped`)
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
                <Select.Trigger style={{ width: '300px' }} />
                <Select.Content>
                  <Select.Item value="all">Select an organization</Select.Item>
                  {organizations.map((org) => (
                    <Select.Item key={org.id} value={org.id}>
                      {org.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              
              {selectedOrgId !== 'all' && (
                <Button 
                  onClick={startPhase1} 
                  loading={phase1Loading}
                  disabled={phase1Loading}
                >
                  <Play size={16} />
                  Start New Discovery
                </Button>
              )}
            </Flex>
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
                          <Button 
                            size="1" 
                            variant="soft"
                            onClick={() => loadDiscoveredUrls(session.id)}
                          >
                            <Eye size={14} />
                            View
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
                  <Text size="2" weight={currentPhase === 1 ? 'bold' : 'normal'}>
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
                  <Text size="2" weight={currentPhase === 2 ? 'bold' : 'normal'}>
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
                  <Text size="2" weight={currentPhase === 3 ? 'bold' : 'normal'}>
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
                <Heading size="4">Phase 1: Review Discovered URLs</Heading>
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
                <Heading size="4">Phase 2: Review Scraped Content</Heading>
                <Flex align="center" gap="2">
                  {phase2Loading && scrapeProgress.total > 0 && (
                    <Progress value={(scrapeProgress.current / scrapeProgress.total) * 100} style={{ width: '200px' }} />
                  )}
                  {!phase2Loading && scrapedContent.length === 0 && selectedUrlIds.size > 0 && (
                    <Button onClick={startPhase2}>
                      <Sparkle size={16} />
                      Start Scraping
                    </Button>
                  )}
                </Flex>
              </Flex>
              
              {phase2Loading && (
                <Card style={{ padding: '20px', textAlign: 'center' }}>
                  <Flex direction="column" align="center" gap="2">
                    <Clock size={24} />
                    <Text>Scraping in progress... This may take several minutes due to rate limiting.</Text>
                    <Text size="2" color="gray">
                      Processed {scrapeProgress.current} of {scrapeProgress.total} URLs
                    </Text>
                  </Flex>
                </Card>
              )}
              
              {scrapedContent.length > 0 && (
                <Box style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Select</Table.ColumnHeaderCell>
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
              )}
            </Flex>
          </Card>
        )}
      </Flex>
    </Box>
  )
}
