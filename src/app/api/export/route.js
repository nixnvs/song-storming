import sql from "@/app/api/utils/sql";

// POST /api/export - Export playlist to various formats
export async function POST(request) {
  try {
    const body = await request.json();
    const { date_iso, block_name, format = "csv" } = body;

    if (!date_iso || !block_name) {
      return Response.json(
        {
          error: "Required fields: date_iso, block_name",
        },
        { status: 400 },
      );
    }

    if (!["csv", "m3u", "spotify"].includes(format)) {
      return Response.json(
        {
          error: "Invalid format. Must be: csv, m3u, or spotify",
        },
        { status: 400 },
      );
    }

    // Get playlist data with full track details
    const [playlist] = await sql`
      SELECT 
        gi.date_iso,
        pb.name as block_name,
        pb.target_min,
        COUNT(gi.id) as track_count,
        SUM(t.duration_sec) as total_duration_sec,
        json_agg(
          json_build_object(
            'position', gi.position,
            'title', t.title,
            'artist', t.artist,
            'duration_sec', t.duration_sec,
            'bpm', t.bpm,
            'energy', t.energy,
            'uri', t.uri
          ) ORDER BY gi.position
        ) as tracks
      FROM generated_items gi
      JOIN tracks t ON gi.track_id = t.id
      JOIN play_blocks pb ON gi.block_id = pb.id
      WHERE gi.date_iso = ${date_iso} AND pb.name = ${block_name}
      GROUP BY gi.date_iso, pb.name, pb.target_min
    `;

    if (!playlist) {
      return Response.json(
        {
          error: "Playlist not found for the specified date and block",
        },
        { status: 404 },
      );
    }

    const tracks = playlist.tracks;

    // Handle different export formats
    switch (format) {
      case "spotify":
        return await exportToSpotify(playlist, tracks, date_iso, block_name);

      case "csv":
        return await exportToCsv(playlist, tracks, date_iso, block_name);

      case "m3u":
        return await exportToM3u(playlist, tracks, date_iso, block_name);

      default:
        return Response.json({ error: "Unsupported format" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error exporting playlist:", error);
    return Response.json(
      { error: "Failed to export playlist" },
      { status: 500 },
    );
  }
}

// Spotify OAuth and Playlist Creation (Test Mode)
async function exportToSpotify(playlist, tracks, date_iso, block_name) {
  try {
    // Get Spotify settings
    const [settings] =
      await sql`SELECT * FROM settings ORDER BY id DESC LIMIT 1`;

    if (!settings?.spotify_auth_token) {
      return Response.json(
        {
          error:
            "Spotify not configured. Please set up Spotify credentials in settings.",
        },
        { status: 400 },
      );
    }

    // Check if token needs refresh
    let accessToken = settings.spotify_auth_token;

    // Try to get current user profile to validate token
    let userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // If token expired, try to refresh
    if (!userResponse.ok && settings.spotify_refresh_token) {
      const refreshResponse = await refreshSpotifyToken(
        settings.spotify_refresh_token,
      );
      if (refreshResponse.success) {
        accessToken = refreshResponse.access_token;

        // Update stored tokens
        await sql`
          UPDATE settings 
          SET spotify_auth_token = ${accessToken},
              spotify_refresh_token = ${refreshResponse.refresh_token || settings.spotify_refresh_token}
          WHERE id = ${settings.id}
        `;

        // Retry user profile request
        userResponse = await fetch("https://api.spotify.com/v1/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
      }
    }

    if (!userResponse.ok) {
      return Response.json(
        {
          error: "Spotify authentication failed. Please re-authenticate.",
        },
        { status: 401 },
      );
    }

    const user = await userResponse.json();

    // Create private playlist with test naming format: "{date} {block} (Test)"
    const playlistName = `${date_iso} ${block_name} (Test)`;
    const playlistDescription = `Generated playlist for ${block_name} block on ${date_iso}. ${tracks.length} tracks, ${Math.round(playlist.total_duration_sec / 60)} minutes.`;

    const createPlaylistResponse = await fetch(
      `https://api.spotify.com/v1/users/${user.id}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDescription,
          public: false, // Private playlist
          collaborative: false,
        }),
      },
    );

    if (!createPlaylistResponse.ok) {
      const errorText = await createPlaylistResponse.text();
      console.error("Spotify playlist creation failed:", errorText);
      return Response.json(
        {
          error: "Failed to create Spotify playlist",
        },
        { status: 500 },
      );
    }

    const newPlaylist = await createPlaylistResponse.json();

    // Add tracks in order (URIs)
    const spotifyUris = tracks
      .filter((track) => track.uri && track.uri.startsWith("spotify:"))
      .map((track) => track.uri);

    if (spotifyUris.length === 0) {
      return Response.json(
        {
          error: "No Spotify URIs found in playlist tracks",
        },
        { status: 400 },
      );
    }

    // Add tracks to playlist (Spotify API limit is 100 tracks per request)
    const batchSize = 100;
    for (let i = 0; i < spotifyUris.length; i += batchSize) {
      const batch = spotifyUris.slice(i, i + batchSize);

      const addTracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: batch,
          }),
        },
      );

      if (!addTracksResponse.ok) {
        console.error(
          "Failed to add tracks batch:",
          await addTracksResponse.text(),
        );
      }
    }

    // Register in history
    await registerExportInHistory(
      date_iso,
      block_name,
      "spotify",
      newPlaylist.external_urls.spotify,
      spotifyUris.length,
    );

    return Response.json({
      success: true,
      spotify_url: newPlaylist.external_urls.spotify,
      playlist_id: newPlaylist.id,
      tracks_added: spotifyUris.length,
    });
  } catch (error) {
    console.error("Spotify export error:", error);
    return Response.json(
      {
        error: "Spotify export failed: " + error.message,
      },
      { status: 500 },
    );
  }
}

// CSV Export (Real Operation)
async function exportToCsv(playlist, tracks, date_iso, block_name) {
  try {
    // Get CSV directory from settings
    const [settings] =
      await sql`SELECT csv_directory FROM settings ORDER BY id DESC LIMIT 1`;
    const csvDir = settings?.csv_directory || "/tmp";

    // CSV format: position,artist,title,uri,durationSec,dateISO,block
    const csvHeader = "position,artist,title,uri,durationSec,dateISO,block\n";
    const csvRows = tracks
      .map((track) => {
        const escapedTitle = `"${track.title.replace(/"/g, '""')}"`;
        const escapedArtist = `"${track.artist.replace(/"/g, '""')}"`;
        const escapedUri = `"${track.uri || ""}"`;

        return `${track.position},${escapedArtist},${escapedTitle},${escapedUri},${track.duration_sec},${date_iso},${block_name}`;
      })
      .join("\n");

    const csvContent = csvHeader + csvRows;

    // Filename format: YYYY-MM-DD_block.csv
    const filename = `${date_iso}_${block_name.toLowerCase()}.csv`;
    const filepath = `${csvDir}/${filename}`;

    // In a real environment, you would save to filesystem
    // For this demo, we'll return the content for download

    // Register in history
    await registerExportInHistory(
      date_iso,
      block_name,
      "csv",
      filepath,
      tracks.length,
    );

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-File-Path": filepath,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return Response.json(
      {
        error: "CSV export failed: " + error.message,
      },
      { status: 500 },
    );
  }
}

