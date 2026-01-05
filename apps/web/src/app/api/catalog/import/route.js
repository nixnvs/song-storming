import sql from "@/app/api/utils/sql";

// Helper function to get valid Spotify token
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

// Extract playlist ID from URI or URL
function extractPlaylistId(playlistInput) {
  // Handle spotify:playlist: format
  if (playlistInput.startsWith('spotify:playlist:')) {
    return playlistInput.replace('spotify:playlist:', '');
  }
  // Handle URL format
  if (playlistInput.includes('open.spotify.com/playlist/')) {
    const match = playlistInput.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  // Assume it's already just the ID
  return playlistInput;
}

// Extract track ID from URI
function extractTrackId(trackUri) {
  if (trackUri.startsWith('spotify:track:')) {
    return trackUri.replace('spotify:track:', '');
  }
  if (trackUri.includes('open.spotify.com/track/')) {
    const match = trackUri.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  return trackUri;
}

// Fetch tracks from Spotify playlist
async function fetchPlaylistTracks(accessToken, playlistId) {
  try {
    const tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
    
    while (url) {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Spotify API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      for (const item of data.items || []) {
        if (item.track && item.track.id) {
          tracks.push({
            id: item.track.id,
            uri: item.track.uri,
            name: item.track.name,
            artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
            album: item.track.album?.name || '',
            duration_ms: item.track.duration_ms || 0,
            explicit: item.track.explicit || false
          });
        }
      }

      url = data.next; // Pagination
    }

    return tracks;
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
}

// Fetch audio features for tracks (including loudness)
async function fetchAudioFeatures(accessToken, trackIds) {
  try {
    // Spotify API allows up to 100 track IDs per request
    const features = [];
    const batchSize = 100;
    
    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batch = trackIds.slice(i, i + batchSize);
      const ids = batch.join(',');
      
      const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Spotify API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      features.push(...(data.audio_features || []));
    }

    return features;
  } catch (error) {
    console.error('Error fetching audio features:', error);
    throw error;
  }
}

// POST /api/catalog/import - Import tracks from various sources
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, value, tracks, track_uris } = body;

    if (!type || !value) {
      return Response.json({ 
        error: 'Required fields: type, value' 
      }, { status: 400 });
    }

    if (!['artist', 'playlist_url', 'csv', 'track_uris'].includes(type)) {
      return Response.json({ 
        error: 'Invalid type. Must be: artist, playlist_url, csv, or track_uris' 
      }, { status: 400 });
    }

    // Create catalog source record
    const [source] = await sql`
      INSERT INTO catalog_sources (type, value, status)
      VALUES (${type}, ${value}, 'importing')
      RETURNING *
    `;

    let importedTracks = [];
    let tracksImported = 0;

    try {
      if (tracks && Array.isArray(tracks)) {
        // Direct track data provided (e.g., from CSV parsing)
        for (const track of tracks) {
          const { title, artist, uri, duration_sec, bpm, energy, instrumental, explicit, loudness } = track;
          
          if (!title || !artist || !uri || !duration_sec) {
            console.warn('Skipping invalid track:', track);
            continue;
          }

          try {
            // Check if loudness column exists, if not we'll handle it gracefully
            const [newTrack] = await sql`
              INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source, loudness)
              VALUES (${title}, ${artist}, ${uri}, ${duration_sec}, ${bpm || null}, ${energy || null}, ${instrumental || false}, ${explicit || false}, ${type}, ${loudness || null})
              ON CONFLICT (uri) DO UPDATE SET
                title = EXCLUDED.title,
                artist = EXCLUDED.artist,
                bmp = EXCLUDED.bmp,
                energy = EXCLUDED.energy,
                loudness = EXCLUDED.loudness
              RETURNING *
            `;
            importedTracks.push(newTrack);
            tracksImported++;
          } catch (trackError) {
            // If loudness column doesn't exist, try without it
            if (trackError.message?.includes('loudness') || trackError.code === '42703') {
              try {
                const [newTrack] = await sql`
                  INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source)
                  VALUES (${title}, ${artist}, ${uri}, ${duration_sec}, ${bpm || null}, ${energy || null}, ${instrumental || false}, ${explicit || false}, ${type})
                  ON CONFLICT (uri) DO UPDATE SET
                    title = EXCLUDED.title,
                    artist = EXCLUDED.artist,
                    bmp = EXCLUDED.bmp,
                    energy = EXCLUDED.energy
                  RETURNING *
                `;
                importedTracks.push(newTrack);
                tracksImported++;
              } catch (retryError) {
                if (retryError.code === '23505') {
                  console.warn('Track already exists:', uri);
                } else {
                  console.error('Error importing track:', retryError);
                }
              }
            } else if (trackError.code === '23505') {
              console.warn('Track already exists:', uri);
            } else {
              console.error('Error importing track:', trackError);
            }
          }
        }
      } else if (type === 'track_uris' && track_uris && Array.isArray(track_uris)) {
        // Import from array of track URIs
        const accessToken = await getValidSpotifyToken();
        if (!accessToken) {
          throw new Error('Spotify authentication required. Please authenticate first.');
        }

        const trackIds = track_uris.map(extractTrackId).filter(Boolean);
        if (trackIds.length === 0) {
          throw new Error('No valid track IDs found');
        }

        // Fetch track details
        const batchSize = 50; // Spotify API limit for tracks endpoint
        const allTracks = [];
        
        for (let i = 0; i < trackIds.length; i += batchSize) {
          const batch = trackIds.slice(i, i + batchSize);
          const ids = batch.join(',');
          
          const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${ids}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Spotify API error: ${errorData.error?.message || response.statusText}`);
          }

          const data = await response.json();
          for (const track of data.tracks || []) {
            if (track) {
              allTracks.push({
                id: track.id,
                uri: track.uri,
                name: track.name,
                artist: track.artists?.map(a => a.name).join(', ') || 'Unknown',
                album: track.album?.name || '',
                duration_ms: track.duration_ms || 0,
                explicit: track.explicit || false
              });
            }
          }
        }

        // Fetch audio features (including loudness)
        const trackIdsForFeatures = allTracks.map(t => t.id);
        const audioFeatures = await fetchAudioFeatures(accessToken, trackIdsForFeatures);
        const featuresMap = new Map();
        audioFeatures.forEach(f => {
          if (f) featuresMap.set(f.id, f);
        });

        // Import tracks with audio features
        for (const track of allTracks) {
          const features = featuresMap.get(track.id);
          const duration_sec = Math.floor(track.duration_ms / 1000);
          const bpm = features?.tempo ? Math.round(features.tempo) : null;
          const energy = features?.energy || null;
          const loudness = features?.loudness || null;
          const instrumental = features?.instrumentalness > 0.5;
          
          try {
            const [newTrack] = await sql`
              INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source, loudness)
              VALUES (${track.name}, ${track.artist}, ${track.uri}, ${duration_sec}, ${bpm}, ${energy}, ${instrumental}, ${track.explicit}, ${type}, ${loudness})
              ON CONFLICT (uri) DO UPDATE SET
                title = EXCLUDED.title,
                artist = EXCLUDED.artist,
                bmp = EXCLUDED.bmp,
                energy = EXCLUDED.energy,
                loudness = EXCLUDED.loudness
              RETURNING *
            `;
            importedTracks.push(newTrack);
            tracksImported++;
          } catch (trackError) {
            // If loudness column doesn't exist, try without it
            if (trackError.message?.includes('loudness') || trackError.code === '42703') {
              try {
                const [newTrack] = await sql`
                  INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source)
                  VALUES (${track.name}, ${track.artist}, ${track.uri}, ${duration_sec}, ${bpm}, ${energy}, ${instrumental}, ${track.explicit}, ${type})
                  ON CONFLICT (uri) DO UPDATE SET
                    title = EXCLUDED.title,
                    artist = EXCLUDED.artist,
                    bmp = EXCLUDED.bmp,
                    energy = EXCLUDED.energy
                  RETURNING *
                `;
                importedTracks.push(newTrack);
                tracksImported++;
              } catch (retryError) {
                if (retryError.code === '23505') {
                  console.warn('Track already exists:', track.uri);
                } else {
                  console.error('Error importing track:', retryError);
                }
              }
            } else if (trackError.code === '23505') {
              console.warn('Track already exists:', track.uri);
            } else {
              console.error('Error importing track:', trackError);
            }
          }
        }
      } else if (type === 'playlist_url') {
        // Import from Spotify playlist URL/URI
        const accessToken = await getValidSpotifyToken();
        if (!accessToken) {
          throw new Error('Spotify authentication required. Please authenticate first.');
        }

        const playlistId = extractPlaylistId(value);
        if (!playlistId) {
          throw new Error('Invalid playlist URI or URL');
        }

        // Fetch tracks from playlist
        const playlistTracks = await fetchPlaylistTracks(accessToken, playlistId);
        
        if (playlistTracks.length === 0) {
          throw new Error('No tracks found in playlist');
        }

        // Fetch audio features (including loudness)
        const trackIds = playlistTracks.map(t => t.id);
        const audioFeatures = await fetchAudioFeatures(accessToken, trackIds);
        const featuresMap = new Map();
        audioFeatures.forEach(f => {
          if (f) featuresMap.set(f.id, f);
        });

        // Import tracks with audio features
        for (const track of playlistTracks) {
          const features = featuresMap.get(track.id);
          const duration_sec = Math.floor(track.duration_ms / 1000);
          const bpm = features?.tempo ? Math.round(features.tempo) : null;
          const energy = features?.energy || null;
          const loudness = features?.loudness || null;
          const instrumental = features?.instrumentalness > 0.5;
          
          try {
            const [newTrack] = await sql`
              INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source, loudness)
              VALUES (${track.name}, ${track.artist}, ${track.uri}, ${duration_sec}, ${bpm}, ${energy}, ${instrumental}, ${track.explicit}, ${type}, ${loudness})
              ON CONFLICT (uri) DO UPDATE SET
                title = EXCLUDED.title,
                artist = EXCLUDED.artist,
                bmp = EXCLUDED.bmp,
                energy = EXCLUDED.energy,
                loudness = EXCLUDED.loudness
              RETURNING *
            `;
            importedTracks.push(newTrack);
            tracksImported++;
          } catch (trackError) {
            // If loudness column doesn't exist, try without it
            if (trackError.message?.includes('loudness') || trackError.code === '42703') {
              try {
                const [newTrack] = await sql`
                  INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source)
                  VALUES (${track.name}, ${track.artist}, ${track.uri}, ${duration_sec}, ${bpm}, ${energy}, ${instrumental}, ${track.explicit}, ${type})
                  ON CONFLICT (uri) DO UPDATE SET
                    title = EXCLUDED.title,
                    artist = EXCLUDED.artist,
                    bmp = EXCLUDED.bmp,
                    energy = EXCLUDED.energy
                  RETURNING *
                `;
                importedTracks.push(newTrack);
                tracksImported++;
              } catch (retryError) {
                if (retryError.code === '23505') {
                  console.warn('Track already exists:', track.uri);
                } else {
                  console.error('Error importing track:', retryError);
                }
              }
            } else if (trackError.code === '23505') {
              console.warn('Track already exists:', track.uri);
            } else {
              console.error('Error importing track:', trackError);
            }
          }
        }
      } else if (type === 'artist') {
        // TODO: Implement artist-based import (would need music API integration)
        throw new Error('Artist import not yet implemented - requires music service API');
      }

      // Update source status
      await sql`
        UPDATE catalog_sources 
        SET status = 'completed', tracks_imported = ${tracksImported}, imported_at = CURRENT_TIMESTAMP
        WHERE id = ${source.id}
      `;

      return Response.json({ 
        source,
        tracks_imported: tracksImported,
        imported_tracks: importedTracks
      }, { status: 201 });

    } catch (importError) {
      // Update source status to failed
      await sql`
        UPDATE catalog_sources 
        SET status = 'failed'
        WHERE id = ${source.id}
      `;
      
      throw importError;
    }

  } catch (error) {
    console.error('Error importing catalog:', error);
    return Response.json({ 
      error: error.message || 'Failed to import catalog' 
    }, { status: 500 });
  }
}

// GET /api/catalog/import - Get import history
export async function GET(request) {
  try {
    const sources = await sql`
      SELECT * FROM catalog_sources 
      ORDER BY created_at DESC
    `;

    return Response.json({ sources });
  } catch (error) {
    console.error('Error fetching import history:', error);
    return Response.json({ error: 'Failed to fetch import history' }, { status: 500 });
  }
}