import sql from "@/app/api/utils/sql";

// GET /api/tracks/[id] - Get single track
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const tracks = await sql`
      SELECT * FROM tracks WHERE id = ${id}
    `;

    if (tracks.length === 0) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }

    return Response.json({ track: tracks[0] });
  } catch (error) {
    console.error('Error fetching track:', error);
    return Response.json({ error: 'Failed to fetch track' }, { status: 500 });
  }
}

// PUT /api/tracks/[id] - Update track
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    const allowedFields = ['title', 'artist', 'uri', 'duration_sec', 'bpm', 'energy', 'instrumental', 'explicit', 'source'];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        updateValues.push(body[field]);
      }
    }

    if (updateFields.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    paramCount++;
    updateValues.push(id);

    const query = `
      UPDATE tracks 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;

    const tracks = await sql(query, updateValues);

    if (tracks.length === 0) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }

    return Response.json({ track: tracks[0] });
  } catch (error) {
    console.error('Error updating track:', error);
    if (error.code === '23505') { // Unique constraint violation
      return Response.json({ error: 'Track with this URI already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to update track' }, { status: 500 });
  }
}

// DELETE /api/tracks/[id] - Delete track
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    const tracks = await sql`
      DELETE FROM tracks WHERE id = ${id} RETURNING *
    `;

    if (tracks.length === 0) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }

    return Response.json({ message: 'Track deleted successfully' });
  } catch (error) {
    console.error('Error deleting track:', error);
    return Response.json({ error: 'Failed to delete track' }, { status: 500 });
  }
}