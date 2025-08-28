'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Card, Button, Badge, Table, Link as RadixLink, Select, TextField, Spinner } from "@radix-ui/themes"
import Link from 'next/link'
import { format } from 'date-fns'

interface AiRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  inputUrl: string
  success: boolean
  errorMessage?: string
  organization: {
    id: string
    name: string
    logo?: string
  }
  article?: {
    id: string
    title: string
    url: string
  }
}

interface Organization {
  id: string
  name: string
  logo?: string
}

function StatusBadge({ status }: { status: string }) {
  const colorMap = {
    'running': 'blue',
    'completed': 'green', 
    'failed': 'red'
  } as const

  return <Badge color={colorMap[status as keyof typeof colorMap] || 'gray'}>{status}</Badge>
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export default function AiRunsPage() {
  const [runs, setRuns] = useState<AiRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  
  // Wizard state
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [inputUrl, setInputUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')

  useEffect(() => {
    fetchRuns()
    fetchOrganizations()
  }, [statusFilter])

  const fetchRuns = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await fetch(`/api/ai-runs?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setRuns(data.runs)
      }
    } catch (error) {
      console.error('Failed to fetch AI runs:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleSubmitScraping = async () => {
    if (!selectedOrgId || !inputUrl) {
      setSubmitError('Please select an organization and enter a URL')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setSubmitMessage('')

    try {
      const response = await fetch('/api/scrape-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: inputUrl,
          organizationId: selectedOrgId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitMessage(
          data.result.duplicate 
            ? `Article already exists: "${data.result.title}"`
            : `Successfully created article: "${data.result.title}"`
        )
        setInputUrl('')
        setSelectedOrgId('')
        
        // Refresh the runs list
        setTimeout(() => {
          fetchRuns()
        }, 1000)
      } else {
        setSubmitError(data.error || 'Failed to scrape article')
      }
    } catch (error) {
      setSubmitError('Network error occurred')
      console.error('Scraping submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box style={{ 
      marginLeft: '310px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
        <Text>Loading AI runs...</Text>
      </Box>
    )
  }

  return (
    <Box style={{ 
      marginLeft: '338px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Heading size="6" weight="light">Scrape Log</Heading>
        </Flex>

        {/* Article Scraping Wizard */}
        <Card>
          <Flex direction="column" gap="4">
            <Heading size="5">Scrape New Webpage</Heading>
            <Text size="3" color="gray">
              Select an organization and paste a URL to scrape and create a new article
            </Text>
            
            <Flex gap="3" align="end" wrap="wrap">
              <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                <Text size="2" weight="medium">Organization</Text>
                <Select.Root value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <Select.Trigger placeholder="Select organization..." />
                  <Select.Content>
                    {organizations.map((org) => (
                      <Select.Item key={org.id} value={org.id}>
                        <Flex align="center" gap="2">
                          {org.logo && (
                            <img 
                              src={org.logo} 
                              alt={org.name}
                              style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                            />
                          )}
                          {org.name}
                        </Flex>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>

              <Flex direction="column" gap="2" style={{ flex: 1, minWidth: '300px' }}>
                <Text size="2" weight="medium">Article URL</Text>
                <TextField.Root 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/article..."
                  size="3"
                />
              </Flex>

              <Button 
                onClick={handleSubmitScraping}
                disabled={isSubmitting || !selectedOrgId || !inputUrl}
                size="3"
              >
                {isSubmitting ? (
                  <Flex align="center" gap="2">
                    <Spinner size="1" />
                    Scraping...
                  </Flex>
                ) : (
                  'Scrape Article'
                )}
              </Button>
            </Flex>

            {/* Feedback Messages */}
            {submitMessage && (
              <Text size="2" style={{ color: 'green' }}>
                ✅ {submitMessage}
              </Text>
            )}
            
            {submitError && (
              <Text size="2" style={{ color: 'red' }}>
                ❌ {submitError}
              </Text>
            )}
          </Flex>
        </Card>

        {/* Filters */}
        <Card>
          <Flex gap="3" align="center">
            <Text weight="medium">Filter by status:</Text>
            <Button 
              variant={statusFilter === '' ? 'solid' : 'soft'} 
              onClick={() => setStatusFilter('')}
              size="2"
            >
              All
            </Button>
            <Button 
              variant={statusFilter === 'running' ? 'solid' : 'soft'} 
              onClick={() => setStatusFilter('running')}
              size="2"
            >
              Running
            </Button>
            <Button 
              variant={statusFilter === 'completed' ? 'solid' : 'soft'} 
              onClick={() => setStatusFilter('completed')}
              size="2"
            >
              Completed
            </Button>
            <Button 
              variant={statusFilter === 'failed' ? 'solid' : 'soft'} 
              onClick={() => setStatusFilter('failed')}
              size="2"
            >
              Failed
            </Button>
          </Flex>
        </Card>

        {/* Runs Table */}
        <Card>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Organization</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Input URL</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Started</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Output</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {runs.map((run) => (
                <Table.Row key={run.id}>
                  <Table.Cell>
                    <StatusBadge status={run.status} />
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      {run.organization.logo && (
                        <img 
                          src={run.organization.logo} 
                          alt={run.organization.name}
                          style={{ width: 20, height: 20, borderRadius: '4px' }}
                        />
                      )}
                      <Text size="2">{run.organization.name}</Text>
                    </Flex>
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Text size="2" style={{ 
                      maxWidth: '200px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      {run.inputUrl}
                    </Text>
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Text size="2">
                      {format(new Date(run.startedAt), 'MMM d, h:mm a')}
                    </Text>
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Text size="2">
                      {run.duration ? formatDuration(run.duration) : (
                        run.status === 'running' ? 'Running...' : '—'
                      )}
                    </Text>
                  </Table.Cell>
                  
                  <Table.Cell>
                    {run.article ? (
                      <Text size="2" style={{ color: 'green' }}>
                        Article created
                      </Text>
                    ) : run.errorMessage ? (
                      <Text size="2" style={{ color: 'red' }}>
                        Failed
                      </Text>
                    ) : (
                      <Text size="2">—</Text>
                    )}
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Link href={`/ai-runs/${run.id}`}>
                      <Button variant="soft" size="1">
                        View Details
                      </Button>
                    </Link>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>

          {runs.length === 0 && (
            <Box p="6" style={{ textAlign: 'center' }}>
              <Text color="gray">No AI runs found</Text>
            </Box>
          )}
        </Card>
      </Flex>
    </Box>
  )
}
