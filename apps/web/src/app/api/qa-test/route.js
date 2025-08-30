import sql from "@/app/api/utils/sql";

// POST /api/qa-test - Run comprehensive QA testing sequence
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    const today = new Date().toISOString().split("T")[0];
    const results = {
      timestamp: new Date().toISOString(),
      action,
      success: false,
      steps: [],
    };

    if (action === "seed_catalog") {
      return await seedCatalog(results);
    } else if (action === "generate_daily") {
      return await generateDailySequence(results, today);
    } else if (action === "export_playlists") {
      return await exportPlaylists(results, today);
    } else if (action === "create_weekly_locked") {
      return await createWeeklyLocked(results, today);
    } else if (action === "analytics_report") {
      return await analyticsReport(results);
    } else if (action === "full_qa") {
      return await runFullQA(results, today);
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("QA Test error:", error);
    return Response.json(
      {
        error: error.message,
        success: false,
      },
      { status: 500 },
    );
  }
}

// Seed catalog with 3 sources per block
async function seedCatalog(results) {
  const step = { name: "Seed Catalog", substeps: [] };

  try {
    // Generate seed data for different block types
    const lunchTracks = generateSeedTracks("lunch", 50); // 3.5h worth
    const dinnerTracks = generateSeedTracks("dinner", 50);
    const lateTracks = generateSeedTracks("late", 50);

    // Import each as separate sources
    const sources = [
      { name: "lunch_seed_1", tracks: lunchTracks.slice(0, 20) },
      { name: "lunch_seed_2", tracks: lunchTracks.slice(20, 35) },
      { name: "lunch_seed_3", tracks: lunchTracks.slice(35, 50) },
      { name: "dinner_seed_1", tracks: dinnerTracks.slice(0, 20) },
      { name: "dinner_seed_2", tracks: dinnerTracks.slice(20, 35) },
      { name: "dinner_seed_3", tracks: dinnerTracks.slice(35, 50) },
      { name: "late_seed_1", tracks: lateTracks.slice(0, 20) },
      { name: "late_seed_2", tracks: lateTracks.slice(20, 35) },
      { name: "late_seed_3", tracks: lateTracks.slice(35, 50) },
    ];

    let totalImported = 0;

    for (const source of sources) {
      try {
        // Create source record
        const [sourceRecord] = await sql`
          INSERT INTO catalog_sources (type, value, status)
          VALUES ('seed_data', ${source.name}, 'importing')
          RETURNING *
        `;

        let imported = 0;
        for (const track of source.tracks) {
          try {
            await sql`
              INSERT INTO tracks (title, artist, uri, duration_sec, bpm, energy, instrumental, explicit, source)
              VALUES (${track.title}, ${track.artist}, ${track.uri}, ${track.duration_sec}, ${track.bpm}, ${track.energy}, ${track.instrumental}, ${track.explicit}, ${source.name})
            `;
            imported++;
            totalImported++;
          } catch (trackError) {
            if (trackError.code !== "23505") {
              // Skip duplicates
              console.warn("Track import error:", trackError);
            }
          }
        }

        // Update source status
        await sql`
          UPDATE catalog_sources 
          SET status = 'completed', tracks_imported = ${imported}, imported_at = CURRENT_TIMESTAMP
          WHERE id = ${sourceRecord.id}
        `;

        step.substeps.push({
          source: source.name,
          tracks_imported: imported,
          success: true,
        });
      } catch (sourceError) {
        step.substeps.push({
          source: source.name,
          error: sourceError.message,
          success: false,
        });
      }
    }

    // Check effective catalog per block
    const [lunchStats] = await sql`
      SELECT COUNT(*) as count, SUM(duration_sec)/3600 as hours
      FROM tracks 
      WHERE bpm BETWEEN 80 AND 110 AND energy BETWEEN 0.3 AND 0.7 AND NOT explicit
    `;

    const [dinnerStats] = await sql`
      SELECT COUNT(*) as count, SUM(duration_sec)/3600 as hours
      FROM tracks 
      WHERE bpm BETWEEN 100 AND 130 AND energy BETWEEN 0.5 AND 0.8 AND NOT explicit
    `;

    const [lateStats] = await sql`
      SELECT COUNT(*) as count, SUM(duration_sec)/3600 as hours
      FROM tracks 
      WHERE bpm BETWEEN 90 AND 120 AND energy BETWEEN 0.4 AND 0.9 AND NOT explicit
    `;

    step.catalog_effectiveness = {
      lunch: {
        tracks: parseInt(lunchStats.count),
        hours: parseFloat(lunchStats.hours),
      },
      dinner: {
        tracks: parseInt(dinnerStats.count),
        hours: parseFloat(dinnerStats.hours),
      },
      late: {
        tracks: parseInt(lateStats.count),
        hours: parseFloat(lateStats.hours),
      },
    };

    step.total_imported = totalImported;
    step.success = totalImported > 0;
    results.steps.push(step);
    results.success = step.success;

    return Response.json(results);
  } catch (error) {
    step.error = error.message;
    step.success = false;
    results.steps.push(step);
    return Response.json(results, { status: 500 });
  }
}

