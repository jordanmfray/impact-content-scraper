import { Flex, Text, Link, Box } from "@radix-ui/themes";
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText";
import { Globe } from "@phosphor-icons/react/dist/ssr/Globe";
import { Database } from "@phosphor-icons/react/dist/ssr/Database";
import { Gear } from "@phosphor-icons/react/dist/ssr/Gear";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import Image from "next/image";

export function Sidebar() {
  return (
    <Box 
      style={{ 
        width: 256, 
        margin: 24,
        height: 'calc(100vh - 48px)', 
        backgroundColor: '#ffffff', 
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        boxShadow: '0px 25px 50px -12px #0000003D, 0px -1px 16.6px 0px #0000001A',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo */}
      <Box style={{ padding: 24, }}>
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
          <Link href="/">
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
                  <FileText size={20} color="#171717" />
                </Box>
                <Text size="3" weight="medium" color="gray" style={{
                  color: '#171717',
                  fontFamily: 'F37Jan',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: '24px',
                }}>
                  Articles
                </Text>
              </Flex>
            </Box>
          </Link>

          {/* Organizations */}
          <Link href="/organizations">
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
                  <Globe size={20} color="#171717" />
                </Box>
                <Text size="3" weight="medium" color="gray" style={{
                  color: '#171717',
                  fontFamily: 'F37Jan',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: '24px',
                }}>
                  Organizations
                </Text>
              </Flex>
            </Box>
          </Link>

          {/* Bulk Scraping */}
          <Link href="/bulk-scrape">
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
                  <UploadSimple size={20} color="#171717" />
                </Box>
                <Text size="3" weight="medium" color="gray" style={{
                  color: '#171717',
                  fontFamily: 'F37Jan',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: '24px',
                }}>
                  Bulk Scraping
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
                  <Database size={20} color="#171717" />
                </Box>
                <Text size="3" weight="medium" color="gray" style={{
                  color: '#171717',
                  fontFamily: 'F37Jan',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: '24px',
                }}>
                  Supabase Studio
                </Text>
              </Flex>
            </Box>
          </Link>

          {/* AI Kit Runs */}
          <Link href="/ai-runs">
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
                  <Gear size={20} color="#171717" />
                </Box>
                <Text size="3" weight="medium" color="gray" style={{
                  color: '#171717',
                  fontFamily: 'F37Jan',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: '24px',
                }}>
                  AI Kit Runs
                </Text>
              </Flex>
            </Box>
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}
