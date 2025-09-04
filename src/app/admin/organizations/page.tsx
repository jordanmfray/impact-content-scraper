'use client'

import { useState, useEffect } from 'react'
import { Box, Heading, Text, Flex, Button, Card, Badge, Dialog, TextField, TextArea, IconButton, Table } from '@radix-ui/themes'
import { Plus, PencilSimple, Trash, Link as LinkIcon, Globe } from "@phosphor-icons/react/dist/ssr"

interface Organization {
  id: string
  name: string
  description?: string | null
  website?: string | null
  newsUrl?: string | null
  tags: string[]
  ein?: string | null
  createdAt: Date
  updatedAt: Date
}

interface FormData {
  name: string
  description: string
  website: string
  newsUrl: string
  tags: string
  ein: string
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    website: '',
    newsUrl: '',
    tags: '',
    ein: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations')
      const data = await response.json()
      if (data.success) {
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (org: Organization) => {
    setEditingOrg(org)
    setFormData({
      name: org.name,
      description: org.description || '',
      website: org.website || '',
      newsUrl: org.newsUrl || '',
      tags: org.tags.join(', '),
      ein: org.ein || ''
    })
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingOrg(null)
    setFormData({
      name: '',
      description: '',
      website: '',
      newsUrl: '',
      tags: '',
      ein: ''
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const url = editingOrg 
        ? `/api/admin/organizations/${editingOrg.id}`
        : '/api/admin/organizations'
      
      const method = editingOrg ? 'PUT' : 'POST'
      
      // Parse tags from comma-separated string
      const parsedTags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          website: formData.website || null,
          newsUrl: formData.newsUrl || null,
          tags: parsedTags,
          ein: formData.ein || null
        })
      })