// Generate daily sequence: Lunch → Dinner → Late
async function generateDailySequence(results, dateISO) {
  const step = { name: "Generate Daily Sequence", blocks: [] };

  try {
    const blocks = ["Lunch", "Dinner", "Late"];

    for (const blockName of blocks) {
      const blockStep = { block: blockName };

      try {
        // Call generator
        const response = await fetch(
          new URL("/api/generator", "http://localhost:3000"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date_iso: dateISO,
              block_name: blockName,
              force: true,
            }),
          },
        );

        const result = await response.json();

        if (result.success && result.playlist) {
          blockStep.success = true;
          blockStep.playlist_stats = result.playlist.stats;
          blockStep.duration_check = {
            actual_min: result.playlist.stats.actual_duration_min,
            target_min: result.playlist.stats.target_duration_min,
            within_tolerance:
              Math.abs(
                result.playlist.stats.actual_duration_min -
                  result.playlist.stats.target_duration_min,
              ) <= 3,
          };
        } else {
          blockStep.success = false;
          blockStep.error = result.error || "Generation failed";
        }
      } catch (error) {
        blockStep.success = false;
        blockStep.error = error.message;
      }

      step.blocks.push(blockStep);
    }

    step.success = step.blocks.every((b) => b.success);
    results.steps.push(step);
    results.success = step.success;

    return Response.json(results);
  } catch (error) {
    step.error = error.message;
    step.success = false;
    results.steps.push(step);
    return Response.json(results, { status: 500 });
  }
}

// Export CSV/M3U to folder structure
async function exportPlaylists(results, dateISO) {
  const step = { name: "Export Playlists", exports: [] };

  try {
    const blocks = ["Lunch", "Dinner", "Late"];
    const formats = ["csv", "m3u"];

    for (const blockName of blocks) {
      for (const format of formats) {
        const exportStep = { block: blockName, format };

        try {
          const response = await fetch(
            new URL("/api/export", "http://localhost:3000"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: format,
                date_iso: dateISO,
                block_name: blockName,
                folder_structure: `/Playlists/${dateISO}/`,
              }),
            },
          );

          if (response.ok) {
            exportStep.success = true;
            exportStep.file_path = `/Playlists/${dateISO}/${blockName}_${dateISO}.${format}`;
          } else {
            const error = await response.json();
            exportStep.success = false;
            exportStep.error = error.error || "Export failed";
          }
        } catch (error) {
          exportStep.success = false;
          exportStep.error = error.message;
        }

        step.exports.push(exportStep);
      }
    }

    step.success = step.exports.every((e) => e.success);
    results.steps.push(step);
    results.success = step.success;

    return Response.json(results);
  } catch (error) {
    step.error = error.message;
    step.success = false;
    results.steps.push(step);
    return Response.json(results, { status: 500 });
  }
}

