/// <reference types="node" />
// apps/web/api/_app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const app = new Hono()
const FRONTEND_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:4000';

// CORS: allow the UI (localhost/127) to call the API with cookies
const ALLOWED_ORIGINS = new Set<string>([
  'http://localhost:4000',
  'http://localhost:4001',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:4001',
  // add your current network URL if you open from another device:
  'http://192.168.1.16:4000',
])

app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // If no Origin (curl, same-origin), don’t send ACAO header.
      if (!origin) return null
      return ALLOWED_ORIGINS.has(origin) ? origin : null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // allow cookies across origins
    maxAge: 86400,
  }),
)

// -------------------- Basics --------------------
app.get('/', (c) => c.text('API is running. Try /api or /api/ping'))
app.get('/api', (c) => c.json({ ok: true, service: 'song-storming api' }))
app.get('/api/ping', (c) => c.text('pong'))

// Diagnostics that never 500
app.get('/api/diag', (c) => {
  const reqUrl = new URL(c.req.url)
  const vercelUrl = process.env.VERCEL_URL
  const origin = vercelUrl ? `https://${vercelUrl}` : reqUrl.origin
  const redirectUri = `${origin}/api/auth/callback`
  return c.json({
    ok: true,
    node: process.version,
    origin,
    redirectUri,
    env: {
      SPOTIFY_CLIENT_ID_present: !!process.env.SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET_present: !!process.env.SPOTIFY_CLIENT_SECRET,
    },
  })
})

// -------------------- Auth (server-side with client_secret) --------------------
function getOrigin(c: any) {
  const v = process.env.VERCEL_URL
  if (v) return `https://${v}`
  const u = new URL(c.req.url)
  return `${u.protocol}//${u.host}` // e.g. http://127.0.0.1:5177
}

// 1) Login → redirect to Spotify with correct redirectUri
app.get('/api/auth/login', (c) => {
  const origin = getOrigin(c)
  const redirectUri = `${origin}/api/auth/callback`

  const scope = [
    'user-read-email',
    'user-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-modify-playback-state',
    'user-read-playback-state',
  ].join(' ')

  const qs = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope,
    show_dialog: 'true',
  })

  return c.redirect(`https://accounts.spotify.com/authorize?${qs.toString()}`)
})

// 2) Callback → exchange code for tokens and store httpOnly cookie
app.get('/api/auth/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const err = url.searchParams.get('error')
  if (err) return c.text(`Auth error: ${err}`, 400)
  if (!code) return c.text('Missing code', 400)

  const origin = getOrigin(c)
  const redirectUri = `${origin}/api/auth/callback`

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  })

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const j = await r.json()
  if (!r.ok || !j.access_token) {
    return c.json({ ok: false, where: 'token', status: r.status, body: j }, 500)
  }

  const packed = Buffer.from(
    JSON.stringify({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_in: j.expires_in,
      obtained_at: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64')

  // httpOnly cookie (secure:false for local; true in prod)
  setCookie(c, 'sp_tokens', packed, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return c.redirect(`${FRONTEND_ORIGIN}/#connected=1`)
})

// Optional logout
app.get('/api/auth/logout', (c) => {
  deleteCookie(c, 'sp_tokens', { path: '/' })
  return c.json({ ok: true })
})

// -------------------- Token helpers --------------------
type Packed = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  obtained_at?: number
}

function readTokens(c: any): Packed | null {
  const raw = getCookie(c, 'sp_tokens')
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function writeTokens(c: any, packed: Packed) {
  const b64 = Buffer.from(JSON.stringify(packed)).toString('base64')
  setCookie(c, 'sp_tokens', b64, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false, // true in prod
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

// Refresh if the access_token is expiring/expired
async function refreshIfNeeded(c: any, tok: Packed): Promise<Packed> {
  const now = Math.floor(Date.now() / 1000)
  const expAt = (tok.obtained_at ?? 0) + (tok.expires_in ?? 0)

  // refresh if <60s remain (or expired)
  if (!tok.refresh_token || expAt - now > 60) return tok

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  })

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!r.ok) return tok
  const j = await r.json()
  if (j.access_token) {
    tok.access_token = j.access_token
    if (j.refresh_token) tok.refresh_token = j.refresh_token
    tok.expires_in = j.expires_in
    tok.obtained_at = Math.floor(Date.now() / 1000)
    writeTokens(c, tok)
  }
  return tok
}

// -------------------- Debug & Me --------------------
app.get('/api/auth/debug', (c) => {
  const raw = getCookie(c, 'sp_tokens')
  let parsed: Packed | null = null
  try {
    parsed = raw ? JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) : null
  } catch {}
  return c.json({
    ok: true,
    hasCookie: !!raw,
    hasAccessToken: !!parsed?.access_token,
    hasRefreshToken: !!parsed?.refresh_token,
  })
})

// /api/me — hit Spotify with the stored token
app.get('/api/me', async (c) => {
  let tok = readTokens(c)
  if (!tok?.access_token) {
    c.status(401)
    return c.json({ ok: false, error: 'no_token' })
  }

  tok = await refreshIfNeeded(c, tok)

  const r = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  })

  const j = await r.json()
  if (!r.ok) {
    return c.json({ ok: false, status: r.status, body: j }, r.status as any)
  }

  return c.json({ ok: true, profile: j })
})

export default app