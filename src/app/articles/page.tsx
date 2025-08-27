import { Container, Heading, Text, Flex, Card } from "@radix-ui/themes";

export default function ArticlesPage() {
  return (
    <Container size="4" style={{ padding: 24 }}>
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="2">
          <Heading size="8" weight="bold">Articles</Heading>
          <Text size="4" color="gray">
            Content aggregation and management
          </Text>
        </Flex>

        <Card>
          <Flex direction="column" gap="3" align="center" style={{ padding: 40 }}>
            <Text size="5" weight="bold" color="gray">
              Coming Soon
            </Text>
            <Text color="gray" style={{ textAlign: 'center' }}>
              Article management will be available once Payload CMS is integrated.
            </Text>
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}