import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest-client'
import * as fns from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(fns),
})
