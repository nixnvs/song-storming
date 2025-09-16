/// <reference types="node" />
// apps/web/api/_app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { generateBlock } from "./controllers/generator";
import {
  addTracksToPlaylist,
  calculatePlaylistDuration,
  createSpotifyPlaylist,
  getUserPlaylists,
  startSpotifyPlaylist,
} from "./controllers/playlist";
import {
  createUser,
  createUserPlayBlock,
  getRegisteredUser,
  SpotifyUser,
} from "./controllers/user";
import { getUserPlayHistory } from "./controllers/history";

const app = new Hono();

const getFrontendOrigin = () => process.env.FRONTEND_ORIGIN;
const getOrigin = () =>
  process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:5177"
    : getFrontendOrigin();

const getEnvironment = () => process.env.NODE_ENV;

// -------------------- Token helpers --------------------
type Packed = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  obtained_at?: number;
  user_id?: string;
};

function readTokens(c: any): Packed | null {
  const raw = getCookie(c, "sp_tokens");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function writeTokens(c: any, packed: Packed) {
  const b64 = Buffer.from(JSON.stringify(packed)).toString("base64");
  setCookie(c, "sp_tokens", b64, {
    httpOnly: true,
    sameSite: getEnvironment() === "development" ? "none" : "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // If no Origin (curl, same-origin), don’t send ACAO header.
      if (!origin) return null;
      return origin === getFrontendOrigin() ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true, // allow cookies across origins
    maxAge: 86400,
  })
);

// -------------------- Basics --------------------

app.get("/api/ping", (c) => c.text("pong"));

// Diagnostics that never 500
app.get("/api/diag", (c) => {
  const reqUrl = new URL(c.req.url);
  const vercelUrl = process.env.VERCEL_URL;
  const origin = vercelUrl ? `https://${vercelUrl}` : reqUrl.origin;
  const redirectUri = `${origin}/api/auth/callback`;
  return c.json({
    ok: true,
    node: process.version,
    origin,
    redirectUri,
    env: {
      SPOTIFY_CLIENT_ID_present: !!process.env.SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET_present: !!process.env.SPOTIFY_CLIENT_SECRET,
    },
  });
});

// 1) Login → redirect to Spotify with correct redirectUri
app.get("/api/auth/login", (c) => {
  const origin = getOrigin();
  const redirectUri = `${origin}/api/auth/callback`;

  const state = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

  const scope = [
    "user-read-email",
    "user-read-private",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  const qs = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope,
    state,
    show_dialog: "true",
  });

  const url = `https://accounts.spotify.com/authorize?${qs.toString()}`;

  return c.redirect(url);
});

// 2) Callback → exchange code for tokens and store httpOnly cookie
app.get("/api/auth/callback", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (state === null) {
    c.text("State mismatch", 400);
  }
  if (err) return c.text(`Auth error: ${err}`, 400);
  if (!code) return c.text("Missing code", 400);

  const origin = getOrigin();
  const redirectUri = `${origin}/api/auth/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",

      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`
      ).toString("base64")}`,
    },
    body,
  });

  const j = await r.json();
  if (!r.ok || !j.access_token) {
    return c.json(
      { ok: false, where: "token", status: r.status, body: j },
      500
    );
  }

  const user = await getSpotifyUser(j.access_token);

  await createUser(user);

  const packed = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_in: j.expires_in,
    obtained_at: Math.floor(Date.now() / 1000),
    user_id: user.id,
  } as Packed;

  writeTokens(c, packed);

  return c.redirect(`${getFrontendOrigin()}/#connected=1`);
});

// Optional logout
app.get("/api/auth/logout", (c) => {
  deleteCookie(c, "sp_tokens", {
    path: "/",
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  return c.json({ ok: true });
});

// Refresh if the access_token is expiring/expired
async function refreshIfNeeded(c: any, tok: Packed): Promise<Packed> {
  const now = Math.floor(Date.now() / 1000);
  const expAt = (tok.obtained_at ?? 0) + (tok.expires_in ?? 0);

  // refresh if <60s remain (or expired)
  if (!tok.refresh_token || expAt - now > 60) return tok;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tok.refresh_token,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  });

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) return tok;
  const j = await r.json();
  if (j.access_token) {
    tok.access_token = j.access_token;
    if (j.refresh_token) tok.refresh_token = j.refresh_token;
    tok.expires_in = j.expires_in;
    tok.obtained_at = Math.floor(Date.now() / 1000);
    writeTokens(c, tok);
  }
  return tok;
}

async function getSpotifyUser(accessToken): Promise<SpotifyUser> {
  const r = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`Spotify user API failed: ${r.status}`);
  }
  return r.json();
}

