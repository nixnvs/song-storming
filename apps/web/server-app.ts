// apps/web/server-app.ts
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

// Keep your existing ESM utils import (.js extension!)
// Server-side PKCE + Spotify helpers (self-contained)
const PKCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
function randString(len: number) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < len; i++) out += PKCE_ALPHABET[arr[i] % PKCE_ALPHABET.length]
  return out
}
export function generateCodeVerifier() {
  return randString(64)
}
function toBase64Url(buf: ArrayBuffer | Uint8Array) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Buffer.from(u8)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
export async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(digest)
}
export function buildAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  scopes: string[]
  codeChallenge: string
  state: string
}) {
  const p = new URLSearchParams({
    client_id: args.clientId,
    response_type: 'code',
    redirect_uri: args.redirectUri,
    scope: args.scopes.join(' '),
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
    state: args.state,
    show_dialog: 'false',
  })
  return `https://accounts.spotify.com/authorize?${p.toString()}`
}
export async function exchangeCodeForToken(args: {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
}) {
  const body = new URLSearchParams({
    client_id: args.clientId,
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
  })
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!r.ok) throw new Error(`token exchange failed ${r.status}: ${await r.text()}`)
  return r.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}

// ---------- Config ----------
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '4dadcbf0982443f48b2743adc6ae1226'

const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
] as const

const COOKIE_NAME = 'ss_auth'
const verifierStore = new Map<string, string>()

function writeSession(c: any, s: any) {
  setCookie(c, COOKIE_NAME, JSON.stringify(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,    // on Vercel we’re HTTPS
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
function clearSession(c: any) {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}
function getAccessTokenFromCookie(c: any): string | null {
  const raw = getCookie(c, COOKIE_NAME)
  if (!raw) return null
  try { return JSON.parse(raw)?.access_token ?? null } catch { return null }
}

// Helper to build absolute origin (works on Vercel & local)
function getOrigin(c: any) {
  const url = new URL(c.req.url)
  const host = c.req.header('x-forwarded-host') || c.req.header('host')
  const proto = c.req.header('x-forwarded-proto') || url.protocol.replace(':', '')
  return `${proto}://${host}`
}

// ---------- App ----------
export const app = new Hono()

// Health check
app.get('/', (c) => c.text('Hello from Song Storming (Vercel)!'))

// ----- Auth: Login -----
app.get('/auth/login', async (c) => {
  const origin = getOrigin(c)
  const REDIRECT_URI = `${origin}/api/auth/callback`

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = crypto.randomUUID()
  verifierStore.set(state, verifier)

  const url = buildAuthorizeUrl({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: [...SCOPES],
    codeChallenge: challenge,
    state,
  })
  return c.redirect(url)
})

// ----- Auth: Callback -----
app.get('/auth/callback', async (c) => {
  const origin = getOrigin(c)
  const FRONTEND_URL = origin                 // send user back to site root
  const REDIRECT_URI = `${origin}/api/auth/callback`

  const u = new URL(c.req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (!code) return c.text('Missing code', 400)

  try {
    const verifier = state ? verifierStore.get(state) : undefined
    if (!verifier) return c.text('Missing or expired PKCE verifier (state)', 400)

    const tokens = await exchangeCodeForToken({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      code,
      codeVerifier: verifier,
    })
    if (state) verifierStore.delete(state)

    const expires_at = Date.now() + (tokens.expires_in ?? 3600) * 1000
    writeSession(c, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at,
    })

    const packed = encodeURIComponent(Buffer.from(JSON.stringify(tokens)).toString('base64'))
    return c.redirect(`${FRONTEND_URL}/#tokens=${packed}`)
  } catch (e) {
    console.error('Token exchange failed:', e)
    return c.text('Token exchange failed', 500)
  }
})

// ----- Auth: Logout -----
app.get('/auth/logout', (c) => {
  clearSession(c)
  const origin = getOrigin(c)
  return c.redirect(origin)
})

// ----- /me (works with Authorization header OR cookie) -----
app.get('/me', async (c) => {
  const auth = c.req.header('authorization')
  let token = auth?.replace(/^Bearer\s+/i, '') ?? null
  if (!token) token = getAccessTokenFromCookie(c)
  if (!token) return c.text('No tokens yet. Login first at /auth/login', 401)

  const r = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return c.text(await r.text(), 502)
  return c.json(await r.json())
})

/* ============================================================
   ⤵️ PASTE ALL YOUR OTHER EXISTING ROUTES BELOW THIS COMMENT:
   - /devices
   - /playlists
   - /play/:playlistId
   - /api/songs  (optional, demo)
   - /api/recommendations
   - /api/generate  (+ the whole robust handleGenerate function)
   - /debug/session (optional)
   IMPORTANT: do NOT include `serve(...)` or console logs from server.ts
============================================================ */

// TEMP: debug the session cookie (safe to keep in dev)
app.get('/debug/session', (c) => {
  const raw = getCookie(c, 'ss_auth')
  let parsed: any = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { parseError: true, raw }
    }
  }

  // mask token so we don’t dump full secrets in logs
  const mask = (s?: string) => (s ? s.slice(0, 8) + '…' + s.slice(-6) : null)

  return c.json({
    hasCookie: !!raw,
    parsed: parsed
      ? {
          ...parsed,
          access_token: mask(parsed.access_token),
          refresh_token: mask(parsed.refresh_token),
        }
      : null,
  })
})

// Devices
app.get('/devices', async (c) => {
  const token = getAccessTokenFromCookie(c)
  if (!token) return c.text('Unauthorized', 401)

  const rsp = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!rsp.ok) return c.text(await rsp.text(), 502)
  return c.json(await rsp.json()) // { devices: [...] }
})

