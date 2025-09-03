// Simple sanity endpoint to verify Vercel API wiring
export const runtime = 'nodejs'

export default async function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, message: 'pong' })
}
