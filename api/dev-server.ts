import { config } from 'dotenv'
config({ path: '.env.local' })

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import app from './_app'

const port = 5177

// Wrap your app with CORS
const root = new Hono()
root.use('*', cors({
  origin: ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:4004'],
  credentials: true,
}))
root.route('/', app)

serve(
  {
    fetch: root.fetch,
    port,
  },
  () => {
    console.log(`API dev server listening on http://localhost:${port}`)
  }
)