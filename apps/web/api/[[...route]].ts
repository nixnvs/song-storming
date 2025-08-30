// apps/web/api/[[...route]].ts
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { app } from '../server-app.js'

// Mount the app under both "/api" and root so it works
// whether or not rewrites are applied.
const vercelApp = new Hono()
  .route('/api', app)
  .route('/', app)

export const runtime = 'nodejs'
export const GET = handle(vercelApp)
export const POST = handle(vercelApp)
export const PUT = handle(vercelApp)
export const DELETE = handle(vercelApp)
export const OPTIONS = handle(vercelApp)

export default handle(vercelApp)
