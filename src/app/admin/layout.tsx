import { Box, Flex, Heading, Text, Link } from "@radix-ui/themes"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Box style={{ 
      marginLeft: '310px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      {/* Admin Header */}
      <Box mb="6" pb="4" style={{ borderBottom: '1px solid var(--gray-6)' }}>
        <Flex justify="between" align="center">
          <Box>
            <Heading size="7" weight="bold" mb="1">🛠️ Admin Dashboard</Heading>
            <Text size="3" color="gray">Manage articles and content</Text>
          </Box>
          <Flex gap="4" align="center">
            <Link href="/admin/drafts">
              <Text size="3" weight="medium">Draft Articles</Text>
            </Link>
            <Link href="/">
              <Text size="3" weight="medium" color="gray">← Back to Site</Text>
            </Link>
          </Flex>
        </Flex>
      </Box>
      
      {children}
    </Box>
  )
}
