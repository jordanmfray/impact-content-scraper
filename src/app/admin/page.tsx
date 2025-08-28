import { Box, Heading, Text, Flex, Card, Link, Button } from "@radix-ui/themes"
import { FileText, Eye, Upload, Database } from "@phosphor-icons/react/dist/ssr"

export default function AdminHomePage() {
  return (
    <Flex direction="column" gap="6">
      <Box>
        <Heading size="6" weight="light" mb="2">Welcome to Admin Dashboard</Heading>
        <Text size="3" color="gray">
          Manage articles, review drafts, and control content publishing
        </Text>
      </Box>

      {/* Quick Actions */}
      <Flex direction="column" gap="4">
        <Heading size="4" weight="medium">Quick Actions</Heading>
        
        <Flex gap="4" wrap="wrap">
          <Link href="/admin/drafts" style={{ textDecoration: 'none', flex: '1', minWidth: '250px' }}>
            <Card style={{ padding: '24px', cursor: 'pointer', transition: 'transform 0.2s ease', height: '100%' }}>
              <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                  <FileText size={24} color="var(--blue-9)" />
                  <Heading size="4">Draft Articles</Heading>
                </Flex>
                <Text size="2" color="gray">
                  Review and publish articles that are awaiting approval
                </Text>
                <Button variant="soft" size="2" style={{ marginTop: 'auto', width: 'fit-content' }}>
                  Review Drafts
                </Button>
              </Flex>
            </Card>
          </Link>

          <Link href="/bulk-scrape" style={{ textDecoration: 'none', flex: '1', minWidth: '250px' }}>
            <Card style={{ padding: '24px', cursor: 'pointer', transition: 'transform 0.2s ease', height: '100%' }}>
              <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                  <Upload size={24} color="var(--green-9)" />
                  <Heading size="4">Bulk Scraping</Heading>
                </Flex>
                <Text size="2" color="gray">
                  Add multiple articles at once using the bulk scraping tool
                </Text>
                <Button variant="soft" size="2" color="green" style={{ marginTop: 'auto', width: 'fit-content' }}>
                  Bulk Scrape
                </Button>
              </Flex>
            </Card>
          </Link>

          <Link href="/" style={{ textDecoration: 'none', flex: '1', minWidth: '250px' }}>
            <Card style={{ padding: '24px', cursor: 'pointer', transition: 'transform 0.2s ease', height: '100%' }}>
              <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                  <Eye size={24} color="var(--purple-9)" />
                  <Heading size="4">View Site</Heading>
                </Flex>
                <Text size="2" color="gray">
                  See how published articles appear on the main website
                </Text>
                <Button variant="soft" size="2" color="purple" style={{ marginTop: 'auto', width: 'fit-content' }}>
                  View Homepage
                </Button>
              </Flex>
            </Card>
          </Link>
        </Flex>
      </Flex>

      {/* System Status */}
      <Flex direction="column" gap="3">
        <Heading size="4" weight="medium">System Overview</Heading>
        <Card style={{ padding: '20px' }}>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Text size="3" weight="medium">Draft/Publish Workflow</Text>
              <Text size="2" color="green">✅ Active</Text>
            </Flex>
            <Text size="2" color="gray">
              All scraped articles now start as drafts and require manual review before publishing.
              This ensures quality control and allows you to select the best images for each article.
            </Text>
          </Flex>
        </Card>
        
        <Card style={{ padding: '20px' }}>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Text size="3" weight="medium">Enhanced Image Collection</Text>
              <Text size="2" color="green">✅ Active</Text>
            </Flex>
            <Text size="2" color="gray">
              Firecrawl now extracts multiple images from each page, giving you options to choose 
              the best main image during the review process.
            </Text>
          </Flex>
        </Card>
      </Flex>
    </Flex>
  )
}
