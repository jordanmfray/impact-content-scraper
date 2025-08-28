'use client'

import { Card, Box, Text, Flex, Badge, Avatar, Button } from '@radix-ui/themes'
import { CalendarBlank, ArrowUpRight, User } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { format } from 'date-fns'
import { useState } from 'react'
import { ArticlePreviewDrawer } from './ArticlePreviewDrawer'

interface Article {
  id: string
  title: string
  summary: string | null
  content?: string | null
  url: string
  author?: string | null
  publishedAt?: Date | null
  ogImage?: string | null
  sentiment: string | null
  keywords: string[]
  createdAt: Date
  featured: boolean
  organization: {
    id: string
    name: string
    logo?: string | null
  }
}

interface ArticleCardProps {
  article: Article
}

interface OrganizationInfoProps {
  organization: {
    id: string
    name: string
    logo?: string | null
  }
  variant?: 'small' | 'medium' | 'large'
  colorScheme?: 'blue' | 'green' | 'yellow'
  showName?: boolean
}

interface DateDisplayProps {
  publishedAt?: Date | null
  createdAt?: Date | null
  size?: 'small' | 'medium'
  color?: 'gray'
}

// Reusable Organization Info Component
export function OrganizationInfo({ 
  organization, 
  variant = 'medium', 
  colorScheme = 'blue', 
  showName = true 
}: OrganizationInfoProps) {
  const sizeMap = {
    small: { 
      avatarSize: '20px', 
      fontSize: '10px', 
      textSize: '1' as const,
      radixAvatarSize: '1' as const,
      gap: '1' as const
    },
    medium: { 
      avatarSize: '24px', 
      fontSize: '11px', 
      textSize: '2' as const,
      radixAvatarSize: '2' as const,
      gap: '2' as const
    },
    large: { 
      avatarSize: '32px', 
      fontSize: '13px', 
      textSize: '2' as const,
      radixAvatarSize: '3' as const,
      gap: '2' as const
    }
  }

  const colorMap = {
    blue: { background: '#1976D2', light: '#E3F2FD' },
    green: { background: '#388E3C', light: '#E8F5E8' },
    yellow: { background: '#F57C00', light: '#FFF9E6' }
  }

  const config = sizeMap[variant]
  const colors = colorMap[colorScheme]

  return (
    <Flex align="center" gap={config.gap}>
      {/* Avatar with first initial */}
      {organization.logo ? (
        <Avatar
          size={config.radixAvatarSize}
          src={organization.logo}
          fallback={organization.name.charAt(0).toUpperCase()}
          radius="full"
        />
      ) : (
        <Box
          style={{
            width: config.avatarSize,
            height: config.avatarSize,
            borderRadius: '50%',
            backgroundColor: colors.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Text 
            size={config.textSize} 
            weight="bold" 
            style={{ 
              color: 'white', 
              fontSize: config.fontSize 
            }}
          >
            {organization.name.charAt(0).toUpperCase()}
          </Text>
        </Box>
      )}
      
      {/* Organization name */}
      {showName && (
        <Text 
          size={config.textSize} 
          weight="medium" 
          style={{ 
            color: variant === 'small' ? '#424242' : 'var(--gray-12)',
            fontSize: variant === 'small' ? '13px' : undefined
          }}
        >
          {organization.name}
        </Text>
      )}
    </Flex>
  )
}

// Reusable Date Display Component
export function DateDisplay({ 
  publishedAt, 
  createdAt, 
  size = 'medium',
  color = 'gray'
}: DateDisplayProps) {
  // Use publishedAt if available, otherwise fall back to createdAt
  const dateToUse = publishedAt || createdAt
  
  if (!dateToUse) {
    return null
  }

  // Always format as "Jul 29, 2025"
  const formattedDate = format(new Date(dateToUse), 'MMM d, yyyy')
  
  const textSize = size === 'small' ? '1' : '2'
  
  return (
    <Flex align="center" gap="1">
      <CalendarBlank size={12} />
      <Text size={textSize} color={color}>
        {formattedDate}
      </Text>
    </Flex>
  )
}

// Hero Card - Large featured article
export function HeroCard({ article }: ArticleCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleCardClick = () => {
    setPreviewOpen(true)
  }

  return (
    <>
      <Card size="4" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={handleCardClick}>
        <Box>
          {/* Image Section */}
          <Box 
            style={{
              height: '200px',
              background: article.ogImage 
                ? `url(${article.ogImage})` 
                : 'linear-gradient(135deg, var(--blue-9), var(--purple-9))',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {!article.ogImage && (
              <Text size="6" weight="bold" style={{ color: 'white', opacity: 0.9 }}>
                {article.organization.name}
              </Text>
            )}
            
            {/* Sentiment Badge */}
            <Box style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <Badge 
                color={article.sentiment === 'positive' ? 'green' : article.sentiment === 'negative' ? 'red' : 'gray'}
                variant="solid"
              >
                {article.sentiment || 'neutral'}
              </Badge>
            </Box>
          </Box>

          {/* Content Section */}
          <Box p="4">
            {/* Organization Info */}
            <Flex align="center" gap="2" mb="3">
              <OrganizationInfo 
                organization={article.organization} 
                variant="medium"
                colorScheme="blue"
              />
              <Text size="1" color="gray">•</Text>
              <DateDisplay 
                publishedAt={article.publishedAt}
                createdAt={article.createdAt}
                size="medium"
                color="gray"
              />
            </Flex>

            {/* Title */}
            <Text 
              size="5" 
              weight="bold" 
              style={{ 
                display: 'block', 
                marginBottom: '12px',
                lineHeight: '1.3'
              }}
            >
              {article.title}
            </Text>

            {/* Summary */}
            <Text 
              size="3" 
              color="gray" 
              style={{ 
                display: 'block', 
                marginBottom: '20px',
                lineHeight: '1.5'
              }}
            >
              {article.summary?.slice(0, 150) || 'No summary available.'}
              {article.summary && article.summary.length > 150 && '...'}
            </Text>



            {/* Action */}
            <Flex align="center" justify="between">
              <Button variant="soft" size="2">
                Read Article
                <ArrowUpRight size={16} />
              </Button>
              {article.author && (
                <Flex align="center" gap="1">
                  <User size={14} />
                  <Text size="2" color="gray">{article.author}</Text>
                </Flex>
              )}
            </Flex>
          </Box>
        </Box>
      </Card>
      
      <ArticlePreviewDrawer 
        article={article}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}

// Row Card - Compact horizontal layout
export function RowCard({ article }: ArticleCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleCardClick = () => {
    setPreviewOpen(true)
  }

  return (
    <>
      <Card size="2" style={{ cursor: 'pointer' }} onClick={handleCardClick}>
        <Flex gap="3" align="start">
          {/* Thumbnail */}
          <Box 
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '6px',
              background: article.ogImage 
                ? `url(${article.ogImage})` 
                : 'linear-gradient(135deg, var(--blue-9), var(--purple-9))',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {!article.ogImage && (
              <Text size="1" weight="bold" style={{ color: 'white', opacity: 0.9 }}>
                {article.organization.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </Text>
            )}
          </Box>

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            {/* Organization & Date */}
            <Flex align="center" gap="2" mb="1">
              <OrganizationInfo 
                organization={article.organization} 
                variant="small"
                colorScheme="blue"
                showName={false}
              />
              <Text size="1" color="gray" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {article.organization.name}
              </Text>
              <Text size="1" color="gray">•</Text>
              <DateDisplay 
                publishedAt={article.publishedAt}
                createdAt={article.createdAt}
                size="small"
                color="gray"
              />
            </Flex>

            {/* Title */}
            <Text 
              size="3" 
              weight="medium" 
              style={{ 
                display: 'block', 
                marginBottom: '4px',
                lineHeight: '1.3'
              }}
            >
              {article.title.slice(0, 80)}
              {article.title.length > 80 && '...'}
            </Text>

            {/* Summary */}
            <Text 
              size="2" 
              color="gray" 
              style={{ 
                display: 'block', 
                lineHeight: '1.4'
              }}
            >
              {article.summary?.slice(0, 100) || 'No summary available.'}
              {article.summary && article.summary.length > 100 && '...'}
            </Text>


          </Box>
        </Flex>
      </Card>
      
      <ArticlePreviewDrawer 
        article={article}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}

// Grid Card - Matches the green card design from user image
export function GridCard({ article, variant = 'blue' }: ArticleCardProps & { variant?: 'blue' | 'green' | 'yellow' }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleCardClick = () => {
    setPreviewOpen(true)
  }

  // Extract domain from URL for "article from [domain]" text
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return 'example.com'
    }
  }

  const backgroundColors = {
    blue: '#F1F5FF',    // Light blue
    green: '#EAFFE4',   // Light green
    yellow: '#FFF9E6',  // Light yellow
  }

  const fontColors = {
    blue: '#2A5EEC',    // Blue
    green: '#5DBB46',   // Green
    yellow: '#E6A502',  // Yellow/Orange
  }

  return (
    <>
    <Box
      className="grid-card"
      style={{
        backgroundColor: backgroundColors[variant],
        borderRadius: '4px',
        padding: '20px',
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: 'none'
      }}
      onClick={handleCardClick}
    >
      {/* Organization Info at top */}
      <Box mb="3">
        <OrganizationInfo 
          organization={article.organization} 
          variant="small"
          colorScheme={variant}
        />
      </Box>

      {/* Flexible space that absorbs height differences */}
      <Box style={{ flex: 1 }} />

      {/* Title positioned at bottom */}
      <Text 
        size="4" 
        weight="bold" 
        style={{ 
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontWeight: '300',
          marginBottom: '12px',
          lineHeight: '1.3',
          color: fontColors[variant],
          fontSize: '24px'
        }}
      >
        {article.title}
      </Text>

      {/* Date */}
      <Box mb="3">
        <DateDisplay 
          publishedAt={article.publishedAt}
          createdAt={article.createdAt}
          size="small"
          color="gray"
        />
      </Box>

      {/* Article source at very bottom */}
      <Text 
        size="2"
        style={{ 
          display: 'block',
          color: '#757575',
          fontSize: '12px'
        }}
      >
        article from {getDomain(article.url)}
      </Text>
    </Box>
      
      <ArticlePreviewDrawer 
        article={article}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}