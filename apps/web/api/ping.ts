// Simple sanity endpoint to verify Vercel API wiring
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const runtime = 'nodejs'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, message: 'pong' })
}

