'use client'

import { Flex, Text, Button, ScrollArea, Box, Heading } from '@radix-ui/themes'
import { ArrowSquareOut, X } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect } from 'react'
import { OrganizationInfo, DateDisplay } from './ArticleCards'

interface Article {
  id: string
  title: string
  summary: string | null
  content?: string | null
  author?: string | null
  publishedAt?: Date | null
  url: string
  organization: {
    id: string
    name: string
    logo?: string | null
  }
  sentiment: string | null
  keywords: string[]
  createdAt: Date
  ogImage?: string | null
}

interface ArticlePreviewDrawerProps {
  article: Article | null
  open: boolean
  onClose: () => void
}

export function ArticlePreviewDrawer({ article, open, onClose }: ArticlePreviewDrawerProps) {
  if (!article) return null

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [open, onClose])

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'green'
      case 'negative': return 'red'
      case 'neutral': 
      default: return 'gray'
    }
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            opacity: open ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          onClick={onClose}
        />
      )}
      
      {/* Right Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(600px, 100vw)',
          backgroundColor: 'var(--color-background)',
          borderLeft: '1px solid var(--gray-6)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1001,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <Flex justify="between" align="start" p="4" style={{ borderBottom: '1px solid var(--gray-6)' }}>
          <Box style={{ flex: 1, marginRight: '1rem' }}>
            <Heading size="6" mb="2" style={{ lineHeight: '1.3' }}>
              {article.title}
            </Heading>
            {/* Summary as caption */}
            {article.summary && (
              <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
                {article.summary}
              </Text>
            )}
          </Box>
          <Button 
            variant="ghost" 
            size="2" 
            onClick={onClose}
            style={{ flexShrink: 0, marginTop: '4px' }}
          >
            <X size={20} />
          </Button>
        </Flex>

        {/* Content */}
        <ScrollArea style={{ flex: 1, overflowX: 'hidden' }}>
          <Box p="4" style={{ paddingBottom: '100px' }}>
            {/* Article Metadata */}
            <Flex direction="column" gap="4" mb="5">
              {/* Organization and Date Info */}
              <Flex justify="between" align="center" wrap="wrap" gap="3">
                <Flex align="center" gap="3">
                  <OrganizationInfo 
                    organization={article.organization} 
                    variant="medium"
                    colorScheme="blue"
                    showName={false}
                  />
                  <Text size="2" color="gray">{article.organization.name}</Text>
                </Flex>
                <Flex gap="2" align="center">
                  <DateDisplay 
                    publishedAt={article.publishedAt}
                    createdAt={article.createdAt}
                    size="medium"
                    color="gray"
                  />
                  {article.sentiment && (
                    <>
                      <Text size="2" color="gray">•</Text>
                      <Text 
                        size="2" 
                        color={getSentimentColor(article.sentiment)}
                        style={{ 
                          textTransform: 'capitalize',
                          fontWeight: 500 
                        }}
                      >
                        {article.sentiment}
                      </Text>
                    </>
                  )}
                </Flex>
              </Flex>

              {/* Main Image */}
              {article.ogImage && (
                <Box 
                  style={{ 
                    borderRadius: 'var(--radius-3)', 
                    overflow: 'hidden',
                    border: '1px solid var(--gray-6)'
                  }}
                >
                  <img 
                    src={article.ogImage} 
                    alt={article.title}
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </Box>
              )}

              {/* Keywords */}
              {article.keywords.length > 0 && (
                <Flex gap="2" wrap="wrap">
                  {article.keywords.slice(0, 8).map((keyword, index) => (
                    <Text 
                      key={index} 
                      size="1" 
                      style={{ 
                        backgroundColor: 'var(--accent-3)', 
                        color: 'var(--accent-11)',
                        padding: '2px 8px', 
                        borderRadius: 'var(--radius-2)',
                        fontWeight: 500
                      }}
                    >
                      {keyword}
                    </Text>
                  ))}
                </Flex>
              )}
            </Flex>

            {/* Article Body Content */}
            {article.content && (
              <>
                {/* Content Separator */}
                <Box style={{ 
                  height: '1px', 
                  backgroundColor: 'var(--gray-6)', 
                  margin: '20px 0' 
                }} />
                
                {/* Content Label */}
                <Text size="2" color="gray" mb="3" style={{ fontStyle: 'italic' }}>
                  Article Content
                </Text>
                
                <Box 
                  className="article-body-content"
                  style={{
                    lineHeight: '1.7',
                    fontSize: '15px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Style h1 as a section header, not the main title
                      h1: ({ children }) => (
                        <Heading size="5" mb="3" mt="6" style={{ color: 'var(--gray-12)' }}>
                          {children}
                        </Heading>
                      ),
                      h2: ({ children }) => (
                        <Heading size="4" mb="3" mt="5" style={{ color: 'var(--gray-12)' }}>
                          {children}
                        </Heading>
                      ),
                      h3: ({ children }) => (
                        <Heading size="3" mb="2" mt="4" style={{ color: 'var(--gray-12)' }}>
                          {children}
                        </Heading>
                      ),
                    p: ({ children }) => (
                      <Text as="p" size="3" mb="3" style={{ lineHeight: '1.7' }}>
                        {children}
                      </Text>
                    ),
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: 'var(--accent-11)',
                          textDecoration: 'underline',
                          fontSize: '15px'
                        }}
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <Box 
                        p="3" 
                        mb="3"
                        style={{ 
                          backgroundColor: 'var(--gray-2)', 
                          borderLeft: '4px solid var(--gray-6)',
                          fontStyle: 'italic'
                        }}
                      >
                        {children}
                      </Box>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ marginBottom: '12px', paddingLeft: '32px', listStyleType: 'disc' }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ marginBottom: '12px', paddingLeft: '32px', listStyleType: 'decimal' }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ lineHeight: '1.6', marginBottom: '4px', fontSize: '15px' }}>
                        {children}
                      </li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className?.includes('language-')
                      if (isInline) {
                        return (
                          <code 
                            style={{ 
                              backgroundColor: 'var(--gray-3)',
                              padding: '2px 4px',
                              borderRadius: 'var(--radius-1)',
                              fontSize: '0.875em',
                              fontFamily: 'monospace'
                            }}
                          >
                            {children}
                          </code>
                        )
                      }
                      return (
                        <pre 
                          style={{ 
                            backgroundColor: 'var(--gray-2)',
                            borderRadius: 'var(--radius-2)',
                            overflow: 'auto',
                            fontSize: '0.875em',
                            fontFamily: 'monospace',
                            padding: '12px',
                            marginBottom: '12px'
                          }}
                        >
                          <code>{children}</code>
                        </pre>
                      )
                    },
                    img: ({ src, alt }) => (
                      <img 
                        src={src} 
                        alt={alt || ''} 
                        style={{ 
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: 'var(--radius-2)',
                          marginBottom: '12px',
                          display: 'block'
                        }}
                      />
                    ),
                    table: ({ children }) => (
                      <div style={{ overflow: 'auto', maxWidth: '100%', marginBottom: '12px' }}>
                        <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                          {children}
                        </table>
                      </div>
                    ),
                    td: ({ children }) => (
                      <td style={{ 
                        border: '1px solid var(--gray-6)', 
                        padding: '8px', 
                        fontSize: '14px',
                        wordBreak: 'break-word'
                      }}>
                        {children}
                      </td>
                    ),
                    th: ({ children }) => (
                      <th style={{ 
                        border: '1px solid var(--gray-6)', 
                        padding: '8px', 
                        backgroundColor: 'var(--gray-2)',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {children}
                      </th>
                    )
                  }}
                >
                  {article.content}
                </ReactMarkdown>
                </Box>
              </>
            )}

            {/* Fallback if no content */}
            {!article.content && (
              <Box 
                p="4" 
                style={{ 
                  backgroundColor: 'var(--gray-2)', 
                  borderRadius: 'var(--radius-3)',
                  textAlign: 'center'
                }}
              >
                <Text size="3" color="gray">
                  No content preview available. Use the "View Original Article" button below to read the full article.
                </Text>
              </Box>
            )}
          </Box>
        </ScrollArea>
        
        {/* Fixed Bottom Bar */}
        <Box 
          p="4" 
          style={{ 
            borderTop: '1px solid var(--gray-6)', 
            backgroundColor: 'var(--color-background)',
            position: 'sticky',
            bottom: 0,
            zIndex: 10
          }}
        >
          <Button 
            size="3" 
            variant="solid"
            onClick={() => window.open(article.url, '_blank')}
            style={{ width: '100%' }}
          >
            <ArrowSquareOut size={16} />
            View Original Article
          </Button>
        </Box>
      </div>
    </>
  )
}
