'use client'

import { useState, useEffect, useRef } from 'react'
import { Box, Heading, Text, Flex, Button, Select, TextArea, Card, Badge, Spinner } from '@radix-ui/themes'
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning"

interface Organization {
  id: string
  name: string
  logo?: string | null
}

interface ScrapeResult {
  url: string
  status: 'pending' | 'processing' | 'success' | 'error' | 'duplicate'
  message?: string
  articleId?: string
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

  // Auto-scroll to latest results when processing
  useEffect(() => {
    if (isProcessing && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [results, isProcessing])

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
            Add multiple URLs to scrape articles for a specific organization
          </Text>
        </Flex>

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