      const data = await response.json()
      if (data.success) {
        await fetchOrganizations()
        setIsModalOpen(false)
        setEditingOrg(null)
        setFormData({ 
          name: '', 
          description: '', 
          website: '', 
          newsUrl: '',
          tags: '',
          ein: ''
        })
      } else {
        alert(`Failed to ${editingOrg ? 'update' : 'create'} organization: ${data.error}`)
      }
    } catch (error) {
      console.error('Submit failed:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (org: Organization) => {
    if (!confirm(`Are you sure you want to delete "${org.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        await fetchOrganizations()
      } else {
        alert(`Failed to delete organization: ${data.error}`)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('An error occurred. Please try again.')
    }
  }

  if (loading) {
    return (
      <Box style={{ marginLeft: '300px', marginRight: '34px', paddingTop: '24px' }}>
        <Text>Loading organizations...</Text>
      </Box>
    )
  }

  return (
    <Box style={{ 
      marginLeft: '300px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex direction="column" gap="2">
            <Heading size="6" weight="light">Organization Management</Heading>
            <Text color="gray">Manage organizations and their news URLs for article discovery</Text>
          </Flex>
          <Button onClick={handleAdd}>
            <Plus size={16} />
            Add Organization
          </Button>
        </Flex>

        {/* Stats */}
        <Flex align="center" gap="4">
          <Badge color="blue" size="2">
            {organizations.length} Organizations
          </Badge>
          <Badge color="green" size="2">
            {organizations.filter(org => org.newsUrl).length} with News URLs
          </Badge>
        </Flex>

        {/* Organizations Table */}
        {organizations.length === 0 ? (
          <Card>
            <Flex direction="column" gap="3" align="center" style={{ padding: 40 }}>
              <Text size="5" weight="bold" color="gray">No Organizations Found</Text>
              <Text color="gray" style={{ textAlign: 'center' }}>
                Click "Add Organization" to create your first organization.
              </Text>
            </Flex>
          </Card>
        ) : (
          <Card>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tags</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Website</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>News URL</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>EIN</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {organizations.map((org) => (
                  <Table.Row key={org.id}>
                    <Table.Cell>
                      <Flex direction="column" gap="1">
                        <Text weight="medium">{org.name}</Text>
                        {org.description && (
                          <Text size="2" color="gray" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {org.description}
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      {org.tags.length > 0 ? (
                        <Flex gap="1" wrap="wrap" style={{ maxWidth: '200px' }}>
                          {org.tags.map((tag, index) => (
                            <Badge key={index} size="1" color="blue" variant="soft">
                              {tag}
                            </Badge>
                          ))}
                        </Flex>
                      ) : (
                        <Text size="2" color="gray">No tags</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {org.website ? (
                        <Flex align="center" gap="2">
                          <Globe size={14} />
                          <Text size="2" style={{ color: 'var(--blue-11)' }}>
                            {new URL(org.website).hostname.replace('www.', '')}
                          </Text>
                        </Flex>
                      ) : (
                        <Text size="2" color="gray">No website</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {org.newsUrl ? (
                        <Flex align="center" gap="2">
                          <LinkIcon size={14} />
                          <Text size="2" style={{ color: 'var(--green-11)' }}>
                            {new URL(org.newsUrl).pathname}
                          </Text>
                        </Flex>
                      ) : (
                        <Text size="2" color="gray">No news URL</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {org.ein ? (
                        <Text size="2" weight="medium" color="gray">
                          {org.ein}
                        </Text>
                      ) : (
                        <Text size="2" color="gray">No EIN</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <IconButton 
                          size="1" 
                          variant="soft" 
                          onClick={() => handleEdit(org)}
                        >
                          <PencilSimple size={14} />
                        </IconButton>
                        <IconButton 
                          size="1" 
                          variant="soft" 
                          color="red"
                          onClick={() => handleDelete(org)}
                        >
                          <Trash size={14} />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        )}

        {/* Organization Form Modal */}
        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Content maxWidth="600px">
            <Dialog.Title>
              {editingOrg ? 'Edit Organization' : 'Add Organization'}
            </Dialog.Title>
            <Dialog.Description size="2" mb="4" color="gray">
              {editingOrg 
                ? 'Update organization details and news URL for article discovery.'
                : 'Create a new organization and specify their news page for article discovery.'
              }
            </Dialog.Description>

            <Flex direction="column" gap="4">
              <Box>
                <Text as="label" size="2" weight="medium">Name *</Text>
                <TextField.Root
                  placeholder="e.g., International Justice Mission"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{ marginTop: '8px' }}
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium">Description</Text>
                <TextArea
                  placeholder="Brief description of the organization..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={{ marginTop: '8px' }}
                  rows={3}
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium">Website</Text>
                <TextField.Root
                  placeholder="https://www.example.org"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  style={{ marginTop: '8px' }}
                />
              </Box>

              <Box>
                <Flex direction="column" gap="2">
                  <Text as="label" size="2" weight="medium">News/Articles URL</Text>
                  <Text size="1" color="gray">
                    Direct link to their news, blog, or press releases page for article discovery
                  </Text>
                </Flex>
                <TextField.Root
                  placeholder="https://www.ijm.org/stories?category=press-release"
                  value={formData.newsUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, newsUrl: e.target.value }))}
                  style={{ marginTop: '8px' }}
                />
                <Text size="1" color="gray" style={{ marginTop: '4px' }}>
                  Example: /news, /blog, /press-releases, /stories, /media
                </Text>
              </Box>

              <Box>
                <Flex direction="column" gap="2">
                  <Text as="label" size="2" weight="medium">Tags</Text>
                  <Text size="1" color="gray">
                    Comma-separated categorization tags (e.g., healthcare, education, international)
                  </Text>
                </Flex>
                <TextField.Root
                  placeholder="healthcare, education, international, children"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  style={{ marginTop: '8px' }}
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium">EIN (Employer Identification Number)</Text>
                <TextField.Root
                  placeholder="12-3456789"
                  value={formData.ein}
                  onChange={(e) => setFormData(prev => ({ ...prev, ein: e.target.value }))}
                  style={{ marginTop: '8px' }}
                />
              </Box>

            </Flex>

            <Flex gap="3" mt="6" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">Cancel</Button>
              </Dialog.Close>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.name || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (editingOrg ? 'Update' : 'Create')}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Box>
  )
}
