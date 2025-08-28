'use client'

import { useState, useEffect } from 'react'
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
  status: 'pending' | 'processing' | 'success' | 'error'
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
    const initialResults: ScrapeResult[] = urlList.map(url => ({
      url,
      status: 'pending'
    }))
    setResults(initialResults)

    try {
      const response = await fetch('/api/bulk-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          urls: urlList
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Set final results from the API response
        setResults(data.results || [])
        
        // Show summary
        const { summary } = data
        const summaryMessage = `Bulk scraping completed!\n\n` +
          `✅ ${summary.success} URLs started scraping\n` +
          `📄 ${summary.duplicates} duplicates skipped\n` +
          `❌ ${summary.errors} errors\n\n` +
          `Articles will appear in the main feed as scraping completes (may take a few minutes).`
        
        alert(summaryMessage)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Bulk scrape error:', error)
      alert('Failed to start bulk scraping')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusIcon = (status: ScrapeResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-gray-500" />
      case 'processing':
        return <Spinner size="1" />
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />
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
                    Processing...
                  </>
                ) : (
                  'Start Bulk Scraping'
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
          <Card style={{ padding: '24px' }}>
            <Flex direction="column" gap="4">
              <Heading size="4">Scraping Results</Heading>
              
              {/* Summary Stats */}
              <Flex gap="4" wrap="wrap">
                <Badge color="gray">
                  Total: {results.length}
                </Badge>
                <Badge color="green">
                  Success: {results.filter(r => r.status === 'success').length}
                </Badge>
                <Badge color="red">
                  Failed: {results.filter(r => r.status === 'error').length}
                </Badge>
                <Badge color="blue">
                  Processing: {results.filter(r => r.status === 'processing').length}
                </Badge>
                <Badge color="gray">
                  Pending: {results.filter(r => r.status === 'pending').length}
                </Badge>
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
            <Heading size="4" style={{ color: 'var(--blue-11)' }}>How to Use</Heading>
            <Flex direction="column" gap="2">
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                1. <strong>Select Organization:</strong> Choose the organization these articles belong to
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                2. <strong>Add URLs:</strong> Paste URLs one per line (@ prefix is optional and will be removed)
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                3. <strong>Start Scraping:</strong> Click the button to begin processing all URLs
              </Text>
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                4. <strong>Monitor Progress:</strong> Watch the results update in real-time below
              </Text>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </Box>
  )
}
