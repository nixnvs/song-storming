// apps/web/api/[[...route]].ts
import { handle } from 'hono/vercel'
import { app } from '../server-app'

export const runtime = 'edge' // you can switch to 'nodejs' if needed
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)

export default handle(app)
