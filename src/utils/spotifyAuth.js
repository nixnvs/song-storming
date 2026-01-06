// Spotify OAuth PKCE utilities for client-side auth flow

// Generate random string for PKCE
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// Create SHA256 hash and base64url encode
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(str) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate PKCE challenge
export async function generatePKCEChallenge() {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlEncode(hashed);
  
  return {
    codeVerifier,
    codeChallenge
  };
}

// Build Spotify authorization URL
export async function buildSpotifyAuthUrl() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;
  
  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID environment variable is required');
  }

  const { codeVerifier, codeChallenge } = await generatePKCEChallenge();
  
  // Store code verifier for callback
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);
  sessionStorage.setItem('spotify_redirect_uri', redirectUri);
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'playlist-modify-private playlist-read-private',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    show_dialog: 'true'
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Check if user is authenticated with Spotify
export async function checkSpotifyAuth() {
  try {
    const response = await fetch('/api/auth/spotify/status');
    const data = await response.json();
    return data.authenticated || false;
  } catch (error) {
    console.error('Error checking Spotify auth:', error);
    return false;
  }
}

// Ensure Spotify auth (redirect if not authenticated)
export async function ensureSpotifyAuth() {
  const isAuthenticated = await checkSpotifyAuth();
  
  if (!isAuthenticated) {
    const authUrl = await buildSpotifyAuthUrl();
    window.location.href = authUrl;
    return false;
  }
  
  return true;
}

// Create daily block playlist with Spotify integration
export async function createDailyBlockPlaylist(dateISO, blockName, uris) {
  try {
    // Ensure authentication first
    const isAuth = await ensureSpotifyAuth();
    if (!isAuth) {
      throw new Error('Spotify authentication required');
    }

    const response = await fetch('/api/auth/spotify/playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateISO,
        blockName,
        uris
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create playlist');
    }

    const result = await response.json();
    return {
      success: true,
      playlistUrl: result.playlist_url,
      playlistId: result.playlist_id,
      tracksAdded: result.tracks_added,
      name: result.name
    };

  } catch (error) {
    console.error('Error creating daily block playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}