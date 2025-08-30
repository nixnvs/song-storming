import type { VercelRequest, VercelResponse } from '@vercel/node'

export const runtime = 'nodejs'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, message: 'Song Storming API (apps/web) root' })
}

