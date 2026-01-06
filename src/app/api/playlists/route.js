import sql from "@/app/api/utils/sql";

// GET /api/playlists - Get generated playlists with history
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateISO = searchParams.get('date_iso');
    const blockName = searchParams.get('block_name');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let query = `
      SELECT 
        gi.date_iso,
        pb.name as block_name,
        pb.id as block_id,
        pb.target_min,
        pb.color,
        COUNT(gi.id) as track_count,
        SUM(t.duration_sec) as total_duration_sec,
        MIN(gi.generated_at) as generated_at,
        json_agg(
          json_build_object(
            'position', gi.position,
            'track_id', t.id,
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
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (dateISO) {
      paramCount++;
      query += ` AND gi.date_iso = $${paramCount}`;
      params.push(dateISO);
    }

    if (blockName) {
      paramCount++;
      query += ` AND pb.name = $${paramCount}`;
      params.push(blockName);
    }

    if (startDate) {
      paramCount++;
      query += ` AND gi.date_iso >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND gi.date_iso <= $${paramCount}`;
      params.push(endDate);
    }

    query += `
      GROUP BY gi.date_iso, pb.id, pb.name, pb.target_min, pb.color
      ORDER BY gi.date_iso DESC, pb.id
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);
    const playlists = await sql(query, params);

    return Response.json({ playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return Response.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}