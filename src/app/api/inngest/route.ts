// Inngest API route - currently unused since we're using direct execution
// Can be removed or kept for future trigger-based functionality

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
})