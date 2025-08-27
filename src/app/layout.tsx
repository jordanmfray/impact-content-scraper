import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

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
      <body>
        <Theme>
          {children}
        </Theme>
      </body>
    </html>
  )
}
