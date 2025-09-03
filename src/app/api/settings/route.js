import sql from "@/app/api/utils/sql";

// GET /api/settings - Get current settings
export async function GET(request) {
  try {
    const [settings] = await sql`
      SELECT * FROM settings ORDER BY id DESC LIMIT 1
    `;

    const [rotationRules] = await sql`
      SELECT * FROM rotation_rules ORDER BY id DESC LIMIT 1
    `;

    const playBlocks = await sql`
      SELECT * FROM play_blocks ORDER BY id
    `;

    return Response.json({ 
      settings: settings || null,
      rotation_rules: rotationRules || null,
      play_blocks: playBlocks
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update settings
export async function PUT(request) {
  try {
    const body = await request.json();
    const { 
      export_target, 
      spotify_auth_token, 
      spotify_refresh_token, 
      csv_directory, 
      service_active,
      rotation_rules,
      play_blocks
    } = body;

    // Update main settings
    if (export_target || spotify_auth_token !== undefined || spotify_refresh_token !== undefined || 
        csv_directory !== undefined || service_active !== undefined) {
      
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (export_target) {
        paramCount++;
        updateFields.push(`export_target = $${paramCount}`);
        updateValues.push(export_target);
      }

      if (spotify_auth_token !== undefined) {
        paramCount++;
        updateFields.push(`spotify_auth_token = $${paramCount}`);
        updateValues.push(spotify_auth_token);
      }

      if (spotify_refresh_token !== undefined) {
        paramCount++;
        updateFields.push(`spotify_refresh_token = $${paramCount}`);
        updateValues.push(spotify_refresh_token);
      }

      if (csv_directory !== undefined) {
        paramCount++;
        updateFields.push(`csv_directory = $${paramCount}`);
        updateValues.push(csv_directory);
      }

      if (service_active !== undefined) {
        paramCount++;
        updateFields.push(`service_active = $${paramCount}`);
        updateValues.push(service_active);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        const query = `
          UPDATE settings 
          SET ${updateFields.join(', ')}
          WHERE id = (SELECT id FROM settings ORDER BY id DESC LIMIT 1)
          RETURNING *
        `;

        await sql(query, updateValues);
      }
    }

    // Update rotation rules
    if (rotation_rules) {
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (rotation_rules.track_cooldown_days !== undefined) {
        paramCount++;
        updateFields.push(`track_cooldown_days = $${paramCount}`);
        updateValues.push(rotation_rules.track_cooldown_days);
      }

      if (rotation_rules.artist_cooldown_min !== undefined) {
        paramCount++;
        updateFields.push(`artist_cooldown_min = $${paramCount}`);
        updateValues.push(rotation_rules.artist_cooldown_min);
      }

      if (rotation_rules.exclude_explicit !== undefined) {
        paramCount++;
        updateFields.push(`exclude_explicit = $${paramCount}`);
        updateValues.push(rotation_rules.exclude_explicit);
      }

      if (rotation_rules.normalize_loudness !== undefined) {
        paramCount++;
        updateFields.push(`normalize_loudness = $${paramCount}`);
        updateValues.push(rotation_rules.normalize_loudness);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        const query = `
          UPDATE rotation_rules 
          SET ${updateFields.join(', ')}
          WHERE id = (SELECT id FROM rotation_rules ORDER BY id DESC LIMIT 1)
          RETURNING *
        `;

        await sql(query, updateValues);
      }
    }

    // Update play blocks
    if (play_blocks && Array.isArray(play_blocks)) {
      for (const block of play_blocks) {
        if (block.id) {
          const updateFields = [];
          const updateValues = [];
          let paramCount = 0;

          if (block.bpm_min !== undefined) {
            paramCount++;
            updateFields.push(`bpm_min = $${paramCount}`);
            updateValues.push(block.bpm_min);
          }

          if (block.bpm_max !== undefined) {
            paramCount++;
            updateFields.push(`bmp_max = $${paramCount}`);
            updateValues.push(block.bpm_max);
          }

          if (block.energy_min !== undefined) {
            paramCount++;
            updateFields.push(`energy_min = $${paramCount}`);
            updateValues.push(block.energy_min);
          }

          if (block.energy_max !== undefined) {
            paramCount++;
            updateFields.push(`energy_max = $${paramCount}`);
            updateValues.push(block.energy_max);
          }

          if (block.prefer_instrumental !== undefined) {
            paramCount++;
            updateFields.push(`prefer_instrumental = $${paramCount}`);
            updateValues.push(block.prefer_instrumental);
          }

          if (updateFields.length > 0) {
            paramCount++;
            updateValues.push(block.id);
            
            const query = `
              UPDATE play_blocks 
              SET ${updateFields.join(', ')}
              WHERE id = $${paramCount}
              RETURNING *
            `;

            await sql(query, updateValues);
          }
        }
      }
    }

    // Return updated settings
    const [updatedSettings] = await sql`
      SELECT * FROM settings ORDER BY id DESC LIMIT 1
    `;

    const [updatedRotationRules] = await sql`
      SELECT * FROM rotation_rules ORDER BY id DESC LIMIT 1
    `;

    const updatedPlayBlocks = await sql`
      SELECT * FROM play_blocks ORDER BY id
    `;

    return Response.json({ 
      settings: updatedSettings,
      rotation_rules: updatedRotationRules,
      play_blocks: updatedPlayBlocks
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return Response.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}