import sql from "@/app/api/utils/sql";

// GET /api/auth/spotify/status - Check Spotify authentication status
export async function GET(request) {
  try {
    // Get current settings
    const [settings] = await sql`
      SELECT 
        spotify_auth_token,
        spotify_refresh_token,
        spotify_expires_at,
        spotify_client_id
      FROM settings 
      ORDER BY id DESC LIMIT 1
    `;

    if (!settings || !settings.spotify_auth_token) {
      return Response.json({
        authenticated: false,
        reason: 'no_token'
      });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = settings.spotify_expires_at ? new Date(settings.spotify_expires_at) : null;
    
    if (expiresAt && now >= expiresAt) {
      // Try to refresh the token
      const refreshResult = await refreshSpotifyToken(settings.spotify_refresh_token, settings.spotify_client_id);
      
      if (refreshResult.success) {
        return Response.json({
          authenticated: true,
          token_refreshed: true
        });
      } else {
        return Response.json({
          authenticated: false,
          reason: 'token_expired',
          refresh_failed: true
        });
      }
    }

    // Validate token by making a test API call
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${settings.spotify_auth_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (userResponse.ok) {
      const user = await userResponse.json();
      return Response.json({
        authenticated: true,
        user: {
          id: user.id,
          display_name: user.display_name,
          email: user.email
        }
      });
    } else if (userResponse.status === 401) {
      // Token is invalid, try to refresh
      const refreshResult = await refreshSpotifyToken(settings.spotify_refresh_token, settings.spotify_client_id);
      
      if (refreshResult.success) {
        return Response.json({
          authenticated: true,
          token_refreshed: true
        });
      } else {
        return Response.json({
          authenticated: false,
          reason: 'token_invalid',
          refresh_failed: true
        });
      }
    } else {
      return Response.json({
        authenticated: false,
        reason: 'api_error'
      });
    }

  } catch (error) {
    console.error('Error checking Spotify auth status:', error);
    return Response.json(
      { 
        authenticated: false,
        reason: 'server_error',
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}

// Helper function to refresh Spotify token
async function refreshSpotifyToken(refreshToken, clientId) {
  try {
    if (!refreshToken || !clientId) {
      return { success: false, error: 'Missing refresh token or client ID' };
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh failed:', errorData);
      return { success: false, error: errorData.error_description || errorData.error };
    }

    const tokens = await response.json();
    
    // Calculate new expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Update tokens in database
    await sql`
      UPDATE settings 
      SET spotify_auth_token = ${tokens.access_token},
          spotify_refresh_token = ${tokens.refresh_token || refreshToken},
          spotify_expires_at = ${expiresAt.toISOString()},
          updated_at = CURRENT_TIMESTAMP
      WHERE spotify_refresh_token = ${refreshToken}
    `;

    return { 
      success: true, 
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: error.message };
  }
}