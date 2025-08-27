import { Container, Heading, Text, Flex, Card, Link, Button, Badge, Code } from "@radix-ui/themes";

export default async function Home() {
  return (
    <Container size="3" style={{ padding: 24 }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Heading size="8" weight="bold">Aggregation App</Heading>
          <Text size="4" color="gray">
            Next.js + Supabase + Inngest pipeline for content aggregation
          </Text>
        </Flex>

        {/* Status Cards */}
        <Flex direction="column" gap="4">
          <Heading size="5">Development Environment</Heading>
          <Flex direction="column" gap="3">
            <Card>
              <Flex align="center" justify="between">
                <Flex direction="column" gap="1">
                  <Text weight="bold">Database</Text>
                  <Text size="2" color="gray">Supabase Studio Dashboard</Text>
                </Flex>
                <Link href="http://127.0.0.1:54321" target="_blank">
                  <Button variant="soft">Open</Button>
                </Link>
              </Flex>
            </Card>
            
            <Card>
              <Flex align="center" justify="between">
                <Flex direction="column" gap="1">
                  <Text weight="bold">Functions</Text>
                  <Text size="2" color="gray">Inngest Development Server</Text>
                </Flex>
                <Link href="http://localhost:8288" target="_blank">
                  <Button variant="soft">Open</Button>
                </Link>
              </Flex>
            </Card>
            
            <Card>
              <Flex direction="column" gap="2">
                <Text weight="bold">API Endpoint</Text>
                <Text size="2" color="gray">Trigger content scraping workflow</Text>
                <Flex align="center" gap="2">
                  <Badge color="blue">POST</Badge>
                  <Code>/api/agents/trigger</Code>
                </Flex>
              </Flex>
            </Card>
          </Flex>
        </Flex>

        {/* Next Steps */}
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">✅ Foundation Ready</Heading>
            <Text>
              Core stack is stable and working. Ready to add Payload CMS using the proper installation method.
            </Text>
            <Button size="2" style={{ width: 'fit-content' }}>
              Add Payload CMS
            </Button>
          </Flex>
        </Card>
      </Flex>
    </Container>
  )
}
