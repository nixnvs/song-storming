import sql from "@/app/api/utils/sql";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/spotify/callback';

// GET /api/auth/spotify - Start Spotify OAuth flow
export async function GET(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'login') {
    // Generate OAuth URL
    const scopes = [
      'playlist-modify-private',
      'playlist-modify-public', 
      'user-read-private'
    ].join(' ');
    
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);
    
    return Response.redirect(authUrl.toString());
  }
  
  return Response.json({ error: 'Invalid action' }, { status: 400 });
}

// POST /api/auth/spotify - Handle OAuth callback
export async function POST(request) {
  try {
    const body = await request.json();
    const { code, state } = body;
    
    if (!code) {
      return Response.json({ error: 'Authorization code required' }, { status: 400 });
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Spotify token exchange failed:', errorText);
      return Response.json({ error: 'Failed to exchange authorization code' }, { status: 400 });
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user profile
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userResponse.ok) {
      return Response.json({ error: 'Failed to get user profile' }, { status: 400 });
    }
    
    const user = await userResponse.json();
    
    // Store tokens in settings
    await sql`
      INSERT INTO settings (
        spotify_auth_token, 
        spotify_refresh_token,
        spotify_client_id,
        spotify_client_secret,
        updated_at
      )
      VALUES (
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${SPOTIFY_CLIENT_ID},
        ${SPOTIFY_CLIENT_SECRET},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        spotify_auth_token = ${tokens.access_token},
        spotify_refresh_token = ${tokens.refresh_token},
        spotify_client_id = ${SPOTIFY_CLIENT_ID},
        spotify_client_secret = ${SPOTIFY_CLIENT_SECRET},
        updated_at = NOW()
    `;
    
    return Response.json({ 
      success: true,
      user: {
        id: user.id,
        display_name: user.display_name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Spotify OAuth error:', error);
    return Response.json({ error: 'OAuth failed' }, { status: 500 });
  }
}