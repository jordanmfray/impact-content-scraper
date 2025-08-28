'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Button, Card, Badge, Spinner, Select, TextArea } from '@radix-ui/themes'
import { CheckCircle, XCircle, Eye, PencilSimple } from "@phosphor-icons/react/dist/ssr"
import { OrganizationInfo, DateDisplay } from '@/components/ArticleCards'

interface DraftArticle {
  id: string
  title: string
  summary: string | null
  content: string | null
  url: string
  author?: string | null
  publishedAt?: Date | null
  ogImage?: string | null
  images: string[] // Array of all discovered images
  sentiment: string | null
  keywords: string[]
  createdAt: Date
  status: string
  organization: {
    id: string
    name: string
    logo?: string | null
  }
}

export default function AdminDraftsPage() {
  const [drafts, setDrafts] = useState<DraftArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<DraftArticle | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftArticle | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchDrafts()
  }, [])

  const fetchDrafts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/drafts?limit=50')
      const data = await response.json()

      if (data.success) {
        setDrafts(data.drafts)
      } else {
        setError(data.error || 'Failed to fetch drafts')
      }
    } catch (err) {
      setError('Failed to fetch drafts')
      console.error('Drafts fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateDraft = async (draftId: string, updates: any) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/drafts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: draftId,
          ...updates
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setDrafts(prev => prev.map(draft => 
          draft.id === draftId ? { ...draft, ...updates } : draft
        ))
        
        // If this was a publish action, remove from drafts list
        if (updates.status === 'published') {
          setDrafts(prev => prev.filter(draft => draft.id !== draftId))
          setSelectedDraft(null)
          setEditingDraft(null)
        }
        
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

  const handlePublish = async (draft: DraftArticle) => {
    const confirmed = confirm(`Are you sure you want to publish "${draft.title}"? This will make it visible on the homepage.`)
    if (confirmed) {
      await updateDraft(draft.id, { status: 'published' })
    }
  }

  const handleReject = async (draft: DraftArticle) => {
    const confirmed = confirm(`Are you sure you want to reject "${draft.title}"? This will mark it as failed.`)
    if (confirmed) {
      await updateDraft(draft.id, { status: 'failed' })
    }
  }

  const handleSelectImage = async (draft: DraftArticle, imageUrl: string) => {
    await updateDraft(draft.id, { ogImage: imageUrl })
  }

  const handleSaveEdits = async () => {
    if (!editingDraft) return

    const success = await updateDraft(editingDraft.id, {
      title: editingDraft.title,
      summary: editingDraft.summary,
      content: editingDraft.content
    })

    if (success) {
      setEditingDraft(null)
      setSelectedDraft(editingDraft)
    }
  }

  if (loading) {
    return (
      <Flex direction="column" gap="6">
        <Heading size="6" weight="light">Draft Articles</Heading>
        <Flex justify="center" align="center" style={{ minHeight: '200px' }}>
          <Flex direction="column" align="center" gap="3">
            <Spinner size="3" />
            <Text color="gray">Loading draft articles...</Text>
          </Flex>
        </Flex>
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex direction="column" gap="6">
        <Heading size="6" weight="light">Draft Articles</Heading>
        <Flex justify="center" align="center" style={{ minHeight: '200px' }}>
          <Flex direction="column" align="center" gap="3">
            <Text size="5" color="red" weight="bold">Error</Text>
            <Text color="gray">{error}</Text>
            <Button onClick={fetchDrafts}>Retry</Button>
          </Flex>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="6">
      <Flex justify="between" align="center">
        <Box>
          <Heading size="6" weight="light">Draft Articles</Heading>
          <Text size="3" color="gray">
            {drafts.length} article{drafts.length !== 1 ? 's' : ''} awaiting review
          </Text>
        </Box>
        <Button onClick={fetchDrafts} variant="soft">
          Refresh
        </Button>
      </Flex>

      {drafts.length === 0 ? (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <Text size="4" color="gray">
            🎉 No draft articles! All articles have been reviewed.
          </Text>
        </Card>
      ) : (
        <Flex direction="column" gap="4">
          {drafts.map((draft) => (
            <Card key={draft.id} style={{ padding: '20px' }}>
              <Flex justify="between" align="start" gap="4">
                <Flex direction="column" gap="3" style={{ flex: 1 }}>
                  {/* Header */}
                  <Flex justify="between" align="start">
                    <Box style={{ flex: 1 }}>
                      <Heading size="4" mb="1">{draft.title}</Heading>
                      <Text size="2" color="gray" mb="2">{draft.summary}</Text>
                      <Flex align="center" gap="3">
                        <OrganizationInfo 
                          organization={draft.organization} 
                          variant="small" 
                          colorScheme="blue" 
                        />
                        <DateDisplay 
                          publishedAt={draft.publishedAt}
                          createdAt={draft.createdAt}
                          size="small"
                          color="gray"
                        />
                        {draft.author && (
                          <>
                            <Text size="2" color="gray">•</Text>
                            <Text size="2" color="gray">{draft.author}</Text>
                          </>
                        )}
                      </Flex>
                    </Box>
                    <Badge color="blue">Draft</Badge>
                  </Flex>

                  {/* Images Preview */}
                  {draft.images.length > 0 && (
                    <Box>
                      <Text size="2" weight="bold" mb="2">
                        Available Images ({draft.images.length}) - Current: {draft.ogImage ? '✓' : 'None selected'}
                      </Text>
                      <Flex gap="2" wrap="wrap">
                        {draft.images.slice(0, 6).map((imageUrl, index) => (
                          <Box
                            key={index}
                            onClick={() => handleSelectImage(draft, imageUrl)}
                            style={{
                              width: '80px',
                              height: '60px',
                              backgroundImage: `url(${imageUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              border: draft.ogImage === imageUrl ? '2px solid var(--blue-9)' : '1px solid var(--gray-6)',
                              transition: 'border-color 0.2s'
                            }}
                          />
                        ))}
                        {draft.images.length > 6 && (
                          <Flex
                            align="center"
                            justify="center"
                            style={{
                              width: '80px',
                              height: '60px',
                              backgroundColor: 'var(--gray-3)',
                              borderRadius: '4px',
                              border: '1px solid var(--gray-6)'
                            }}
                          >
                            <Text size="1" color="gray">+{draft.images.length - 6}</Text>
                          </Flex>
                        )}
                      </Flex>
                    </Box>
                  )}

                  {/* Actions */}
                  <Flex gap="3">
                    <Button
                      size="2"
                      onClick={() => setSelectedDraft(draft)}
                      variant="soft"
                    >
                      <Eye size={16} />
                      Preview
                    </Button>
                    <Button
                      size="2"
                      onClick={() => setEditingDraft(draft)}
                      variant="soft"
                      color="gray"
                    >
                      <PencilSimple size={16} />
                      Edit
                    </Button>
                    <Button
                      size="2"
                      onClick={() => handlePublish(draft)}
                      disabled={isUpdating}
                    >
                      <CheckCircle size={16} />
                      Publish
                    </Button>
                    <Button
                      size="2"
                      onClick={() => handleReject(draft)}
                      variant="soft"
                      color="red"
                      disabled={isUpdating}
                    >
                      <XCircle size={16} />
                      Reject
                    </Button>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      {/* Preview Modal/Drawer would go here */}
      {/* Edit Modal/Drawer would go here */}
    </Flex>
  )
}
