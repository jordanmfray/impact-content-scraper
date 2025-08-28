'use client'

import { useState, useEffect } from 'react'
import { Container, Heading, Text, Flex, Card, Badge, Button, Box, Code } from "@radix-ui/themes"
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"

interface AiRunDetail {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  inputUrl: string
  success: boolean
  errorMessage?: string
  stepsData: any
  organization: {
    id: string
    name: string
    logo?: string
  }
  article?: {
    id: string
    title: string
    url: string
    summary?: string
    keywords?: string[]
    sentiment?: string
  }
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

function StepCard({ title, data, status }: { title: string, data: any, status?: string }) {
  return (
    <Card>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Heading size="4">{title}</Heading>
          {status && <StatusBadge status={status} />}
        </Flex>
        
        <Box>
          <Code style={{ 
            display: 'block', 
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflow: 'auto',
            fontSize: '12px',
            backgroundColor: 'var(--gray-2)',
            padding: '12px',
            borderRadius: '4px'
          }}>
            {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
          </Code>
        </Box>
      </Flex>
    </Card>
  )
}

export default function AiRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [paramValues, setParamValues] = useState<{ id: string } | null>(null)
  const [run, setRun] = useState<AiRunDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(setParamValues)
  }, [params])

  useEffect(() => {
    if (paramValues?.id) {
      fetchRunDetail()
    }
  }, [paramValues?.id])

  const fetchRunDetail = async () => {
    if (!paramValues?.id) return
    try {
      const response = await fetch(`/api/ai-runs/${paramValues.id}`)
      const data = await response.json()
      
      if (data.success) {
        setRun(data.run)
      }
    } catch (error) {
      console.error('Failed to fetch AI run details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Container size="4" style={{ padding: 24 }}>
        <Text>Loading AI run details...</Text>
      </Container>
    )
  }

  if (!run) {
    return (
      <Container size="4" style={{ padding: 24 }}>
        <Text>AI run not found</Text>
      </Container>
    )
  }

  const stepsData = run.stepsData || {}

  return (
    <Container size="4" style={{ padding: 24 }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex align="center" gap="4">
          <Link href="/ai-runs">
            <Button variant="soft" size="2">
              <ArrowLeft size={16} />
              Back to Runs
            </Button>
          </Link>
          <Flex direction="column" gap="1">
            <Heading size="6" weight="light">AI Run Details</Heading>
            <Text size="3" color="gray">Run ID: {run.id}</Text>
          </Flex>
        </Flex>

        {/* Status Overview */}
        <Card>
          <Flex direction="column" gap="4">
            <Heading size="5">Overview</Heading>
            
            <Flex gap="6" wrap="wrap">
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">Status</Text>
                <StatusBadge status={run.status} />
              </Flex>
              
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">Organization</Text>
                <Flex align="center" gap="2">
                  {run.organization.logo && (
                    <img 
                      src={run.organization.logo} 
                      alt={run.organization.name}
                      style={{ width: 20, height: 20, borderRadius: '4px' }}
                    />
                  )}
                  <Text size="3">{run.organization.name}</Text>
                </Flex>
              </Flex>
              
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">Started</Text>
                <Text size="3">{format(new Date(run.startedAt), 'MMM d, yyyy h:mm:ss a')}</Text>
              </Flex>
              
              {run.completedAt && (
                <Flex direction="column" gap="1">
                  <Text size="2" color="gray">Completed</Text>
                  <Text size="3">{format(new Date(run.completedAt), 'MMM d, yyyy h:mm:ss a')}</Text>
                </Flex>
              )}
              
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">Duration</Text>
                <Text size="3">
                  {run.duration ? formatDuration(run.duration) : 
                   run.status === 'running' ? 'Running...' : '—'}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Card>

        {/* Input Data */}
        <StepCard 
          title="Input" 
          data={{ 
            url: run.inputUrl,
            organizationId: run.organization.id 
          }} 
        />

        {/* Pipeline Steps */}
        {stepsData.scrapedContent && (
          <StepCard 
            title="Step 1: Web Scraping" 
            data={{
              url: run.inputUrl,
              contentLength: stepsData.scrapedContent?.length || 0,
              content: stepsData.scrapedContent?.slice(0, 500) + (stepsData.scrapedContent?.length > 500 ? '...' : ''),
              discoveryComplete: stepsData.discoveryComplete
            }}
            status={stepsData.discoveryComplete ? 'completed' : 'failed'}
          />
        )}

        {stepsData.enrichmentComplete && (
          <StepCard 
            title="Step 2: Content Enrichment" 
            data={{
              title: stepsData.title,
              summary: stepsData.summary,
              keywords: stepsData.keywords,
              sentiment: stepsData.sentiment,
              author: stepsData.author,
              publishedAt: stepsData.publishedAt,
              ogImage: stepsData.ogImage,
              enrichmentComplete: stepsData.enrichmentComplete
            }}
            status={stepsData.enrichmentComplete ? 'completed' : 'failed'}
          />
        )}

        {/* Output Data */}
        {run.article && (
          <StepCard 
            title="Output: Generated Article" 
            data={{
              articleId: run.article.id,
              title: run.article.title,
              url: run.article.url,
              summary: run.article.summary,
              keywords: run.article.keywords,
              sentiment: run.article.sentiment
            }}
            status="completed"
          />
        )}

        {/* Error Information */}
        {run.errorMessage && (
          <Card style={{ borderColor: 'red' }}>
            <Flex direction="column" gap="3">
              <Heading size="4" style={{ color: 'red' }}>Error</Heading>
              <Text style={{ color: 'red' }}>{run.errorMessage}</Text>
            </Flex>
          </Card>
        )}

        {/* Raw Steps Data */}
        <StepCard 
          title="Raw Pipeline State (Debug)" 
          data={stepsData} 
        />
      </Flex>
    </Container>
  )
}