// Create weekly plan and mark as locked
async function createWeeklyLocked(results, startDate) {
  const step = { name: "Create Weekly Locked Plan", days: [] };

  try {
    // Generate 7 days starting from today
    const blocks = ["Lunch", "Dinner", "Late"];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayISO = date.toISOString().split("T")[0];

      const dayStep = { date: dayISO, blocks: [] };

      // Create schedule day
      await sql`
        INSERT INTO schedule_days (date_iso, status)
        VALUES (${dayISO}, 'locked')
        ON CONFLICT (date_iso) DO UPDATE SET status = 'locked'
      `;

      for (const blockName of blocks) {
        try {
          const response = await fetch(
            new URL("/api/generator", "http://localhost:3000"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date_iso: dayISO,
                block_name: blockName,
                force: true,
              }),
            },
          );

          const result = await response.json();
          dayStep.blocks.push({
            block: blockName,
            success: result.success,
            track_count: result.playlist?.stats?.track_count || 0,
          });
        } catch (error) {
          dayStep.blocks.push({
            block: blockName,
            success: false,
            error: error.message,
          });
        }
      }

      dayStep.success = dayStep.blocks.every((b) => b.success);
      step.days.push(dayStep);
    }

    step.success = step.days.every((d) => d.success);
    results.steps.push(step);
    results.success = step.success;

    return Response.json(results);
  } catch (error) {
    step.error = error.message;
    step.success = false;
    results.steps.push(step);
    return Response.json(results, { status: 500 });
  }
}

// Analytics report: repeats avoided and BPM/energy averages
async function analyticsReport(results) {
  const step = { name: "Analytics Report" };

  try {
    // Repeats avoided in last 7 days
    const repeatsAvoided = await sql`
      WITH recent_plays AS (
        SELECT track_id, artist, date_iso, block_id, 
               ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY date_iso DESC) as play_rank,
               ROW_NUMBER() OVER (PARTITION BY artist ORDER BY date_iso DESC, generated_at DESC) as artist_rank
        FROM generated_items 
        WHERE date_iso >= CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        COUNT(CASE WHEN play_rank > 1 THEN 1 END) as track_repeats_avoided,
        COUNT(CASE WHEN artist_rank > 1 THEN 1 END) as artist_repeats_avoided,
        COUNT(*) as total_slots
      FROM recent_plays
    `;

    // BPM/Energy averages per block
    const blockStats = await sql`
      SELECT 
        pb.name as block_name,
        COUNT(gi.id) as total_tracks,
        ROUND(AVG(t.bpm), 1) as avg_bpm,
        ROUND(AVG(t.energy), 2) as avg_energy,
        ROUND(AVG(t.duration_sec)/60, 1) as avg_duration_min
      FROM generated_items gi
      JOIN tracks t ON gi.track_id = t.id
      JOIN play_blocks pb ON gi.block_id = pb.id
      WHERE gi.date_iso >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY pb.name, pb.id
      ORDER BY pb.id
    `;

    // Weekly coverage stats
    const coverage = await sql`
      SELECT 
        DATE(gi.date_iso) as date,
        COUNT(DISTINCT gi.block_id) as blocks_generated,
        COUNT(gi.id) as total_tracks,
        SUM(t.duration_sec)/60 as total_minutes
      FROM generated_items gi
      JOIN tracks t ON gi.track_id = t.id
      WHERE gi.date_iso >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(gi.date_iso)
      ORDER BY date
    `;

    step.repeats_analysis = repeatsAvoided[0];
    step.block_averages = blockStats;
    step.weekly_coverage = coverage;
    step.success = true;

    results.steps.push(step);
    results.success = true;

    return Response.json(results);
  } catch (error) {
    step.error = error.message;
    step.success = false;
    results.steps.push(step);
    return Response.json(results, { status: 500 });
  }
}

// Full QA sequence
async function runFullQA(results, today) {
  try {
    // Run all tests in sequence
    const seedResult = await seedCatalog({ steps: [] });
    const generateResult = await generateDailySequence({ steps: [] }, today);
    const exportResult = await exportPlaylists({ steps: [] }, today);
    const weeklyResult = await createWeeklyLocked({ steps: [] }, today);
    const analyticsResult = await analyticsReport({ steps: [] });

    results.steps = [
      ...seedResult.steps,
      ...generateResult.steps,
      ...exportResult.steps,
      ...weeklyResult.steps,
      ...analyticsResult.steps,
    ];

    results.success = results.steps.every((step) => step.success);
    results.summary = {
      total_steps: results.steps.length,
      successful_steps: results.steps.filter((s) => s.success).length,
      failed_steps: results.steps.filter((s) => !s.success).length,
    };

    return Response.json(results);
  } catch (error) {
    results.error = error.message;
    results.success = false;
    return Response.json(results, { status: 500 });
  }
}

