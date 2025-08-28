'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Card, Button, Badge, Table, Link as RadixLink } from "@radix-ui/themes"
import Link from 'next/link'
import { format } from 'date-fns'
import { UploadSimple } from "@phosphor-icons/react/dist/ssr"

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

  useEffect(() => {
    fetchRuns()
  }, [])

  const fetchRuns = async () => {
    try {
      const response = await fetch('/api/ai-runs')
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
      marginLeft: '310px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Heading size="6" weight="light">Scrape Log</Heading>
          <Link href="/bulk-scrape">
            <Button variant="solid" size="3">
              <UploadSimple size={16} />
              Bulk Scraping
            </Button>
          </Link>
        </Flex>

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
