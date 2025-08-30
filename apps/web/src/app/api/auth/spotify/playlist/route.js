import sql from "@/app/api/utils/sql";

// POST /api/auth/spotify/playlist - Create and populate Spotify playlist
export async function POST(request) {
  try {
    const body = await request.json();
    const { dateISO, blockName, uris } = body;

    if (!dateISO || !blockName || !Array.isArray(uris)) {
      return Response.json(
        { error: 'Missing required parameters: dateISO, blockName, uris' },
        { status: 400 }
      );
    }

    // Get Spotify access token
    const accessToken = await getValidSpotifyToken();
    if (!accessToken) {
      return Response.json(
        { error: 'Spotify authentication required' },
        { status: 401 }
      );
    }

    // Get current user
    const user = await getSpotifyUser(accessToken);
    if (!user) {
      return Response.json(
        { error: 'Failed to get Spotify user information' },
        { status: 400 }
      );
    }

    // Create playlist
    const playlist = await createSpotifyPlaylist(accessToken, user.id, dateISO, blockName, uris.length);
    if (!playlist) {
      return Response.json(
        { error: 'Failed to create Spotify playlist' },
        { status: 500 }
      );
    }

    // Add tracks to playlist in chunks
    const tracksAdded = await addTracksToPlaylist(accessToken, playlist.id, uris);
    
    // Calculate total duration for response
    const totalDurationSec = await calculatePlaylistDuration(dateISO, blockName);

    return Response.json({
      success: true,
      playlist_url: playlist.external_urls.spotify,
      playlist_id: playlist.id,
      name: playlist.name,
      tracks_added: tracksAdded,
      total_duration_min: Math.round(totalDurationSec / 60),
      user: user.display_name
    });

  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return Response.json(
      { error: `Failed to create playlist: ${error.message}` },
      { status: 500 }
    );
  }
}

// Get valid Spotify access token (refresh if needed)
async function getValidSpotifyToken() {
  try {
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
      return null;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = settings.spotify_expires_at ? new Date(settings.spotify_expires_at) : null;
    
    if (expiresAt && now >= expiresAt) {
      // Try to refresh token
      const refreshResult = await refreshSpotifyToken(settings.spotify_refresh_token, settings.spotify_client_id);
      return refreshResult.success ? refreshResult.access_token : null;
    }

    return settings.spotify_auth_token;

  } catch (error) {
    console.error('Error getting valid Spotify token:', error);
    return null;
  }
}

// Get Spotify user information
async function getSpotifyUser(accessToken) {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify user API failed: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error getting Spotify user:', error);
    return null;
  }
}

// Create Spotify playlist
async function createSpotifyPlaylist(accessToken, userId, dateISO, blockName, trackCount) {
  try {
    const playlistName = `${dateISO} ${blockName}`;
    const description = `Generated playlist for ${blockName} block on ${dateISO}. ${trackCount} tracks.`;

    const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: description,
        public: false,
        collaborative: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create playlist failed: ${response.status} ${errorText}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return null;
  }
}

// Add tracks to playlist in chunks with rate limiting
async function addTracksToPlaylist(accessToken, playlistId, uris) {
  try {
    let tracksAdded = 0;
    const chunkSize = 100; // Spotify API limit
    
    // Filter out empty/invalid URIs
    const validUris = uris.filter(uri => uri && uri.startsWith('spotify:'));
    
    if (validUris.length === 0) {
      throw new Error('No valid Spotify URIs provided');
    }

    // Process in chunks
    for (let i = 0; i < validUris.length; i += chunkSize) {
      const chunk = validUris.slice(i, i + chunkSize);
      
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              uris: chunk
            })
          });

          if (response.status === 429) {
            // Rate limited - wait for Retry-After header
            const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
            console.log(`Rate limited, waiting ${retryAfter} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            retryCount++;
            continue;
          }

          if (response.status === 401) {
            // Token expired - refresh and retry once
            if (retryCount === 0) {
              const newToken = await getValidSpotifyToken();
              if (newToken) {
                accessToken = newToken;
                retryCount++;
                continue;
              }
            }
            throw new Error('Spotify authentication failed');
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Add tracks failed: ${response.status} ${errorText}`);
          }

          tracksAdded += chunk.length;
          break; // Success, exit retry loop
          
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    return tracksAdded;

  } catch (error) {
    console.error('Error adding tracks to playlist:', error);
    throw error;
  }
}

// Calculate total duration of playlist from database
async function calculatePlaylistDuration(dateISO, blockName) {
  try {
    const [result] = await sql`
      SELECT SUM(t.duration_sec) as total_duration
      FROM generated_items gi
      JOIN tracks t ON gi.track_id = t.id  
      JOIN play_blocks pb ON gi.block_id = pb.id
      WHERE gi.date_iso = ${dateISO} AND pb.name = ${blockName}
    `;

    return parseInt(result?.total_duration || 0);

  } catch (error) {
    console.error('Error calculating playlist duration:', error);
    return 0;
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