// Helper function to generate seed track data with real artists
function generateSeedTracks(blockType, count) {
  const tracks = [];

  // Real artists and their typical characteristics per block
  const artistData = {
    lunch: {
      artists: [
        {
          name: "Ólafur Arnalds",
          style: "ambient/neo-classical",
          bpmRange: [65, 85],
          energyRange: [0.15, 0.35],
        },
        {
          name: "Nils Frahm",
          style: "ambient/piano",
          bpmRange: [70, 90],
          energyRange: [0.2, 0.4],
        },
        {
          name: "Max Richter",
          style: "modern classical",
          bpmRange: [60, 80],
          energyRange: [0.25, 0.45],
        },
      ],
      bpmMin: 60,
      bpmMax: 95,
      energyMin: 0.1,
      energyMax: 0.4,
    },
    dinner: {
      artists: [
        {
          name: "Nicola Conte",
          style: "nu-jazz/bossa",
          bpmRange: [95, 115],
          energyRange: [0.45, 0.65],
        },
        {
          name: "Koop",
          style: "nu-jazz/electronic",
          bpmRange: [100, 120],
          energyRange: [0.5, 0.7],
        },
        {
          name: "Stéphane Pompougnac",
          style: "downtempo/lounge",
          bpmRange: [90, 110],
          energyRange: [0.4, 0.6],
        },
      ],
      bpmMin: 80,
      bpmMax: 120,
      energyMin: 0.3,
      energyMax: 0.7,
    },
    late: {
      artists: [
        {
          name: "Ibrahim Maalouf",
          style: "jazz/world",
          bpmRange: [80, 100],
          energyRange: [0.35, 0.55],
        },
        {
          name: "Avishai Cohen",
          style: "jazz/bass",
          bpmRange: [70, 95],
          energyRange: [0.3, 0.5],
        },
        {
          name: "Melody Gardot",
          style: "jazz/vocal",
          bpmRange: [75, 95],
          energyRange: [0.25, 0.45],
        },
      ],
      bpmMin: 70,
      bpmMax: 100,
      energyMin: 0.2,
      energyMax: 0.5,
    },
  };

  const blockData = artistData[blockType];
  const blockArtists = blockData.artists;

  // Sample track names for each artist (realistic titles)
  const trackTitles = {
    "Ólafur Arnalds": [
      "Near Light",
      "Only The Winds",
      "Saman",
      "Particles",
      "Re:member",
      "Unfold",
      "They Sink",
      "Brot",
      "Four",
      "Doria",
      "Tomorrow's Song",
      "Polish",
      "Old Skin",
      "This Place Was a Shelter",
      "Lag fyrir ömmu",
      "Eulogy for Evolution",
    ],
    "Nils Frahm": [
      "Says",
      "Hammers",
      "Felt",
      "Screws",
      "All Melody",
      "Sunson",
      "A Place",
      "My Friend the Forest",
      "Lemon Day",
      "Re",
      "Toilet Brushes",
      "Human Range",
      "Them",
      "Momentum",
      "Some",
      "Over There",
    ],
    "Max Richter": [
      "On The Nature Of Daylight",
      "Vladimir's Blues",
      "The Blue Notebooks",
      "Embers",
      "Spring 1",
      "Horizon",
      "Gardens End",
      "Mercy",
      "Origin",
      "Infra 5",
      "Dona Nobis Pacem",
      "Fragment",
      "Childhood 1",
      "Dream 3",
    ],
    "Nicola Conte": [
      "Bossa Per Due",
      "Sea and Sand",
      "Jazz Combo",
      "Jet Sounds",
      "Other Directions",
      "Arabesque",
      "Love Me 'Til Sunday",
      "Il Porto Di Beirut",
      "Afrodisiac",
      "New Standards",
      "Ritual",
      "Bossa Nostra",
      "Blue Note",
      "Roma Capoccia",
    ],
    Koop: [
      "Summer Sun",
      "Waltz for Koop",
      "Strange Love",
      "Come to Me",
      "Koop Island Blues",
      "Relaxin' at Club Koop",
      "Baby",
      "Drum Rhythm A",
      "Tonight",
      "Forces... Darling",
      "Bright Nights",
      "Glomd",
      "Koop Blend",
    ],
    "Stéphane Pompougnac": [
      "Living on the Edge",
      "Knights of Arabia",
      "Sunday Drive",
      "Hello Mademoiselle",
      "Eva",
      "Shimbalaiê",
      "Sympa",
      "Perfect Day",
      "Autumn Leaves",
      "Between the Bars",
      "Catania",
      "Aganjú",
      "Waiting",
    ],
    "Ibrahim Maalouf": [
      "True Sorry",
      "Diagnostic",
      "Sensations",
      "Red & Black Light",
      "Beirut",
      "Una Rosa Blanca",
      "Nomade Slang",
      "40 Melodies",
      "Diacritiques",
      "Wind",
      "Capacity to Love",
      "Oxmo",
      "Will You Still Love Me Tomorrow",
      "Bom Bom",
    ],
    "Avishai Cohen": [
      "Seven Seas",
      "Remembering",
      "Chutzpan",
      "Song for My Brother",
      "Aurora",
      "Madrid",
      "Almah",
      "Gently Disturbed",
      "The Ever Evolving Etude",
      "Pinzin Kinzin",
      "Bass Suite",
      "Lyla",
      "Arab Maluf",
      "Signature",
    ],
    "Melody Gardot": [
      "Baby I'm a Fool",
      "Worrisome Heart",
      "Who Will Comfort Me",
      "Love Me Like a River Does",
      "Your Heart Is as Black as Night",
      "Mira",
      "Preacherman",
      "Amalia",
      "If the Stars Were Mine",
      "Our Love Is Easy",
      "Lisboa",
      "Sunset in the Blue",
    ],
  };

  for (let i = 0; i < count; i++) {
    const artistIndex = i % blockArtists.length;
    const artist = blockArtists[artistIndex];
    const artistTracks = trackTitles[artist.name] || [
      "Track 1",
      "Track 2",
      "Track 3",
    ];
    const trackIndex =
      Math.floor(i / blockArtists.length) % artistTracks.length;

    // Use artist-specific ranges for more realistic data
    const bpm =
      Math.floor(Math.random() * (artist.bpmRange[1] - artist.bpmRange[0])) +
      artist.bpmRange[0];
    const energy =
      Math.random() * (artist.energyRange[1] - artist.energyRange[0]) +
      artist.energyRange[0];

    // Duration varies by block type (classical tends longer, jazz/electronic shorter)
    const durationRange =
      blockType === "lunch"
        ? [240, 420]
        : blockType === "dinner"
          ? [210, 360]
          : [180, 330];
    const duration =
      Math.floor(Math.random() * (durationRange[1] - durationRange[0])) +
      durationRange[0];

    tracks.push({
      title: artistTracks[trackIndex],
      artist: artist.name,
      uri: `spotify:track:${blockType}_${artist.name.replace(/\s+/g, "_").toLowerCase()}_${trackIndex}_${Date.now()}`,
      duration_sec: duration,
      bpm,
      energy: Math.round(energy * 100) / 100,
      instrumental:
        blockType === "lunch" ? Math.random() < 0.7 : Math.random() < 0.3, // Lunch more instrumental
      explicit: false, // These artists rarely have explicit content
    });
  }

  return tracks;
}

// GET /api/qa-test - Get test status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get("report");

    if (report === "catalog") {
      const tracks = await sql`
        SELECT 
          source,
          COUNT(*) as track_count,
          COUNT(DISTINCT artist) as unique_artists,
          SUM(duration_sec)/3600 as total_hours,
          AVG(bpm) as avg_bpm,
          AVG(energy) as avg_energy
        FROM tracks 
        GROUP BY source
        ORDER BY track_count DESC
      `;

      return Response.json({ catalog_report: tracks });
    }

    return Response.json({
      available_actions: [
        "seed_catalog",
        "generate_daily",
        "export_playlists",
        "create_weekly_locked",
        "analytics_report",
        "full_qa",
      ],
    });
  } catch (error) {
    console.error("Error getting QA test status:", error);
    return Response.json(
      { error: "Failed to get test status" },
      { status: 500 },
    );
  }
}
