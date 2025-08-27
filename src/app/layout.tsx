import "@radix-ui/themes/styles.css";
import { Inter } from "next/font/google";
import { Theme, Flex } from "@radix-ui/themes";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: 'Aggregation App',
  description: 'Next.js + Supabase + Inngest pipeline for content aggregation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          .nav-item:hover {
            background-color: var(--gray-4) !important;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <Theme>
          <Flex>
            <Sidebar />
            <div style={{ flex: 1, overflow: 'auto' }}>
              {children}
            </div>
          </Flex>
        </Theme>
      </body>
    </html>
  )
}