const getSpotifyToken = async (c) => {
  return async () => {
    let tok = readTokens(c);
    if (!tok?.access_token) {
      c.status(401);
      return c.json({ ok: false, error: "no_token" });
    }
    tok = await refreshIfNeeded(c, tok!);
    return tok.access_token;
  };
};

// -------------------- Debug & Me --------------------
app.get("/api/auth/debug", (c) => {
  const raw = getCookie(c, "sp_tokens");
  let parsed: Packed | null = null;
  try {
    parsed = raw
      ? JSON.parse(Buffer.from(raw, "base64").toString("utf8"))
      : null;
  } catch {}
  return c.json({
    ok: true,
    hasCookie: !!raw,
    hasAccessToken: !!parsed?.access_token,
    hasRefreshToken: !!parsed?.refresh_token,
  });
});

// /api/me — hit Spotify with the stored token
app.get("/api/me", async (c) => {
  let tok = readTokens(c);
  if (!tok?.access_token) {
    c.status(401);
    return c.json({ ok: false, error: "no_token" });
  }

  tok = await refreshIfNeeded(c, tok);

  const j = await getSpotifyUser(tok.access_token);

  return c.json({ ok: true, profile: j });
});

app.post("/api/generator", async (c) => {
  try {
    const body = await c.req.json();
    const { date_iso, block_name, force = true, admin_override = false } = body;

    if (!date_iso || !block_name) {
      return c.json({ error: "Required fields: date_iso, block_name" }, 400);
    }

    const user = await getRegisteredUser(readTokens(c)?.user_id ?? "");

    if (!user) {
      return c.json({ error: "User not found" }, 400);
    }

    const result = await generateBlock(date_iso, block_name, user, {
      force,
      admin_override,
    });

    return c.json(result, result.error ? 400 : 201);
  } catch (error: any) {
    console.error("Error generating playlist:", error);
    return c.json({ error: "Failed to generate playlist" }, 500);
  }
});

app.post("/api/playlists", async (c) => {
  try {
    const body = await c.req.json();
    const { dateISO, blockName, uris } = body;

    if (!dateISO || !blockName || !Array.isArray(uris)) {
      return c.json(
        { error: "Missing required parameters: dateISO, blockName, uris" },
        { status: 400 }
      );
    }

    let tok = readTokens(c);

    if (!tok?.access_token) {
      c.status(401);
      return c.json({ ok: false, error: "no_token" });
    }

    tok = await refreshIfNeeded(c, tok!);
    // Get Spotify access token
    const accessToken = tok.access_token;
    if (!accessToken) {
      return c.json(
        { error: "Spotify authentication required" },
        { status: 401 }
      );
    }

    // Get current user
    const user = await getRegisteredUser(readTokens(c)?.user_id ?? "");

    if (!user) {
      return c.json(
        { error: "Failed to get Spotify user information" },
        { status: 400 }
      );
    }

    // Create playlist
    const playlist = await createSpotifyPlaylist(
      accessToken,
      user.spotify_id,
      dateISO,
      blockName,
      uris.length
    );
    if (!playlist) {
      return c.json(
        { error: "Failed to create Spotify playlist" },
        { status: 500 }
      );
    }

    await createUserPlayBlock(
      user.id,
      blockName,
      playlist.external_urls.spotify
    );

    const getValidSpotifyToken = getSpotifyToken(c);

    // Add tracks to playlist in chunks
    const tracksAdded = await addTracksToPlaylist(
      accessToken,
      playlist.id,
      uris,
      getValidSpotifyToken
    );

    // Calculate total duration for response
    const totalDurationSec = await calculatePlaylistDuration(
      dateISO,
      blockName
    );

    await startSpotifyPlaylist(playlist.id, accessToken);

    return c.json({
      success: true,
      playlist_url: playlist.external_urls.spotify,
      playlist_id: playlist.id,
      name: playlist.name,
      tracks_added: tracksAdded,
      total_duration_min: Math.round(totalDurationSec / 60),
      user: user.name,
    });
  } catch (error) {
    console.error("Error creating Spotify playlist:", error);
    return c.json(
      { error: `Failed to create playlist: ${error.message}` },
      { status: 500 }
    );
  }
});

app.get("/api/playlists", async (c) => {
  const { date } = c.req.query();
  const user = await getRegisteredUser(readTokens(c)?.user_id ?? "");
  if (!user) {
    return c.json({ error: "User not found" }, 400);
  }

  const playlists = await getUserPlaylists(date, "", "", "", 50, 0);
  return c.json({ playlists });
});

app.get("/api/history", async (c) => {
  const user = await getRegisteredUser(readTokens(c)?.user_id ?? "");
  if (!user) {
    return c.json({ error: "User not found" }, 400);
  }
  const history = await getUserPlayHistory(user.id);
  return c.json(history);
});

export default app;
