// Inngest API route for handling long-running AI workflows

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { 
  urlDiscoveryJob, 
  batchProcessingJob, 
  organizationDiscoveryJob 
} from '@/inngest/urlDiscovery'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    urlDiscoveryJob,
    batchProcessingJob,
    organizationDiscoveryJob
  ],
})