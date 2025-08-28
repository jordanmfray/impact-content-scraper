import { Box, Heading, Text, Flex, Card, Grid, Badge, Link } from "@radix-ui/themes";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Image } from "@phosphor-icons/react/dist/ssr/Image";
import { prisma } from "@/lib/db";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

async function getOrganizations() {
  const organizations = await prisma.organization.findMany({
    orderBy: {
      name: 'asc'
    }
  });
  
  return organizations;
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();
  
  return (
    <Box style={{ 
      marginLeft: '300px',
      marginRight: '34px',
      paddingTop: '24px',
      paddingBottom: '24px'
    }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Heading size="6" weight="light">Organizations</Heading>
        </Flex>

        {/* Stats */}
        <Flex align="center" gap="4">
          <Badge color="blue" size="2">
            {organizations.length} Organizations
          </Badge>
        </Flex>

        {/* Organizations Grid */}
        <Grid columns={{ initial: "1", sm: "2", lg: "3", xl: "5" }} gap="4">
          {organizations.map((org) => (
            <Card key={org.id} style={{ height: 'fit-content' }}>
              <Flex direction="column" gap="4">
                {/* Logo Placeholder */}
                <Box
                  style={{
                    width: '100%',
                    height: 120,
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: 8,
                    border: '1px dashed var(--gray-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Flex direction="column" align="center" gap="2">
                    <Image size={24} color="var(--gray-8)" />
                    <Text size="1" color="gray" style={{ textAlign: 'center' }}>
                      Logo Placeholder
                    </Text>
                  </Flex>
                </Box>

                {/* Organization Details */}
                <Flex direction="column" gap="3">
                  {/* Name and Website */}
                  <Flex direction="column" gap="2">
                    <Heading size="4" weight="bold">
                      {org.name}
                    </Heading>
                    {org.website && (
                      <Link 
                        href={org.website} 
                        target="_blank" 
                        size="2" 
                        color="blue"
                      >
                        <Flex align="center" gap="1">
                          {extractDomain(org.website)}
                          <ArrowSquareOut size={12} />
                        </Flex>
                      </Link>
                    )}
                  </Flex>

                  {/* Description */}
                  {org.description && (
                    <Text 
                      size="2" 
                      color="gray" 
                      style={{ 
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {org.description}
                    </Text>
                  )}



                  {/* Metadata */}
                  <Flex justify="between" align="center" style={{ paddingTop: 8, borderTop: '1px solid var(--gray-6)' }}>
                    <Text size="1" color="gray">
                      Added {new Date(org.createdAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Grid>

        {/* Empty State */}
        {organizations.length === 0 && (
          <Card>
            <Flex direction="column" gap="3" align="center" style={{ padding: 40 }}>
              <Text size="5" weight="bold" color="gray">
                No Organizations Found
              </Text>
              <Text color="gray" style={{ textAlign: 'center' }}>
                Organizations will appear here once they are added to the database.
              </Text>
            </Flex>
          </Card>
        )}
      </Flex>
    </Box>
  );
}
