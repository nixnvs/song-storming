import prisma from "../utils/prisma-client";
import { Prisma, users } from "@prisma/client";

export async function generateBlock(
  dateISO,
  blockName: string,
  user: users,
  { admin_override = false }: any
) {
  const force = true;

  try {
    // 1) Load catalog + rules + block config
    const block = (await prisma.play_blocks.findFirst({
      where: {
        name: blockName,
      },
      include: {
        rotation_rules: {
          take: 1,
        },
      },
    })) as Prisma.play_blocksGetPayload<{
      include: {
        rotation_rules: {
          take: 1;
        };
      };
    }>;

    if (!block) {
      return { error: "Invalid block name" };
    }

    const rules = block!.rotation_rules[0];

    if (!rules) {
      return { error: "No rotation rules configured" };
    }

    // Check if playlist already exists (unless force regeneration)
    if (!force && (await prisma.generated_items.count()) > 0) {
      const existing = await prisma.generated_items.count({
        where: {
          date_iso: new Date(dateISO),
          block_id: block!.id,
        },
      });

      if (existing > 0) {
        return {
          error:
            "Playlist already exists for this date/block. Use force=true to regenerate.",
        };
      }
    }

    // Clear existing playlist if force regeneration
    if (force) {
      await prisma.generated_items.deleteMany({
        where: {
          date_iso: new Date(dateISO),
          block_id: block!.id,
        },
      });
    }

    // 2) Filter and 3) Restrict: Get candidate tracks with scoring
    const cooldownDate = new Date(dateISO);
    cooldownDate.setDate(cooldownDate.getDate() - rules.track_cooldown_days);
    const cooldownDateISO = cooldownDate.toISOString().split("T")[0];

    const candidateTracks: (Prisma.tracksGetPayload<{
      include: { generated_items: true };
    }> & {
      recent_artist_usage: number;
      last_played_date: Date;
    })[] = await prisma.$queryRaw`
      SELECT 
        t.id,
        t.guid,
        t.uri,
        t.name,
        t.album_name,
        t.artists,
        t.release_date,
        t.duration_ms,
        t.popularity,
        t.explicit,
        t.genres,
        t.record_label,
        t.energy,
        t.instrumentalness,
        t.tempo,
        t.created_at,
        t.updated_at,
    
        COALESCE(last_played.date_iso, '1900-01-01'::timestamp) AS last_played_date,
        COALESCE(artist_usage.usage_count, 0) AS recent_artist_usage
    
      FROM tracks t
    
      LEFT JOIN (
        SELECT track_id, MAX(date_iso) AS date_iso
        FROM generated_items 
        WHERE date_iso > ${cooldownDateISO}::timestamp
        GROUP BY track_id
      ) last_played 
        ON t.id = last_played.track_id
    
      LEFT JOIN (
        SELECT artist, COUNT(*)::int AS usage_count
        FROM generated_items 
        WHERE date_iso > ${cooldownDateISO}::timestamp
        GROUP BY artist
      ) artist_usage 
        ON artist_usage.artist = ANY(string_to_array(t.artists, ','))
    
      WHERE (NOT ${rules.exclude_explicit}::boolean OR t.explicit = false)
        AND (NOT ${block.prefer_instrumental}::boolean OR t.instrumentalness IS NOT NULL)
        AND (${admin_override}::boolean 
             OR last_played.date_iso IS NULL 
             OR last_played.date_iso <= ${cooldownDateISO}::timestamp)
    `;

    if (candidateTracks.length === 0) {
      return {
        error: "No tracks available that match the criteria and cooldown rules",
        stats: { total_tracks: 0, discarded_by_cooldown: 0 },
      };
    }

    // 4) Scoring: Calculate scores for each track
    const scoredTracks = candidateTracks.map((track) => {
      let score = 0;

      // Base score for BPM/energy range match
      if (
        track.tempo &&
        Number(track.tempo) >= block.bpm_min! &&
        Number(track.tempo) <= block.bpm_max!
      ) {
        score += 50; // Perfect BPM match
      } else if (track.tempo) {
        score += 20; // Has BPM but outside range (penalized)
      } else {
        score += 30; // No BPM data (neutral)
      }

      if (
        track.energy &&
        track.energy >= block.energy_min! &&
        track.energy <= block.energy_max!
      ) {
        score += 50; // Perfect energy match
      } else if (track.energy) {
        score += 20; // Has energy but outside range (penalized)
      } else {
        score += 30; // No energy data (neutral)
      }

      // Bonus for recently unused artists (inverse of usage count)
      const artistBonus = Math.max(
        0,
        20 - Number(track.recent_artist_usage) * 2
      );
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
      dateISO
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
    const generatedItems: any[] = [];
    for (let i = 0; i < orderedTracks.length; i++) {
      const track = orderedTracks[i];
      const item = await prisma.generated_items.create({
        data: {
          track_id: track.id,
          artist: track.artists,
          date_iso: new Date(dateISO),
          block_id: block.id,
          position: i + 1,
          user_id: user.id,
        },
      });

      generatedItems.push({
        ...item,
        track: track,
      });
    }

    // 8) Log resumen: Calculate statistics
    const totalDuration = orderedTracks.reduce(
      (sum, t) => sum + t.duration_ms,
      0
    );
    const avgBPM = orderedTracks
      .filter((t) => t.bpm)
      .reduce((sum, t, _, arr) => sum + t.tempo / arr.length, 0);
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
        date_iso: new Date(dateISO),
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
  scoredTracks: (Prisma.tracksGetPayload<{
    include: {
      generated_items: true;
    };
  }> & {
    recent_artist_usage: number;
  })[],
  block: Prisma.play_blocksGetPayload<{
    include: {
      rotation_rules: {
        take: 1;
      };
    };
  }>,
  rules: any,
  dateISO: string
) {
  const selected: any[] = [];
  const used = new Set();
  const artistLastUsed = new Map();

  // Calculate target track count (approximate, based on average track length)
  const targetDurationSec = block.target_min! * 90 * 1000;
  let currentDurationSec = 0;

  const cooldownMs = rules.artist_cooldown_min * 60 * 1000;

  for (const track of scoredTracks) {
    if (used.has(track.id)) continue;
    if (currentDurationSec >= targetDurationSec && selected.length >= 8) break; // Minimum 8 tracks

    // Check artist separation within this block
    const lastUsed = artistLastUsed.get(track.artists);
    if (lastUsed && Date.now() - lastUsed < cooldownMs) continue;

    // Check if adding this track would exceed target by too much
    if (
      currentDurationSec > 0 &&
      currentDurationSec + Number(track.duration_ms) > targetDurationSec * 1.3
    ) {
      // Look for shorter tracks first
      continue;
    }

    used.add(track.id);
    artistLastUsed.set(track.artists, Date.now());
    selected.push(track);
    currentDurationSec += Number(track.duration_ms);
  }

  return selected;
}

// 6) Energy curve algorithm: 20% intro low, 60% mid smooth lift, 20% outro warm
function buildEnergyCurve(
  tracks: Prisma.tracksGetPayload<{
    include: {
      generated_items: true;
    };
  }>[]
) {
  if (tracks.length === 0) return tracks;

  // Sort tracks by energy (handle null values)
  const tracksWithEnergy = tracks.map((t) => ({
    ...t,
    energyScore: t.energy || 0.3, // Default energy if null
  }));

  const sortedByEnergy = [...tracksWithEnergy].sort(
    (a, b) => Number(a.energyScore) - Number(b.energyScore)
  );

  const totalTracks = tracks.length;
  const introCount = Math.max(1, Math.floor(totalTracks * 0.2));
  const outroCount = Math.max(1, Math.floor(totalTracks * 0.2));
  const midCount = totalTracks - introCount - outroCount;

  // Divide energy levels into groups
  const lowEnergyTracks = sortedByEnergy.slice(
    0,
    Math.floor(sortedByEnergy.length * 0.4)
  );
  const midEnergyTracks = sortedByEnergy.slice(
    Math.floor(sortedByEnergy.length * 0.3),
    Math.floor(sortedByEnergy.length * 0.7)
  );
  const highEnergyTracks = sortedByEnergy.slice(
    Math.floor(sortedByEnergy.length * 0.6)
  );

  const orderedPlaylist: any[] = [];
  const used = new Set();

  // Helper to pick track from pool
  const pickTrack = (pool) => {
    const available = pool.filter((t) => !used.has(t.id));
    if (available.length === 0) return null;
    const track = available[Math.floor(Math.random() * available.length)];
    used.add(track.id);
    return track;
  };

  // 20% intro: lower energy
  for (let i = 0; i < introCount; i++) {
    const track = pickTrack([...lowEnergyTracks, ...midEnergyTracks]);
    if (track) orderedPlaylist.push(track);
  }

  // 60% mid: smooth energy lift (mid to high)
  for (let i = 0; i < midCount; i++) {
    const progress = i / midCount;
    const pool =
      progress < 0.5
        ? [...midEnergyTracks, ...highEnergyTracks]
        : [...highEnergyTracks, ...midEnergyTracks];

    const track = pickTrack(pool);
    if (track) orderedPlaylist.push(track);
  }

  // 20% outro: warm/calming energy
  for (let i = 0; i < outroCount; i++) {
    const track = pickTrack([...lowEnergyTracks, ...midEnergyTracks]);
    if (track) orderedPlaylist.push(track);
  }

  // Add any remaining tracks
  const remaining = tracksWithEnergy.filter((t) => !used.has(t.id));
  orderedPlaylist.push(...remaining);

  return orderedPlaylist;
}
