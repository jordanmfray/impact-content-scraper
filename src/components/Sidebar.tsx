import { Flex, Text, Link, Box } from "@radix-ui/themes";
import { IdCardIcon, StackIcon, ReloadIcon } from "@radix-ui/react-icons";
import Image from "next/image";

export function Sidebar() {
  return (
    <Box 
      style={{ 
        width: 256, 
        height: '100vh', 
        backgroundColor: 'var(--gray-2)', 
        borderRight: '1px solid var(--gray-6)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Logo */}
      <Box style={{ padding: 24, borderBottom: '1px solid var(--gray-6)' }}>
        <Image
          src="/images/gloo-impact-logo.svg"
          alt="Gloo Impact"
          width={140}
          height={33}
          style={{ height: 32, width: 'auto' }}
        />
      </Box>

      {/* Navigation */}
      <Box style={{ flex: 1, padding: 16 }}>
        <Flex direction="column" gap="2">
          {/* Articles */}
          <Link href="/articles">
            <Box
              style={{
                padding: 12,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              className="nav-item"
            >
              <Flex align="center" gap="3">
                <Box style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IdCardIcon width="16" height="16" />
                </Box>
                <Text size="3" weight="medium" color="gray">
                  Articles
                </Text>
              </Flex>
            </Box>
          </Link>

          {/* Supabase Studio */}
          <Link href="http://localhost:54323" target="_blank">
            <Box
              style={{
                padding: 12,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              className="nav-item"
            >
              <Flex align="center" gap="3">
                <Box style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StackIcon width="16" height="16" />
                </Box>
                <Text size="3" weight="medium" color="gray">
                  Supabase Studio
                </Text>
              </Flex>
            </Box>
          </Link>

          {/* Agent Kit Dashboard */}
          <Link href="http://localhost:8288" target="_blank">
            <Box
              style={{
                padding: 12,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              className="nav-item"
            >
              <Flex align="center" gap="3">
                <Box style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ReloadIcon width="16" height="16" />
                </Box>
                <Text size="3" weight="medium" color="gray">
                  Agent Kit Dashboard
                </Text>
              </Flex>
            </Box>
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}
