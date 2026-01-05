import sql from "@/app/api/utils/sql";

// Core playlist generation engine
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      date_iso,
      block_name,
      force = false,
      admin_override = false,
    } = body;

    if (!date_iso || !block_name) {
      return Response.json(
        {
          error: "Required fields: date_iso, block_name",
        },
        { status: 400 },
      );
    }

    const result = await generateBlock(date_iso, block_name, {
      force,
      admin_override,
    });
    return Response.json(result, { status: result.error ? 400 : 201 });
  } catch (error) {
    console.error("Error generating playlist:", error);
    return Response.json(
      { error: "Failed to generate playlist" },
      { status: 500 },
    );
  }
}

// Main algorithm: generateBlock(dateISO, blockId)
export async function generateBlock(dateISO, blockName, options = {}) {
  const { force = false, admin_override = false } = options;

  try {
    // 1) Load catalog + rules + block config
    const [block] = await sql`
      SELECT * FROM play_blocks WHERE name = ${blockName}
    `;

    if (!block) {
      return { error: "Invalid block name" };
    }

    const [rules] = await sql`
      SELECT * FROM rotation_rules ORDER BY id DESC LIMIT 1
    `;

    if (!rules) {
      return { error: "No rotation rules configured" };
    }

    // Check if playlist already exists (unless force regeneration)
    if (!force) {
      const existing = await sql`
        SELECT COUNT(*) as count FROM generated_items 
        WHERE date_iso = ${dateISO} AND block_id = ${block.id}
      `;

      if (existing[0].count > 0) {
        return {
          error:
            "Playlist already exists for this date/block. Use force=true to regenerate.",
        };
      }
    }

    // Clear existing playlist if force regeneration
    if (force) {
      await sql`
        DELETE FROM generated_items 
        WHERE date_iso = ${dateISO} AND block_id = ${block.id}
      `;
    }

    // 2) Filter and 3) Restrict: Get candidate tracks with scoring
    const cooldownDate = new Date(dateISO);
    cooldownDate.setDate(cooldownDate.getDate() - rules.track_cooldown_days);
    const cooldownDateISO = cooldownDate.toISOString().split("T")[0];

    const candidateTracks = await sql`
      SELECT t.*, 
             COALESCE(last_played.date_iso, '1900-01-01') as last_played_date,
             COALESCE(artist_usage.usage_count, 0) as recent_artist_usage
      FROM tracks t
      LEFT JOIN (
        SELECT track_id, MAX(date_iso) as date_iso
        FROM generated_items 
        WHERE date_iso > ${cooldownDateISO}
        GROUP BY track_id
      ) last_played ON t.id = last_played.track_id
      LEFT JOIN (
        SELECT artist, COUNT(*) as usage_count
        FROM generated_items 
        WHERE date_iso > ${cooldownDateISO}
        GROUP BY artist
      ) artist_usage ON t.artist = artist_usage.artist
      WHERE (NOT ${rules.exclude_explicit} OR t.explicit = false)
        AND (NOT ${block.prefer_instrumental} OR t.instrumental = true OR t.instrumental IS NULL)
        AND (${admin_override} OR last_played.date_iso IS NULL OR last_played.date_iso <= ${cooldownDateISO})
    `;

    if (candidateTracks.length === 0) {
      return {
        error: "No tracks available that match the criteria and cooldown rules",
        stats: { total_tracks: 0, discarded_by_cooldown: 0 },
      };
    }

    // Calculate average loudness from candidate tracks (for normalization)
    const tracksWithLoudness = candidateTracks.filter(t => t.loudness != null);
    const avgLoudness = tracksWithLoudness.length > 0
      ? tracksWithLoudness.reduce((sum, t) => sum + t.loudness, 0) / tracksWithLoudness.length
      : -12.0; // Default target loudness if no data

    // 4) Scoring: Calculate scores for each track
    const scoredTracks = candidateTracks.map((track) => {
      let score = 0;

      // Base score for BPM/energy range match
      if (
        track.bpm &&
        track.bpm >= block.bmp_min &&
        track.bpm <= block.bmp_max
      ) {
        score += 50; // Perfect BPM match
      } else if (track.bpm) {
        score += 20; // Has BPM but outside range (penalized)
      } else {
        score += 30; // No BPM data (neutral)
      }

      if (
        track.energy &&
        track.energy >= block.energy_min &&
        track.energy <= block.energy_max
      ) {
        score += 50; // Perfect energy match
      } else if (track.energy) {
        score += 20; // Has energy but outside range (penalized)
      } else {
        score += 30; // No energy data (neutral)
      }

      // Loudness normalization bonus (if enabled and loudness data available)
      if (rules.normalize_loudness && track.loudness != null) {
        const loudnessDiff = Math.abs(track.loudness - avgLoudness);
        // Prefer tracks with loudness close to average (within 2dB = good, within 4dB = ok)
        if (loudnessDiff <= 2.0) {
          score += 30; // Very close to average loudness
        } else if (loudnessDiff <= 4.0) {
          score += 15; // Acceptable loudness difference
        } else {
          score -= 10; // Penalize tracks with very different loudness
        }
      }

      // Bonus for recently unused artists (inverse of usage count)
      const artistBonus = Math.max(0, 20 - track.recent_artist_usage * 2);
      score += artistBonus;

      // Small randomization to avoid deterministic results
      score += Math.random() * 10;

      return { ...track, score };
    });

    // Sort by score descending
    scoredTracks.sort((a, b) => b.score - a.score);

    // 5) Selection: Fill to targetMin respecting artist separation
    const selectedTracks = await selectTracksWithArtistSeparation(
      scoredTracks,
      block,
      rules,
      dateISO,
    );

    if (selectedTracks.length === 0) {
      return {
        error:
          "Could not select any tracks with artist separation requirements",
        stats: {
          candidates: candidateTracks.length,
          discarded_by_cooldown: 0, // Calculate actual number
        },
      };
    }

    // 6) Order: buildEnergyCurve
    const orderedTracks = buildEnergyCurve(selectedTracks);

    // 7) Persist GeneratedItem and playlist final
    const generatedItems = [];
    for (let i = 0; i < orderedTracks.length; i++) {
      const track = orderedTracks[i];
      const [item] = await sql`
        INSERT INTO generated_items (track_id, artist, date_iso, block_id, position)
        VALUES (${track.id}, ${track.artist}, ${dateISO}, ${block.id}, ${i + 1})
        RETURNING *
      `;
      generatedItems.push({
        ...item,
        track: track,
      });
    }

    // 8) Log resumen: Calculate statistics
    const totalDuration = orderedTracks.reduce(
      (sum, t) => sum + t.duration_sec,
      0,
    );
    const avgBPM = orderedTracks
      .filter((t) => t.bpm)
      .reduce((sum, t, _, arr) => sum + t.bpm / arr.length, 0);
    const avgEnergy = orderedTracks
      .filter((t) => t.energy)
      .reduce((sum, t, _, arr) => sum + t.energy / arr.length, 0);

    const stats = {
      target_duration_min: block.target_min,
      actual_duration_sec: totalDuration,
      actual_duration_min: Math.round((totalDuration / 60) * 10) / 10,
      track_count: orderedTracks.length,
      avg_bpm: Math.round(avgBPM),
      avg_energy: Math.round(avgEnergy * 100) / 100,
      candidates_considered: candidateTracks.length,
      discarded_by_cooldown: 0, // We'd need to calculate this separately
      artist_separation_min: rules.artist_cooldown_min,
    };

    return {
      playlist: {
        date_iso: dateISO,
        block_name: blockName,
        block_id: block.id,
        tracks: generatedItems,
        stats,
      },
      success: true,
    };
  } catch (error) {
    console.error("Error in generateBlock:", error);
    return { error: "Failed to generate playlist", details: error.message };
  }
}

