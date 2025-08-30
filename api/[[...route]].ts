// Root-level catch-all API route to avoid rootDirectory routing issues
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { app as inner } from '../apps/web/server-app.js'

const app = new Hono()
  .route('/api', inner)
  .route('/', inner)

export const runtime = 'nodejs'
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)

export default handle(app)

