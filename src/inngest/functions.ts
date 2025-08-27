import { inngest } from '@/lib/inngest-client'
import { DiscoveryAgent, ScrapeAgent, EnrichAgent } from '@/inngest/agents'
import { prisma } from '@/lib/db'

export const hourlyDiscovery = inngest.createFunction(
  { id: 'hourly-discovery', cron: '0 * * * *' },
  async ({ step }) => {
    const orgs = await prisma.organization.findMany()
    for (const org of orgs) {
      await step.run(`discover-${org.id}`, async () => DiscoveryAgent.run({ input: { organizationId: org.id } }))
    }
    return { count: orgs.length }
  }
)

export const scrapeAndEnrich = inngest.createFunction(
  { id: 'scrape-enrich', event: 'content.scrape.requested' },
  async ({ event, step }) => {
    const { discoveryId, url } = event.data as { discoveryId: string; url: string }
    await step.run('scrape', () => ScrapeAgent.run({ input: { discoveryId, url } }))
    await step.run('enrich', () => EnrichAgent.run({ input: { discoveryId } }))
    return { discoveryId }
  }
)
