export const runtime = 'nodejs'

export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, message: 'Song Storming API (apps/web) root' })
}