// Playlists
app.get('/playlists', async (c) => {
  const token = getAccessTokenFromCookie(c)
  if (!token) return c.text('Unauthorized', 401)

  const rsp = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!rsp.ok) return c.text(await rsp.text(), 502)
  return c.json(await rsp.json())
})

// Start playback for a playlist
app.post('/play/:playlistId', async (c) => {
  const token = getAccessTokenFromCookie(c)
  if (!token) return c.text('Unauthorized', 401)

  const playlistId = c.req.param('playlistId')
  const body = await c.req.json().catch(() => ({}))
  const deviceId = body.deviceId as string | undefined
  const position_ms = (body.position_ms as number | undefined) ?? 0

  const qs = new URLSearchParams()
  if (deviceId) qs.set('device_id', deviceId)

  const rsp = await fetch(`https://api.spotify.com/v1/me/player/play?${qs.toString()}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context_uri: `spotify:playlist:${playlistId}`,
      position_ms,
    }),
  })

  if (rsp.status === 204) return c.json({ ok: true })
  return c.text(await rsp.text(), 502)
})

// Demo feed for frontend grid
app.get('/api/songs', (c) => {
  try {
    return c.json({
      items: [
        { id: '1', title: 'Morning Light', artist: 'Nimya', duration: 214, artwork: 'https://picsum.photos/seed/1/96' },
        { id: '2', title: 'Amber Drift', artist: 'Koto K', duration: 198, artwork: 'https://picsum.photos/seed/2/96' },
        { id: '3', title: 'Porcelain Air', artist: 'Elo', duration: 232, artwork: 'https://picsum.photos/seed/3/96' },
        { id: '4', title: 'Coastal Drift', artist: 'Valen', duration: 205, artwork: 'https://picsum.photos/seed/4/96' },
        { id: '5', title: 'Soft Linen', artist: 'Marín', duration: 221, artwork: 'https://picsum.photos/seed/5/96' },
      ],
    })
  } catch (e) {
    console.error('Error in /api/songs:', e)
    return c.text('Internal Server Error', 500)
  }
})

// Recommendations (defensive: stepwise fallbacks + logs)
app.get('/api/recommendations', async (c) => {
  const raw = getCookie(c, COOKIE_NAME)
  if (!raw) {
    c.status(401)
    return c.text('Not authenticated. Go to /auth/login first.')
  }

  let accessToken: string | undefined
  try {
    const s = JSON.parse(raw)
    accessToken = s?.access_token
  } catch {}
  if (!accessToken) {
    c.status(401)
    return c.text('Missing access token. Re-login at /auth/login.')
  }

  const url = new URL(c.req.url)
  const service = url.searchParams.get('service') ?? 'lunch'

  const PRESETS: Record<string, { energy: number; valence: number; tempo: number }> = {
    lunch:  { energy: 0.45, valence: 0.65, tempo: 110 },
    dinner: { energy: 0.35, valence: 0.55, tempo: 95  },
    late:   { energy: 0.65, valence: 0.55, tempo: 120 },
  }
  const t = PRESETS[service] ?? PRESETS.lunch

  // Attempt 1 — single global artist + market=from_token
  const p1 = new URLSearchParams({
    limit: '10',
    market: 'from_token',
    seed_artists: '3TVXtAsR1Inumwj472S9r4', // Drake
  })
  console.log('GET /api/recommendations ->', p1.toString())
  let rsp = await fetch(`https://api.spotify.com/v1/recommendations?${p1.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // Attempt 2 — fallback to another popular artist
  if (!rsp.ok && (rsp.status === 404 || rsp.status === 400)) {
    console.warn('First recommendations attempt failed', rsp.status, '— retrying with safe artist fallback')
    const p2 = new URLSearchParams({
      limit: '20',
      market: 'from_token',
      seed_artists: '66CXWjxzNUsdJxJ2JdwvnR', // Ariana Grande
    })
    rsp = await fetch(`https://api.spotify.com/v1/recommendations?${p2.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  // Attempt 3 — genre-only pop (omit market), with targets
  if (!rsp.ok && (rsp.status === 404 || rsp.status === 400)) {
    console.warn('Second recommendations attempt failed', rsp.status, '— retrying with safe genre params')
    const p3 = new URLSearchParams({
      limit: '30',
      seed_genres: 'pop',
      target_energy: String(t.energy),
      target_valence: String(t.valence),
      target_tempo: String(t.tempo),
    })
    rsp = await fetch(`https://api.spotify.com/v1/recommendations?${p3.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  if (!rsp.ok) {
    const txt = await rsp.text()
    console.error('Recommendations failed:', rsp.status, txt)
    c.status(502)
    return c.text(`Spotify /recommendations failed (${rsp.status}): ${txt}`)
  }

  return c.json(await rsp.json())
})

// --- helpers for generate ---
function shuffleInPlace<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
}
function uniqBy<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of arr) {
    const k = key(x)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(x)
    }
  }
  return out
}
function parseArtistSeeds(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean)
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
}
async function resolveArtistIds(namesOrUrls: string[], token: string): Promise<string[]> {
  const out: string[] = []
  for (const item of namesOrUrls) {
    // accept full artist URLs too
    const m = item.match(/artist\/([A-Za-z0-9]+)(\?|$)/)
    if (m) { out.push(m[1]); continue }

    // fallback: search by name
    const q = encodeURIComponent(item)
    const rsp = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1&market=from_token`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (rsp.ok) {
      const js = await rsp.json()
      const id = js?.artists?.items?.[0]?.id
      if (id) out.push(id)
    }
  }
  return Array.from(new Set(out)).slice(0, 5)
}

async function handleGenerate(c: any) {
  console.log('[GEN] start', new Date().toISOString())

  /* 1) Auth */
  const raw = getCookie(c, 'ss_auth')
  if (!raw) return c.text('Unauthorized (no cookie)', 401 as const)
  let token: string | undefined
  try { token = JSON.parse(raw)?.access_token } catch {}
  if (!token) return c.text('Unauthorized (no token)', 401 as const)

  /* 2) Body */
  const body = await c.req.json().catch(() => ({} as any))
  const service = (body?.service ?? 'lunch') as 'lunch' | 'dinner' | 'late'
  const length  = Math.max(10, Math.min(80, Number(body?.length ?? 50)))
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : undefined

  const seedArtistInput = parseArtistSeeds(body?.seeds?.artists)
  const defaultArtistNames = ['Khruangbin', 'Men I Trust', 'Parcels', 'Tom Misch', 'FKJ']
  const artistNamesToUse = seedArtistInput.length ? seedArtistInput : defaultArtistNames
  console.log('[GEN] body', { service, length, deviceId, seedArtists: artistNamesToUse })

  // Mood targets local to this handler (so `t` is always defined)
  const TARGETS: Record<'lunch'|'dinner'|'late', { energy: number; valence: number; tempo: number }> = {
    lunch:  { energy: 0.55, valence: 0.65, tempo: 110 },
    dinner: { energy: 0.50, valence: 0.60, tempo: 100 },
    late:   { energy: 0.70, valence: 0.55, tempo: 120 },
  }
  const t = TARGETS[service]

  /* 3) Who am I? (need id for playlist creation) */
  let rsp = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!rsp.ok) {
    const ttxt = await rsp.text()
    console.error('[GEN] /me failed:', rsp.status, ttxt)
    c.status(502)
    return c.text(`Spotify /me failed (${rsp.status}): ${ttxt}`)
  }
  const me = await rsp.json()
  console.log('[GEN] me OK for user', me?.id)

  // 4) Collect candidate tracks (service-specific, robust without /recommendations)
  type ServiceKey = 'lunch' | 'dinner' | 'late'

  const PROFILE: Record<ServiceKey, {
    energy: number; valence: number; tempo: number;
    search: string;            // tuned search query
    editorial: string[];       // Spotify editorial playlists to sample from (public)
  }> = {
    lunch: {
      energy: 0.55, valence: 0.65, tempo: 110,
      // Indie/alt/pop, mostly 2018+ to feel current, keep explicit filtering out via -tag is not supported, so narrow by year/genres.
      search: '(genre:indie OR genre:indie-pop OR genre:alt OR genre:pop) year:2018-2025',
      editorial: [
        '37i9dQZF1DX4WYpdgoIcn6', // All New Indie
        '37i9dQZF1DX2yvmlOdMYzL', // Chill Hits
        '37i9dQZF1DXcBWIGoYBM5M', // Today’s Top Hits (broad but good for topping up)
      ],
    },
    dinner: {
      energy: 0.40,
      valence: 0.55,
      tempo: 85,
      // refined queries: sophisticated, elegant dining
      search: '(genre:jazz OR genre:"vocal jazz" OR genre:"smooth jazz" OR genre:classical OR genre:"modern classical" OR genre:piano OR genre:"string quartet" OR genre:"neo-soul")',
      editorial: [
        '37i9dQZF1DX4wta20PHgwo', // Jazz Vibes
        '37i9dQZF1DWXmz58dhY0E9', // Evening Jazz
        '37i9dQZF1DWWEJlAGA9gs0', // Classical Essentials
        '37i9dQZF1DX1s9knjP51Oa', // Piano Classics
      ],
    },
    late: {
      energy: 0.70, valence: 0.55, tempo: 120,
      search: '(genre:electronic OR genre:house OR genre:techno OR genre:deep-house) year:2018-2025',
      editorial: [
        '37i9dQZF1DXa2SPUyWl8Y5', // Dance Brand New (backup)
        '37i9dQZF1DWXRqgorJj26U', // Night Rider (electronic / late vibe; backup)
        '37i9dQZF1DX0Tkc6ltcBfU', // Electronic Rising (backup)
      ],
    },
  }

  // Collect candidate URIs (the full implementation continues)
  let uris: string[] = []
  const recLimit = Math.max(20, Math.min(100, Math.round(length * 1.5)))

  // Attempt: recommendations based on resolved artist IDs
  try {
    const artistIds = await resolveArtistIds(artistNamesToUse, token!)
    if (artistIds.length) {
      const p = new URLSearchParams({
        limit: String(Math.min(50, recLimit)),
        seed_artists: artistIds.slice(0, 5).join(','),
        target_energy: String(t.energy),
        target_valence: String(t.valence),
        target_tempo: String(t.tempo),
      })
      const r = await fetch(`https://api.spotify.com/v1/recommendations?${p.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const j = await r.json()
        const recUris = (j.tracks ?? []).map((x: any) => x?.uri).filter(Boolean)
        uris.push(...recUris)
      }
    }
  } catch {}

  // Fallbacks and top-ups (condensed here; full logic kept from server.ts)
  if (uris.length < recLimit) {
    try {
      const q = encodeURIComponent(PROFILE[service].search)
      const sr = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (sr.ok) {
        const sj = await sr.json()
        const extra = (sj.tracks?.items ?? [])
          .map((t: any) => t?.uri)
          .filter(Boolean) as string[]
        uris.push(...extra)
      }
    } catch {}
  }

  // Editorial playlist fallback — sample tracks from reliable public playlists
  if (uris.length < recLimit) {
    const editorial = PROFILE[service].editorial
    const pulled: string[] = []
    for (const pid of editorial) {
      if (pulled.length >= recLimit) break
      try {
        const tr = await fetch(`https://api.spotify.com/v1/playlists/${pid}/tracks?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!tr.ok) continue
        const tj = await tr.json()
        const pUris = (tj.items ?? [])
          .map((it: any) => it?.track?.uri)
          .filter(Boolean) as string[]
        pulled.push(...pUris)
      } catch {}
    }
    if (pulled.length) {
      shuffleInPlace(pulled)
      uris = Array.from(new Set([...uris, ...pulled]))
    }
  }

  // Finalize candidates
  uris = Array.from(new Set(uris))
  for (let i = uris.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[uris[i], uris[j]] = [uris[j], uris[i]]
  }
  let trackUris = uris.slice(0, length)
  if (trackUris.length === 0) {
    console.error('[GEN] No tracks after all fallbacks')
    return c.text(
      'Could not build a track list (Spotify 404/empty). Try again in a minute.',
      502 as const
    )
  }

  /* 5) Create playlist */
  const today = new Date().toISOString().slice(0, 10)
  const playlistName = `Blossom • ${service[0].toUpperCase() + service.slice(1)} • ${today}`

  rsp = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: playlistName,
      public: false,
      description: `Auto-generated for ${service} • energy=${t.energy}, valence=${t.valence}, tempo=${t.tempo}`,
    }),
  })
  if (!rsp.ok) {
    const ttxt = await rsp.text()
    console.error('[GEN] create playlist failed:', rsp.status, ttxt)
    c.status(502)
    return c.text(`Spotify create playlist failed (${rsp.status}): ${ttxt}`)
  }
  const playlist = await rsp.json()
  console.log('[GEN] created playlist', playlist?.id)

  /* 6) Add tracks */
  if (trackUris.length) {
    rsp = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: trackUris }),
    })
    if (!rsp.ok) {
      const ttxt = await rsp.text()
      console.error('[GEN] add tracks failed:', rsp.status, ttxt)
      c.status(502)
      return c.text(`Spotify add tracks failed (${rsp.status}): ${ttxt}`)
    }
    console.log('[GEN] added tracks OK')
  } else {
    console.warn('[GEN] no track URIs to add')
  }

  /* 7) Optional autoplay */
  if (deviceId) {
    const qs = new URLSearchParams({ device_id: deviceId })
    const playUrl = `https://api.spotify.com/v1/me/player/play?${qs.toString()}`
    console.log('[GEN] autoplay URL →', playUrl)

    await fetch(playUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context_uri: `spotify:playlist:${playlist.id}` }),
    }).then(async (r) => {
      if (!r.ok) {
        const ttxt = await r.text()
        console.warn('[GEN] autoplay failed (ignored):', r.status, ttxt)
      } else {
        console.log('[GEN] autoplay OK')
      }
    }).catch((e) => {
      console.warn('[GEN] autoplay error (ignored):', e)
    })
  }

  console.log('[GEN] done', { id: playlist.id, tracks: trackUris.length })
  return c.json({ id: playlist.id, name: playlist.name, tracks: trackUris.length })
}

// expose under BOTH paths so your dev proxy works
app.post('/api/generate', handleGenerate)
app.post('/generate', handleGenerate)
