import sql from "@/app/api/utils/sql";

// GET /api/tracks - List tracks with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const artist = searchParams.get('artist');
    const source = searchParams.get('source');
    const bpmMin = searchParams.get('bpmMin');
    const bpmMax = searchParams.get('bpmMax');
    const energyMin = searchParams.get('energyMin');
    const energyMax = searchParams.get('energyMax');
    const instrumental = searchParams.get('instrumental');
    const explicit = searchParams.get('explicit');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let query = 'SELECT * FROM tracks WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (artist) {
      paramCount++;
      query += ` AND LOWER(artist) LIKE LOWER($${paramCount})`;
      params.push(`%${artist}%`);
    }

    if (source) {
      paramCount++;
      query += ` AND source = $${paramCount}`;
      params.push(source);
    }

    if (bpmMin) {
      paramCount++;
      query += ` AND bpm >= $${paramCount}`;
      params.push(parseInt(bpmMin));
    }

    if (bpmMax) {
      paramCount++;
      query += ` AND bpm <= $${paramCount}`;
      params.push(parseInt(bpmMax));
    }

    if (energyMin) {
      paramCount++;
      query += ` AND energy >= $${paramCount}`;
      params.push(parseFloat(energyMin));
    }

    if (energyMax) {
      paramCount++;
      query += ` AND energy <= $${paramCount}`;
      params.push(parseFloat(energyMax));
    }

    if (instrumental !== null && instrumental !== undefined) {
      paramCount++;
      query += ` AND instrumental = $${paramCount}`;
      params.push(instrumental === 'true');
    }

    if (explicit !== null && explicit !== undefined) {
      paramCount++;
      query += ` AND explicit = $${paramCount}`;
      params.push(explicit === 'true');
    }

    query += ` ORDER BY added_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const tracks = await sql(query, params);

    return Response.json({ tracks });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return Response.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}

// POST /api/tracks - Create new track
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      title, 
      artist, 
      uri, 
      duration_sec, 
      bpm, 
      energy, 
      instrumental = false, 
      explicit = false, 
      source 
    } = body;

    if (!title || !artist || !uri || !duration_sec || !source) {
      return Response.json({ 
        error: 'Required fields: title, artist, uri, duration_sec, source' 
      }, { status: 400 });
    }

    const track = await sql`
      INSERT INTO tracks (title, artist, uri, duration_sec, bpm, energy, instrumental, explicit, source)
      VALUES (${title}, ${artist}, ${uri}, ${duration_sec}, ${bpm}, ${energy}, ${instrumental}, ${explicit}, ${source})
      RETURNING *
    `;

    return Response.json({ track: track[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating track:', error);
    if (error.code === '23505') { // Unique constraint violation
      return Response.json({ error: 'Track with this URI already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create track' }, { status: 500 });
  }
}