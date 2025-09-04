'use client'

import { useState, useEffect, useRef } from 'react'
import { Box, Heading, Text, Flex, Button, Select, TextArea, Card, Badge, Spinner } from '@radix-ui/themes'
import * as Accordion from '@radix-ui/react-accordion'
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning"
import { MagnifyingGlass, CaretDown, Link as LinkIcon, Download, Play } from "@phosphor-icons/react/dist/ssr"

interface Organization {
  id: string
  name: string
  newsUrl?: string | null
}

interface ScrapeResult {
  url: string
  status: 'pending' | 'processing' | 'success' | 'error' | 'duplicate'
  message?: string
  articleId?: string
}

interface DiscoveryBatch {
  id: string
  organizationName: string
  status: string
  timeframe: number
  totalUrls: number
  processedUrls: number
  successfulUrls: number
  failedUrls: number
  startedAt: string
  completedAt?: string
  discoveredUrls?: string[]
}

export default function BulkScrapePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [urls, setUrls] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<ScrapeResult[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [concurrency, setConcurrency] = useState(3)
  const [batchDelay, setBatchDelay] = useState(2000)
  
  // Discovery batch state
  const [discoveryBatches, setDiscoveryBatches] = useState<DiscoveryBatch[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryTimeframe, setDiscoveryTimeframe] = useState(90)

  // Load organizations on component mount
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations')
        const data = await response.json()
        
        if (data.success) {
          setOrganizations(data.organizations)
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error)
      } finally {
        setLoadingOrgs(false)
      }
    }
    
    fetchOrganizations()
  }, [])

  // Fetch discovery batches when organization changes
  useEffect(() => {
    if (selectedOrgId) {
      fetchDiscoveryBatches()
    } else {
      setDiscoveryBatches([])
    }
  }, [selectedOrgId])

  const fetchDiscoveryBatches = async () => {
    if (!selectedOrgId) return
    
    try {
      const response = await fetch('/api/bulk-discovery')
      const data = await response.json()
      
      if (data.success) {
        // Filter batches for the selected organization
        const orgBatches = data.recentBatches.filter((batch: DiscoveryBatch) => 
          batch.organizationName === organizations.find(org => org.id === selectedOrgId)?.name
        )
        setDiscoveryBatches(orgBatches)
      }
    } catch (error) {
      console.error('Failed to fetch discovery batches:', error)
    }
  }

  // Auto-scroll to latest results when processing
  useEffect(() => {
    if (isProcessing && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [results, isProcessing])

  const handleDiscovery = async () => {
    if (!selectedOrgId) {
      alert('Please select an organization first')
      return
    }

    const selectedOrg = organizations.find(org => org.id === selectedOrgId)
    if (!selectedOrg) {
      alert('Selected organization not found')
      return
    }

    setIsDiscovering(true)
    
    try {
      const response = await fetch('/api/url-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          organizationName: selectedOrg.name,
          timeframe: discoveryTimeframe
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Refresh discovery batches
        setTimeout(() => {
          fetchDiscoveryBatches()
        }, 1000)
      } else {
        alert(`Discovery failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Discovery failed:', error)
      alert('Discovery failed. Please try again.')
    } finally {
      setIsDiscovering(false)
    }
  }

  const loadUrlsFromBatch = (batch: DiscoveryBatch) => {
    if (batch.discoveredUrls && batch.discoveredUrls.length > 0) {
      setUrls(batch.discoveredUrls.join('\n'))
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'discovering':
        return <Badge color="blue"><Spinner size="1" style={{ marginRight: '4px' }} />Discovering</Badge>
      case 'ready_for_processing':
        return <Badge color="green">Ready</Badge>
      case 'processing':
        return <Badge color="orange"><Spinner size="1" style={{ marginRight: '4px' }} />Processing</Badge>
      case 'completed':
        return <Badge color="green">Completed</Badge>
      case 'failed':
        return <Badge color="red">Failed</Badge>
      default:
        return <Badge color="gray">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleBulkScrape = async () => {
    if (!selectedOrgId || !urls.trim()) {
      alert('Please select an organization and enter at least one URL')
      return
    }

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map(url => url.startsWith('@') ? url.substring(1) : url) // Remove @ prefix if present

    if (urlList.length === 0) {
      alert('Please enter at least one valid URL')
      return
    }

    setIsProcessing(true)
    
    // Initialize all results as pending
    const initialResults: ScrapeResult[] = urlList.map(url => ({
      url,
      status: 'pending'
    }))
    setResults(initialResults)

    try {
      console.log(`🚀 Starting parallel bulk scrape: ${urlList.length} URLs, concurrency: ${concurrency}, delay: ${batchDelay}ms`)
      
      // Use the new parallel bulk scrape API
      const response = await fetch('/api/bulk-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          urls: urlList,
          concurrency,
          batchDelay
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Map API results to our result format
        const mappedResults: ScrapeResult[] = data.results.map((result: any) => ({
          url: result.url,
          status: result.status as ScrapeResult['status'],
          message: result.message,
          articleId: result.articleId
        }))
        
        setResults(mappedResults)
        
        // Log summary
        console.log('🎯 Bulk scraping completed:', data.summary)
        console.log(`✅ Success: ${data.summary.success}/${data.summary.total}`)
        console.log(`⚠️ Duplicates: ${data.summary.duplicate}`)
        console.log(`❌ Errors: ${data.summary.error}`)
      } else {
        // Handle API error
        const errorResults: ScrapeResult[] = urlList.map(url => ({
          url,
          status: 'error',
          message: `API Error: ${data.error || 'Unknown error'}`
        }))
        setResults(errorResults)
        console.error('Bulk scraping API error:', data.error)
      }
    } catch (error) {
      console.error('Bulk scraping failed:', error)
      
      // Handle network error
      const errorResults: ScrapeResult[] = urlList.map(url => ({
        url,
        status: 'error',
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
      setResults(errorResults)
    }

    setIsProcessing(false)
  }

  const getStatusIcon = (status: ScrapeResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-gray-500" />
      case 'processing':
        return <Spinner size="1" />
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />
      case 'duplicate':
        return <Warning size={16} className="text-orange-500" />
      case 'error':
        return <XCircle size={16} className="text-red-500" />
      default:
        return <Warning size={16} className="text-yellow-500" />
    }
  }

  const getStatusColor = (status: ScrapeResult['status']) => {
    switch (status) {
      case 'pending':
        return 'gray'
      case 'processing':
        return 'blue'
      case 'success':
        return 'green'
      case 'duplicate':
        return 'orange'
      case 'error':
        return 'red'
      default:
        return 'yellow'
    }
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
          <Heading size="6" weight="light">Bulk Article Scraping</Heading>
          <Text size="3" color="gray">
            Discover URLs automatically or add them manually to scrape articles for a specific organization
          </Text>
        </Flex>

        {/* Discovery Section */}
        {selectedOrgId && (
          <Card style={{ padding: '24px' }}>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">🔍 URL Discovery</Heading>
                <Flex gap="2" align="center">
                  <Select.Root value={discoveryTimeframe.toString()} onValueChange={(value) => setDiscoveryTimeframe(parseInt(value))}>
                    <Select.Trigger style={{ width: '120px' }} />
                    <Select.Content>
                      <Select.Item value="7">7 days</Select.Item>
                      <Select.Item value="14">14 days</Select.Item>
                      <Select.Item value="30">30 days</Select.Item>
                      <Select.Item value="60">60 days</Select.Item>
                      <Select.Item value="90">90 days</Select.Item>
                      <Select.Item value="180">180 days</Select.Item>
                      <Select.Item value="365">365 days</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <Button 
                    onClick={handleDiscovery}
                    disabled={isDiscovering}
                    size="2"
                  >
                    {isDiscovering ? (
                      <>
                        <Spinner size="1" />
                        Discovering...
                      </>
                    ) : (
                      <>
                        <MagnifyingGlass size={16} />
                        Start Discovery
                      </>
                    )}
                  </Button>
                </Flex>
              </Flex>

              {discoveryBatches.length > 0 ? (
                <Accordion.Root type="multiple" style={{ width: '100%' }}>
                  {discoveryBatches.slice(0, 5).map((batch) => (
                    <Accordion.Item
                      key={batch.id}
                      value={batch.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        backgroundColor: 'white'
                      }}
                    >
                      <Accordion.Header>
                        <Accordion.Trigger
                          style={{
                            width: '100%',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          <Flex align="center" gap="4" style={{ flex: 1 }}>
                            <Flex align="center" gap="2" style={{ minWidth: '100px' }}>
                              {getStatusBadge(batch.status)}
                            </Flex>
                            <Flex align="center" gap="4" style={{ flex: 1 }}>
                              <Text size="2" color="blue">{batch.totalUrls} URLs</Text>
                              <Text size="2" color="gray">{batch.timeframe} days</Text>
                              <Text size="1" color="gray">{formatDate(batch.startedAt)}</Text>
                            </Flex>
                            <Flex gap="2" align="center">
                              {batch.discoveredUrls && batch.discoveredUrls.length > 0 && (
                                <Button
                                  size="1"
                                  variant="soft"
                                  color="blue"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    loadUrlsFromBatch(batch)
                                  }}
                                >
                                  <Download size={12} />
                                  Load URLs
                                </Button>
                              )}
                              <CaretDown size={16} />
                            </Flex>
                          </Flex>
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Content
                        style={{
                          padding: '0 16px 16px 16px',
                          borderTop: '1px solid #f3f4f6'
                        }}
                      >
                        <Box>
                          <Text size="2" weight="medium" style={{ marginBottom: '12px', display: 'block' }}>
                            Discovered URLs ({batch.totalUrls}):
                          </Text>
                          {batch.discoveredUrls && batch.discoveredUrls.length > 0 ? (
                            <Flex direction="column" gap="2">
                              {batch.discoveredUrls.map((url, index) => (
                                <Flex key={index} align="center" gap="2" style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                  <LinkIcon size={14} color="#6b7280" />
                                  <Text size="1" style={{ fontFamily: 'monospace', flex: 1 }}>
                                    {index + 1}. {url}
                                  </Text>
                                  <Button
                                    size="1"
                                    variant="ghost"
                                    onClick={() => window.open(url, '_blank')}
                                  >
                                    Open
                                  </Button>
                                </Flex>
                              ))}
                            </Flex>
                          ) : (
                            <Text size="2" color="gray">No URLs discovered yet</Text>
                          )}
                        </Box>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              ) : (
                <Text size="2" color="gray">
                  No recent discoveries. Click "Start Discovery" to find articles automatically.
                </Text>
              )}
            </Flex>
          </Card>
        )}

        {/* Main Form */}
        <Card style={{ padding: '24px' }}>
          <Flex direction="column" gap="4">
            {/* Organization Selection */}
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold">Select Organization</Text>
              {loadingOrgs ? (
                <Flex align="center" gap="2">
                  <Spinner size="1" />
                  <Text size="2" color="gray">Loading organizations...</Text>
                </Flex>
              ) : (
                <Select.Root value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <Select.Trigger placeholder="Choose an organization..." style={{ width: '100%', maxWidth: '400px' }} />
                  <Select.Content>
                    <Select.Group>
                      {organizations.map((org) => (
                        <Select.Item key={org.id} value={org.id}>
                          {org.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              )}
            </Flex>

            {/* URL Input */}
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold">URLs to Scrape</Text>
              <Text size="2" color="gray">
                Enter one URL per line. You can optionally prefix URLs with @ (it will be removed automatically)
              </Text>
              <TextArea
                placeholder="https://example.com/article-1
@https://example.com/article-2
https://example.com/article-3"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
              {urls.trim() && (
                <Text size="2" color="gray">
                  {urls.split('\n').filter(url => url.trim().length > 0).length} URL(s) entered
                </Text>
              )}
            </Flex>

            {/* Parallel Processing Controls */}
            <Flex direction="column" gap="3">
              <Text size="3" weight="bold">⚡ Parallel Processing Settings</Text>
              
              <Flex gap="4" wrap="wrap">
                <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                  <Text size="2" weight="medium">Concurrent Requests</Text>
                  <Select.Root value={concurrency.toString()} onValueChange={(value) => setConcurrency(parseInt(value))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="1">1 (Sequential)</Select.Item>
                      <Select.Item value="2">2</Select.Item>
                      <Select.Item value="3">3 (Recommended)</Select.Item>
                      <Select.Item value="4">4</Select.Item>
                      <Select.Item value="5">5 (Aggressive)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <Text size="1" color="gray">Higher = faster, but may hit rate limits</Text>
                </Flex>

                <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                  <Text size="2" weight="medium">Batch Delay (ms)</Text>
                  <Select.Root value={batchDelay.toString()} onValueChange={(value) => setBatchDelay(parseInt(value))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="500">500ms (Fast)</Select.Item>
                      <Select.Item value="1000">1s</Select.Item>
                      <Select.Item value="2000">2s (Recommended)</Select.Item>
                      <Select.Item value="3000">3s</Select.Item>
                      <Select.Item value="5000">5s (Conservative)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <Text size="1" color="gray">Delay between parallel batches</Text>
                </Flex>
              </Flex>

              <Box style={{ 
                padding: '12px', 
                backgroundColor: 'var(--blue-2)', 
                borderRadius: 'var(--radius-2)',
                border: '1px solid var(--blue-6)'
              }}>
                <Text size="2" color="blue">
                  <strong>Performance:</strong> With {concurrency} concurrent requests and {batchDelay}ms delay, 
                  processing {urls.split('\n').filter(url => url.trim().length > 0).length || 0} URLs will take approximately{' '}
                  {Math.ceil((urls.split('\n').filter(url => url.trim().length > 0).length || 0) / concurrency) * (batchDelay / 1000 + 15)} seconds
                </Text>
              </Box>
            </Flex>

            {/* Action Buttons */}
            <Flex justify="start" gap="3">
              <Button 
                size="3" 
                onClick={handleBulkScrape}
                disabled={isProcessing || !selectedOrgId || !urls.trim()}
              >
                              {isProcessing ? (
                <>
                  <Spinner size="1" />
                  Processing ({results.filter(r => r.status === 'success' || r.status === 'error' || r.status === 'duplicate').length}/{results.length})
                </>
              ) : (
                'Start Real-Time Scraping'
              )}
              </Button>
              
              {(urls.trim() || results.length > 0) && (
                <Button 
                  size="3" 
                  variant="soft" 
                  color="gray"
                  onClick={() => {
                    setUrls('')
                    setResults([])
                    setSelectedOrgId('')
                  }}
                  disabled={isProcessing}
                >
                  Clear All
                </Button>
              )}
            </Flex>
          </Flex>
        </Card>

        {/* Results Section */}
        {results.length > 0 && (
          <Card ref={resultsRef} style={{ padding: '24px' }}>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">Real-Time Scraping Progress</Heading>
                {isProcessing && (
                  <Text size="2" color="blue">
                    {Math.round((results.filter(r => r.status !== 'pending' && r.status !== 'processing').length / results.length) * 100)}% Complete
                  </Text>
                )}
              </Flex>
              
              {/* Summary Stats */}
              <Flex gap="4" wrap="wrap">
                <Badge color="gray">
                  Total: {results.length}
                </Badge>
                <Badge color="green">
                  Success: {results.filter(r => r.status === 'success').length}
                </Badge>
                <Badge color="orange">
                  Duplicates: {results.filter(r => r.status === 'duplicate').length}
                </Badge>
                <Badge color="red">
                  Failed: {results.filter(r => r.status === 'error').length}
                </Badge>
                {isProcessing && (
                  <>
                    <Badge color="blue">
                      Processing: {results.filter(r => r.status === 'processing').length}
                    </Badge>
                    <Badge color="gray">
                      Pending: {results.filter(r => r.status === 'pending').length}
                    </Badge>
                  </>
                )}
              </Flex>

              {/* Individual Results */}
              <Flex direction="column" gap="2">
                {results.map((result, index) => (
                  <Card key={index} style={{ padding: '12px' }}>
                    <Flex align="center" gap="3">
                      {getStatusIcon(result.status)}
                      <Badge color={getStatusColor(result.status)} variant="soft">
                        {result.status}
                      </Badge>
                      <Text size="2" style={{ flex: 1, fontFamily: 'monospace' }}>
                        {result.url}
                      </Text>
                      {result.message && (
                        <Text size="2" color="gray">
                          {result.message}
                        </Text>
                      )}
                    </Flex>
                  </Card>
                ))}
              </Flex>
            </Flex>
          </Card>
        )}

        {/* Instructions */}
        <Card style={{ padding: '20px', backgroundColor: 'var(--blue-2)', border: '1px solid var(--blue-6)' }}>
          <Flex direction="column" gap="3">
            <Heading size="4" style={{ color: 'var(--blue-11)' }}>✨ Real-Time Bulk Scraping</Heading>
            <Flex direction="column" gap="2">
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                1. <strong>Select Organization:</strong> Choose the organization these articles belong to
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                2. <strong>Add URLs:</strong> Paste URLs one per line (@ prefix is optional and will be removed)
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                3. <strong>Start Real-Time Scraping:</strong> URLs are processed one by one with live updates
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                4. <strong>Watch Progress:</strong> See results appear instantly as each article is scraped
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                💡 <strong>Tip:</strong> Articles appear on the homepage immediately after successful scraping
              </Text>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </Box>
  )
}
