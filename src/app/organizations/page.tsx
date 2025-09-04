import { Box, Heading, Text, Flex, Badge, Link, Table } from "@radix-ui/themes";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
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
    include: {
      _count: {
        select: {
          articles: {
            where: {
              status: 'published'
            }
          }
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  });
  
  return organizations;
}

export default async function OrganizationsPage() {
  const organizations = (await getOrganizations()) as unknown as Array<{
    id: string;
    name: string;
    website: string | null;
    ein: string | null;
    tags: string[];
    createdAt: Date;
    _count: {
      articles: number;
    };
  }>;
  
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

        {/* Organizations Table */}
        {organizations.length > 0 ? (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Website</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>EIN</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Published Articles</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tags</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {organizations.map((org) => (
                <Table.Row key={org.id}>
                  <Table.RowHeaderCell>
                    <Text weight="medium">{org.name}</Text>
                  </Table.RowHeaderCell>
                  
                  <Table.Cell>
                    {org.website ? (
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
                    ) : (
                      <Text color="gray" size="2">—</Text>
                    )}
                  </Table.Cell>
                  
                  <Table.Cell>
                    {org.ein ? (
                      <Text size="2">{org.ein}</Text>
                    ) : (
                      <Text color="gray" size="2">—</Text>
                    )}
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Text size="2">{org._count.articles}</Text>
                  </Table.Cell>
                  
                  <Table.Cell>
                    {org.tags && org.tags.length > 0 ? (
                      <Flex gap="1" wrap="wrap">
                        {org.tags.slice(0, 3).map((tag: string, index: number) => (
                          <Badge key={index} color="blue" size="1">
                            {tag}
                          </Badge>
                        ))}
                        {org.tags.length > 3 && (
                          <Badge color="gray" size="1">
                            +{org.tags.length - 3}
                          </Badge>
                        )}
                      </Flex>
                    ) : (
                      <Text color="gray" size="2">—</Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        ) : (
          <Box style={{ textAlign: 'center', padding: '40px' }}>
            <Text size="5" weight="bold" color="gray">
              No Organizations Found
            </Text>
            <Text color="gray" style={{ marginTop: '8px' }}>
              Organizations will appear here once they are added to the database.
            </Text>
          </Box>
        )}
      </Flex>
    </Box>
  );
}