// 5) Selection algorithm with artist separation
async function selectTracksWithArtistSeparation(
  scoredTracks,
  block,
  rules,
  dateISO,
) {
  const selected = [];
  const used = new Set();
  const artistLastUsed = new Map();

  // Calculate target track count (approximate, based on average track length)
  const targetDurationSec = block.target_min * 60;
  let currentDurationSec = 0;

  const cooldownMs = rules.artist_cooldown_min * 60 * 1000;

  for (const track of scoredTracks) {
    if (used.has(track.id)) continue;
    if (currentDurationSec >= targetDurationSec && selected.length >= 8) break; // Minimum 8 tracks

    // Check artist separation within this block
    const lastUsed = artistLastUsed.get(track.artist);
    if (lastUsed && Date.now() - lastUsed < cooldownMs) continue;

    // Check if adding this track would exceed target by too much
    if (
      currentDurationSec > 0 &&
      currentDurationSec + track.duration_sec > targetDurationSec * 1.3
    ) {
      // Look for shorter tracks first
      continue;
    }

    used.add(track.id);
    artistLastUsed.set(track.artist, Date.now());
    selected.push(track);
    currentDurationSec += track.duration_sec;
  }

  return selected;
}

// 6) Order tracks for consistent background music (no energy variations)
// For restaurant background music, we maintain consistent energy throughout
function buildEnergyCurve(tracks) {
  if (tracks.length === 0) return tracks;

  // Calculate average energy of all tracks to maintain consistency
  const tracksWithEnergy = tracks.map((t) => ({
    ...t,
    energyScore: t.energy || 0.3, // Default energy if null
  }));

  const avgEnergy = tracksWithEnergy.reduce((sum, t) => sum + t.energyScore, 0) / tracksWithEnergy.length;

  // Sort tracks by how close they are to the average energy
  // This ensures consistent energy throughout the playlist
  const sortedByEnergyProximity = [...tracksWithEnergy].sort((a, b) => {
    const diffA = Math.abs(a.energyScore - avgEnergy);
    const diffB = Math.abs(b.energyScore - avgEnergy);
    return diffA - diffB; // Closer to average first
  });

  // Also consider loudness if available for consistent volume
  const sortedByLoudness = [...sortedByEnergyProximity].sort((a, b) => {
    if (a.loudness == null && b.loudness == null) return 0;
    if (a.loudness == null) return 1;
    if (b.loudness == null) return -1;
    return Math.abs(a.loudness) - Math.abs(b.loudness); // Prefer similar loudness
  });

  // Shuffle slightly to avoid being too predictable, but keep energy consistent
  // We'll do a gentle shuffle that maintains energy consistency
  const orderedPlaylist = [];
  const used = new Set();

  // Group tracks by energy proximity (within 0.1 of average)
  const energyGroups = {
    close: sortedByLoudness.filter(t => Math.abs(t.energyScore - avgEnergy) <= 0.1),
    medium: sortedByLoudness.filter(t => Math.abs(t.energyScore - avgEnergy) > 0.1 && Math.abs(t.energyScore - avgEnergy) <= 0.2),
    far: sortedByLoudness.filter(t => Math.abs(t.energyScore - avgEnergy) > 0.2)
  };

  // Prefer tracks close to average energy, with gentle randomization
  const pickTrack = (groups) => {
    // Try close group first (70% chance), then medium (25%), then far (5%)
    const rand = Math.random();
    let pool = [];
    
    if (rand < 0.7 && groups.close.length > 0) {
      pool = groups.close;
    } else if (rand < 0.95 && groups.medium.length > 0) {
      pool = groups.medium;
    } else {
      pool = groups.far;
    }

    const available = pool.filter((t) => !used.has(t.id));
    if (available.length === 0) {
      // Fallback to any available track
      const allAvailable = sortedByLoudness.filter((t) => !used.has(t.id));
      if (allAvailable.length === 0) return null;
      const track = allAvailable[Math.floor(Math.random() * allAvailable.length)];
      used.add(track.id);
      return track;
    }
    
    const track = available[Math.floor(Math.random() * available.length)];
    used.add(track.id);
    return track;
  };

  // Fill playlist maintaining consistent energy
  for (let i = 0; i < tracks.length; i++) {
    const track = pickTrack(energyGroups);
    if (track) {
      orderedPlaylist.push(track);
    }
  }

  // Add any remaining tracks
  const remaining = sortedByLoudness.filter((t) => !used.has(t.id));
  orderedPlaylist.push(...remaining);

  return orderedPlaylist;
}
