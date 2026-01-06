import sql from "@/app/api/utils/sql";

// POST /api/catalog/import - Import tracks from various sources
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, value, tracks } = body;

    if (!type || !value) {
      return Response.json({ 
        error: 'Required fields: type, value' 
      }, { status: 400 });
    }

    if (!['artist', 'playlist_url', 'csv'].includes(type)) {
      return Response.json({ 
        error: 'Invalid type. Must be: artist, playlist_url, or csv' 
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
          const { title, artist, uri, duration_sec, bpm, energy, instrumental, explicit } = track;
          
          if (!title || !artist || !uri || !duration_sec) {
            console.warn('Skipping invalid track:', track);
            continue;
          }

          try {
            const [newTrack] = await sql`
              INSERT INTO tracks (title, artist, uri, duration_sec, bmp, energy, instrumental, explicit, source)
              VALUES (${title}, ${artist}, ${uri}, ${duration_sec}, ${bpm || null}, ${energy || null}, ${instrumental || false}, ${explicit || false}, ${type})
              RETURNING *
            `;
            importedTracks.push(newTrack);
            tracksImported++;
          } catch (trackError) {
            if (trackError.code === '23505') {
              console.warn('Track already exists:', uri);
            } else {
              console.error('Error importing track:', trackError);
            }
          }
        }
      } else if (type === 'artist') {
        // TODO: Implement artist-based import (would need music API integration)
        throw new Error('Artist import not yet implemented - requires music service API');
      } else if (type === 'playlist_url') {
        // TODO: Implement playlist URL import (would need Spotify/Apple Music API)
        throw new Error('Playlist URL import not yet implemented - requires music service API');
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