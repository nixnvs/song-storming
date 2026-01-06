import sql from "@/app/api/utils/sql";
import { generateBlock } from "../generator/route.js";

// GET /api/schedule - Get schedule for date range
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit")) || 30;

    let dateFilter = "";
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      dateFilter += ` AND sd.date_iso >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      dateFilter += ` AND sd.date_iso <= $${paramCount}`;
      params.push(endDate);
    }

    paramCount++;
    const query = `
      SELECT 
        sd.*,
        json_agg(
          json_build_object(
            'block_id', pb.id,
            'block_name', pb.name,
            'target_min', pb.target_min,
            'color', pb.color,
            'track_count', COALESCE(block_stats.track_count, 0),
            'duration_sec', COALESCE(block_stats.duration_sec, 0),
            'generated', COALESCE(block_stats.track_count, 0) > 0
          ) ORDER BY pb.id
        ) as blocks
      FROM schedule_days sd
      CROSS JOIN play_blocks pb
      LEFT JOIN (
        SELECT 
          gi.date_iso,
          gi.block_id,
          COUNT(*) as track_count,
          SUM(t.duration_sec) as duration_sec
        FROM generated_items gi
        JOIN tracks t ON gi.track_id = t.id
        GROUP BY gi.date_iso, gi.block_id
      ) block_stats ON sd.date_iso = block_stats.date_iso AND pb.id = block_stats.block_id
      WHERE 1=1 ${dateFilter}
      GROUP BY sd.id, sd.date_iso, sd.status, sd.created_at, sd.updated_at
      ORDER BY sd.date_iso DESC
      LIMIT $${paramCount}
    `;

    params.push(limit);
    const schedules = await sql(query, params);

    return Response.json({ schedules });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return Response.json(
      { error: "Failed to fetch schedule" },
      { status: 500 },
    );
  }
}

// POST /api/schedule - Generate daily or weekly schedules
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      action,
      date_iso,
      start_date_iso,
      status = "pending",
      force = false,
      admin_override = false,
    } = body;

    if (action === "generate_daily") {
      return await generateDaily(date_iso, { force, admin_override });
    } else if (action === "generate_weekly") {
      return await weeklyRotation(start_date_iso, { force, admin_override });
    } else if (action === "create_schedule") {
      // Create or update schedule day (existing functionality)
      if (!date_iso) {
        return Response.json(
          { error: "Required field: date_iso" },
          { status: 400 },
        );
      }

      const [schedule] = await sql`
        INSERT INTO schedule_days (date_iso, status)
        VALUES (${date_iso}, ${status})
        ON CONFLICT (date_iso) 
        DO UPDATE SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      return Response.json({ schedule }, { status: 201 });
    } else {
      return Response.json(
        {
          error:
            'Invalid action. Use "generate_daily", "generate_weekly", or "create_schedule"',
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error in schedule operation:", error);
    return Response.json(
      { error: "Failed to execute schedule operation" },
      { status: 500 },
    );
  }
}

// Generate daily schedule: Lunch→Dinner→Late
async function generateDaily(dateISO, options = {}) {
  const { force = false, admin_override = false } = options;

  try {
    // Create or update schedule day
    const [scheduleDay] = await sql`
      INSERT INTO schedule_days (date_iso, status)
      VALUES (${dateISO}, 'generating')
      ON CONFLICT (date_iso) 
      DO UPDATE SET status = 'generating', updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const results = {
      date_iso: dateISO,
      blocks: [],
      success: true,
      errors: [],
    };

    // Generate each block in sequence: Lunch → Dinner → Late
    const blockOrder = ["Lunch", "Dinner", "Late"];

    for (const blockName of blockOrder) {
      try {
        console.log(`Generating ${blockName} for ${dateISO}`);

        const blockResult = await generateBlock(dateISO, blockName, {
          force,
          admin_override,
        });

        if (blockResult.error) {
          results.errors.push({
            block: blockName,
            error: blockResult.error,
          });
          results.success = false;
        } else {
          results.blocks.push({
            block_name: blockName,
            playlist: blockResult.playlist,
            stats: blockResult.playlist.stats,
          });
        }

        // Small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error generating ${blockName}:`, error);
        results.errors.push({
          block: blockName,
          error: `Failed to generate: ${error.message}`,
        });
        results.success = false;
      }
    }

    // Update schedule day status
    const finalStatus = results.success ? "completed" : "failed";
    await sql`
      UPDATE schedule_days 
      SET status = ${finalStatus}, updated_at = CURRENT_TIMESTAMP
      WHERE date_iso = ${dateISO}
    `;

    // Calculate summary stats
    const totalTracks = results.blocks.reduce(
      (sum, b) => sum + (b.stats?.track_count || 0),
      0,
    );
    const totalDuration = results.blocks.reduce(
      (sum, b) => sum + (b.stats?.actual_duration_min || 0),
      0,
    );

    results.summary = {
      total_blocks: results.blocks.length,
      total_tracks: totalTracks,
      total_duration_min: Math.round(totalDuration * 10) / 10,
      errors_count: results.errors.length,
    };

    return Response.json(results, { status: results.success ? 201 : 207 }); // 207 = Multi-Status
  } catch (error) {
    console.error("Error in generateDaily:", error);

    // Update schedule day to failed status
    await sql`
      UPDATE schedule_days 
      SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE date_iso = ${dateISO}
    `;

    return Response.json(
      {
        error: "Failed to generate daily schedule",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Weekly rotation: weeklyRotation(startDateISO) pre-generates 7 days
async function weeklyRotation(startDateISO, options = {}) {
  const { force = false, admin_override = false } = options;

  try {
    const startDate = new Date(startDateISO);
    const results = {
      start_date: startDateISO,
      days: [],
      success: true,
      errors: [],
    };

    // Generate 7 consecutive days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateISO = currentDate.toISOString().split("T")[0];

      try {
        console.log(`Generating week day ${dayOffset + 1}/7: ${dateISO}`);

        const dayResult = await generateDaily(dateISO, {
          force,
          admin_override,
        });

        if (dayResult.ok) {
          const dayData = await dayResult.json();
          results.days.push(dayData);

          if (!dayData.success) {
            results.success = false;
            results.errors.push({
              date: dateISO,
              errors: dayData.errors,
            });
          }
        } else {
          results.success = false;
          results.errors.push({
            date: dateISO,
            error: "Failed to generate daily schedule",
          });
        }

        // Delay between days to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error generating day ${dateISO}:`, error);
        results.success = false;
        results.errors.push({
          date: dateISO,
          error: error.message,
        });
      }
    }

    // Calculate weekly summary
    const totalDays = results.days.length;
    const successfulDays = results.days.filter((d) => d.success).length;
    const totalBlocks = results.days.reduce(
      (sum, d) => sum + (d.blocks?.length || 0),
      0,
    );
    const totalTracks = results.days.reduce(
      (sum, d) => sum + (d.summary?.total_tracks || 0),
      0,
    );
    const totalDuration = results.days.reduce(
      (sum, d) => sum + (d.summary?.total_duration_min || 0),
      0,
    );

    results.weekly_summary = {
      total_days: totalDays,
      successful_days: successfulDays,
      total_blocks: totalBlocks,
      total_tracks: totalTracks,
      total_duration_min: Math.round(totalDuration * 10) / 10,
      success_rate: Math.round((successfulDays / totalDays) * 100),
    };

    return Response.json(results, { status: results.success ? 201 : 207 });
  } catch (error) {
    console.error("Error in weeklyRotation:", error);
    return Response.json(
      {
        error: "Failed to generate weekly rotation",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
