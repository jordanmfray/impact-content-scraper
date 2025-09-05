'use client'

import { Heading, Text, Flex, Box, Button, Card, Table, Badge, Spinner } from "@radix-ui/themes"
import { useState } from "react"
import { CheckCircle, XCircle, Clock, Rocket } from "@phosphor-icons/react"

interface PipelineResult {
  organizationId: string
  organizationName: string
  success: boolean
  phase1: { success: boolean, urlsDiscovered: number, error?: string }
  phase2: { success: boolean, articlesScraped: number, error?: string }
  phase3: { success: boolean, articlesCreated: number, error?: string }
  error?: string
  duration: number
}

interface PipelineResponse {
  success: boolean
  results: PipelineResult[]
  summary: {
    processed: number
    successful: number
    failed: number
    totalArticlesCreated: number
    totalDuration: number
  }
}

export default function AutomatedPipelinePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<PipelineResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAutomatedPipeline = async () => {
    setIsRunning(true)
    setError(null)
    setResults(null)

    try {
      console.log('🚀 Starting automated pipeline...')
      const response = await fetch('/api/automated-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (data.success) {
        setResults(data)
        console.log('✅ Automated pipeline completed:', data)
      } else {
        setError(data.error || 'Pipeline failed')
        console.error('❌ Pipeline failed:', data.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Pipeline error:', err)
    } finally {
      setIsRunning(false)
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
          <Heading size="6" weight="light">Automated Discovery Pipeline</Heading>
          <Text color="gray" size="3">
            Run the complete discovery pipeline (Phase 1 + 2 + 3) for all organizations with news URLs but no published articles.
          </Text>
        </Flex>

        {/* Launch Card */}
        <Card style={{ padding: '24px' }}>
          <Flex direction="column" gap="4">
            <Flex align="center" gap="3">
              <Rocket size={24} />
              <Text size="4" weight="bold">Launch Automated Pipeline</Text>
            </Flex>
            
            <Text color="gray" size="2">
              This will automatically:
            </Text>
            
            <Box style={{ marginLeft: '16px' }}>
              <Text color="gray" size="2" style={{ display: 'block', marginBottom: '4px' }}>
                • <strong>Phase 1:</strong> Discover article URLs from each organization's news page
              </Text>
              <Text color="gray" size="2" style={{ display: 'block', marginBottom: '4px' }}>
                • <strong>Phase 2:</strong> Scrape and analyze sentiment for all discovered articles
              </Text>
              <Text color="gray" size="2" style={{ display: 'block', marginBottom: '4px' }}>
                • <strong>Phase 3:</strong> AI-enhance titles, extract images, and publish articles
              </Text>
            </Box>

            <Button 
              size="3" 
              onClick={runAutomatedPipeline}
              disabled={isRunning}
              style={{ alignSelf: 'flex-start' }}
            >
              {isRunning && <Spinner size="2" />}
              {isRunning ? 'Running Pipeline...' : 'Start Automated Pipeline'}
            </Button>

            {isRunning && (
              <Flex align="center" gap="2" mt="2">
                <Spinner size="2" />
                <Text size="2" color="gray">
                  Pipeline is running... This may take several minutes depending on the number of organizations.
                </Text>
              </Flex>
            )}
          </Flex>
        </Card>

        {/* Error Display */}
        {error && (
          <Card style={{ padding: '16px', backgroundColor: 'var(--red-3)' }}>
            <Flex align="center" gap="2">
              <XCircle size={20} color="var(--red-11)" />
              <Text color="red" weight="bold">Pipeline Failed</Text>
            </Flex>
            <Text color="red" size="2" mt="2">{error}</Text>
          </Card>
        )}

        {/* Results Summary */}
        {results && (
          <>
            <Card style={{ padding: '20px' }}>
              <Flex direction="column" gap="4">
                <Flex align="center" gap="2">
                  <CheckCircle size={24} color="var(--green-11)" />
                  <Heading size="4" color="green">Pipeline Complete!</Heading>
                </Flex>
                
                <Flex gap="6" wrap="wrap">
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold">{results.summary.processed}</Text>
                    <Text size="2" color="gray">Organizations Processed</Text>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold" color="green">{results.summary.successful}</Text>
                    <Text size="2" color="gray">Successful</Text>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold" color="red">{results.summary.failed}</Text>
                    <Text size="2" color="gray">Failed</Text>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold" color="blue">{results.summary.totalArticlesCreated}</Text>
                    <Text size="2" color="gray">Articles Created</Text>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold">{Math.round(results.summary.totalDuration / 1000)}s</Text>
                    <Text size="2" color="gray">Total Duration</Text>
                  </Flex>
                </Flex>
              </Flex>
            </Card>

            {/* Detailed Results */}
            <Card>
              <Box style={{ padding: '16px' }}>
                <Heading size="4" mb="4">Detailed Results</Heading>
                
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Organization</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>URLs Found</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Scraped</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Articles Created</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Error</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  
                  <Table.Body>
                    {results.results.map((result) => (
                      <Table.Row key={result.organizationId}>
                        <Table.Cell>
                          <Text weight="medium">{result.organizationName}</Text>
                        </Table.Cell>
                        
                        <Table.Cell>
                          <Badge color={result.success ? 'green' : 'red'}>
                            {result.success ? 'Success' : 'Failed'}
                          </Badge>
                        </Table.Cell>
                        
                        <Table.Cell>
                          <Flex align="center" gap="1">
                            {result.phase1.success ? (
                              <CheckCircle size={14} color="var(--green-11)" />
                            ) : (
                              <XCircle size={14} color="var(--red-11)" />
                            )}
                            <Text size="2">{result.phase1.urlsDiscovered}</Text>
                          </Flex>
                        </Table.Cell>
                        
                        <Table.Cell>
                          <Flex align="center" gap="1">
                            {result.phase2.success ? (
                              <CheckCircle size={14} color="var(--green-11)" />
                            ) : (
                              <XCircle size={14} color="var(--red-11)" />
                            )}
                            <Text size="2">{result.phase2.articlesScraped}</Text>
                          </Flex>
                        </Table.Cell>
                        
                        <Table.Cell>
                          <Flex align="center" gap="1">
                            {result.phase3.success ? (
                              <CheckCircle size={14} color="var(--green-11)" />
                            ) : (
                              <XCircle size={14} color="var(--red-11)" />
                            )}
                            <Text size="2" weight="bold" color={result.phase3.articlesCreated > 0 ? 'green' : undefined}>
                              {result.phase3.articlesCreated}
                            </Text>
                          </Flex>
                        </Table.Cell>
                        
                        <Table.Cell>
                          <Text size="2" color="gray">
                            {Math.round(result.duration / 1000)}s
                          </Text>
                        </Table.Cell>
                        
                        <Table.Cell>
                          {result.error && (
                            <Text size="1" color="red" style={{ maxWidth: '200px', wordBreak: 'break-word' }}>
                              {result.error}
                            </Text>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Card>
          </>
        )}
      </Flex>
    </Box>
  )
}