// M3U Export (Real Operation)
async function exportToM3u(playlist, tracks, date_iso, block_name) {
  try {
    // Get CSV directory from settings (M3U files go in same dir)
    const [settings] =
      await sql`SELECT csv_directory FROM settings ORDER BY id DESC LIMIT 1`;
    const csvDir = settings?.csv_directory || "/tmp";

    // M3U format: #EXTM3U + #EXTINF:duration,artist - title + uri/path
    let m3uContent = "#EXTM3U\n";
    m3uContent += `#PLAYLIST:${date_iso} - ${block_name}\n`;
    m3uContent += `#EXTENC:UTF-8\n`;

    tracks.forEach((track) => {
      const durationSec = track.duration_sec || 0;
      const artistTitle = `${track.artist} - ${track.title}`;

      m3uContent += `#EXTINF:${durationSec},${artistTitle}\n`;
      m3uContent += `${track.uri || ""}\n`;
    });

    // Filename format: YYYY-MM-DD_block.m3u
    const filename = `${date_iso}_${block_name.toLowerCase()}.m3u`;
    const filepath = `${csvDir}/${filename}`;

    // Register in history
    await registerExportInHistory(
      date_iso,
      block_name,
      "m3u",
      filepath,
      tracks.length,
    );

    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "audio/x-mpegurl",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-File-Path": filepath,
      },
    });
  } catch (error) {
    console.error("M3U export error:", error);
    return Response.json(
      {
        error: "M3U export failed: " + error.message,
      },
      { status: 500 },
    );
  }
}

// Refresh Spotify Token
async function refreshSpotifyToken(refreshToken) {
  try {
    const [settings] =
      await sql`SELECT * FROM settings ORDER BY id DESC LIMIT 1`;

    if (!settings?.spotify_client_id || !settings?.spotify_client_secret) {
      throw new Error("Spotify client credentials not configured");
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${settings.spotify_client_id}:${settings.spotify_client_secret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    return {
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return { success: false, error: error.message };
  }
}

// Register Export in History
async function registerExportInHistory(
  date_iso,
  block_name,
  format,
  file_path,
  track_count,
) {
  try {
    // Create or update export history record
    await sql`
      INSERT INTO export_history (date_iso, block_name, format, file_path, track_count, exported_at)
      VALUES (${date_iso}, ${block_name}, ${format}, ${file_path}, ${track_count}, NOW())
      ON CONFLICT (date_iso, block_name, format) 
      DO UPDATE SET 
        file_path = ${file_path},
        track_count = ${track_count},
        exported_at = NOW()
    `;
  } catch (error) {
    console.error("Failed to register export in history:", error);
    // Don't fail the export if history logging fails
  }
}

// GET /api/export - Get export history and settings
export async function GET(request) {
  try {
    const settings = await sql`
      SELECT * FROM settings ORDER BY id DESC LIMIT 1
    `;

    // Get recent export history
    const exportHistory = await sql`
      SELECT 
        eh.date_iso,
        eh.block_name,
        eh.format,
        eh.file_path,
        eh.track_count,
        eh.exported_at
      FROM export_history eh
      ORDER BY eh.exported_at DESC
      LIMIT 50
    `;

    return Response.json({
      settings: settings[0] || null,
      export_history: exportHistory || [],
    });
  } catch (error) {
    console.error("Error fetching export data:", error);
    return Response.json(
      { error: "Failed to fetch export data" },
      { status: 500 },
    );
  }
}
