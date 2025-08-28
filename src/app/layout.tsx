import "@radix-ui/themes/styles.css";
import "../styles/fonts.css";
import { Theme, Flex } from "@radix-ui/themes";
import { Sidebar } from "@/components/Sidebar";

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
          .grid-cards-container {
            display: grid;
            gap: 20px;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          }
          @media (min-width: 1200px) {
            .grid-cards-container {
              grid-template-columns: repeat(4, 1fr);
            }
          }
          @media (max-width: 768px) {
            .grid-cards-container {
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            }
          }
          .grid-card {
            box-shadow: none !important;
          }
          .grid-card:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          }
        `}</style>
      </head>
      <body>
        <Theme>
          <Flex>
            <Sidebar />
            <div style={{ flex: 1, overflow: 'auto', minHeight: '100vh', backgroundColor: '#ffffff', position: 'relative', zIndex: 1 }}>
              {children}
            </div>
          </Flex>
        </Theme>
      </body>
    </html>
  )
}
