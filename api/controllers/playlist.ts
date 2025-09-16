import sql from "../utils/sql";
import prisma from "../utils/prisma-client";

// Get Spotify user information
export async function getSpotifyUser(accessToken) {
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify user API failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting Spotify user:", error);
    return null;
  }
}

// Create Spotify playlist
export async function createSpotifyPlaylist(
  accessToken,
  userId,
  dateISO,
  blockName,
  trackCount
) {
  try {
    const playlistName = `${dateISO} ${blockName}`;
    const description = `Generated playlist for ${blockName} block on ${dateISO}. ${trackCount} tracks.`;

    const response = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          description: description,
          public: false,
          collaborative: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Create playlist failed: ${response.status} ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating Spotify playlist:", error);
    return null;
  }
}

// Add tracks to playlist in chunks with rate limiting
export async function addTracksToPlaylist(
  accessToken,
  playlistId,
  uris,
  getValidSpotifyToken
) {
  try {
    let tracksAdded = 0;
    const chunkSize = 100; // Spotify API limit

    // Filter out empty/invalid URIs
    const validUris = uris
      .filter((uri) => uri && uri.track.uri.startsWith("spotify:"))
      .map((uri) => uri.track.uri);

    if (validUris.length === 0) {
      throw new Error("No valid Spotify URIs provided");
    }

    // Process in chunks
    for (let i = 0; i < validUris.length; i += chunkSize) {
      const chunk = validUris.slice(i, i + chunkSize);

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const response = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uris: chunk,
              }),
            }
          );

          if (response.status === 429) {
            // Rate limited - wait for Retry-After header
            const retryAfter = parseInt(
              response.headers.get("Retry-After") || "1"
            );
            console.log(`Rate limited, waiting ${retryAfter} seconds...`);
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000)
            );
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
            throw new Error("Spotify authentication failed");
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Add tracks failed: ${response.status} ${errorText}`
            );
          }

          tracksAdded += chunk.length;
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    return tracksAdded;
  } catch (error) {
    console.error("Error adding tracks to playlist:", error);
    throw error;
  }
}

// Calculate total duration of playlist from database
export async function calculatePlaylistDuration(dateISO, blockName) {
  try {
    const [result] = await sql`
      SELECT SUM(t.duration_ms) as total_duration
      FROM generated_items gi
      JOIN tracks t ON gi.track_id = t.id  
      JOIN play_blocks pb ON gi.block_id = pb.id
      WHERE gi.date_iso = ${dateISO} AND pb.name = ${blockName}
    `;

    return parseInt(result?.total_duration || 0);
  } catch (error) {
    console.error("Error calculating playlist duration:", error);
    return 0;
  }
}

function convertBigInt(obj: any): any {
  if (typeof obj === "bigint") {
    // convert safely, fallback to string if too large
    return Number(obj) <= Number.MAX_SAFE_INTEGER
      ? Number(obj)
      : obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInt);
  }
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertBigInt(v)])
    );
  }
  return obj;
}

export async function getUserPlaylists(
  dateISO: string,
  blockName: string,
  startDate: string,
  endDate: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    let query = `
    SELECT 
      gi.date_iso,
      pb.name as block_name,
      pb.id as block_id,
      upb.playlist_url as playlist_url,
      pb.target_min,
      COUNT(gi.id) as track_count,
      SUM((t.duration_ms)::numeric / 1000) as total_duration_sec,
      MIN(gi.created_at) as generated_at,
      json_agg(
        json_build_object(
          'position', gi.position,
          'track_id', t.id,
          'title', t.name,
          'artist', t.artists,
          'duration_sec', (t.duration_ms)::numeric / 1000,
          'bpm', t.tempo,
          'playlist_url', upb.playlist_url,
          'energy', t.energy,
          'uri', t.uri
        ) ORDER BY gi.position
      ) as tracks
    FROM generated_items gi
    JOIN tracks t ON gi.track_id = t.id
    JOIN play_blocks pb ON gi.block_id = pb.id
JOIN (
  SELECT DISTINCT ON (play_block_id) *
  FROM user_play_blocks
  ORDER BY play_block_id, created_at DESC
) upb ON upb.play_block_id = pb.id    WHERE 1=1
  `;

    const params: any[] = [];
    let paramCount = 0;

    if (dateISO) {
      paramCount++;
      query += ` AND gi.date_iso = $${paramCount}`;
      params.push(new Date(dateISO));
    }

    if (blockName) {
      paramCount++;
      query += ` AND pb.name = $${paramCount}`;
      params.push(blockName);
    }

    if (startDate) {
      paramCount++;
      query += ` AND gi.date_iso >= $${paramCount}`;
      params.push(new Date(startDate));
    }

    if (endDate) {
      paramCount++;
      query += ` AND gi.date_iso <= $${paramCount}`;
      params.push(new Date(endDate));
    }

    query += `
    GROUP BY gi.date_iso, pb.id, pb.name, pb.target_min, upb.playlist_url, upb.created_at
    ORDER BY gi.date_iso DESC, pb.id, upb.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

    params.push(limit, offset);

    const playlists = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    return convertBigInt(playlists);
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return Response.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

export async function startSpotifyPlaylist(
  playlistId: string,
  accessToken: string
) {
  try {
    const deviceIds = await fetch(
      `https://api.spotify.com/v1/me/player/devices`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const activeDevices = await deviceIds.json();

    const deviceId = activeDevices?.devices?.[0]?.id || "";

    const response = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context_uri: `spotify:playlist:${playlistId}`,
        }),
      }
    );
    return response;
  } catch (error) {
    console.error("Error starting Spotify playlist:", error);
    return null;
  }
}

export async function getPlaylist(playlistId: number) {
  const playlist = await prisma.user_play_blocks.findUnique({
    where: {
      id: playlistId,
    },
  });
  return playlist;
}
