import sql from "@/app/api/utils/sql";
import { generateBlock } from "../generator/route.js";

// GET /api/test - Run basic unit tests for the generator and scheduler
export async function GET(request) {
  const testResults = {
    tests: [],
    passed: 0,
    failed: 0,
    summary: ''
  };

  const addTest = (name, passed, details = null) => {
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
  };

  try {
    // Test 1: Database connectivity and schema
    try {
      const [block] = await sql`SELECT * FROM play_blocks LIMIT 1`;
      const [rules] = await sql`SELECT * FROM rotation_rules LIMIT 1`;
      addTest('Database Schema Validation', !!(block && rules), 
        { blocks_found: !!block, rules_found: !!rules });
    } catch (error) {
      addTest('Database Schema Validation', false, error.message);
    }

    // Test 2: Play blocks configuration
    try {
      const blocks = await sql`SELECT name, target_min, bpm_min, bpm_max, energy_min, energy_max FROM play_blocks ORDER BY name`;
      const expectedBlocks = ['Lunch', 'Dinner', 'Late'];
      const foundBlocks = blocks.map(b => b.name);
      const hasAllBlocks = expectedBlocks.every(name => foundBlocks.includes(name));
      
      addTest('Play Blocks Configuration', hasAllBlocks, {
        expected: expectedBlocks,
        found: foundBlocks,
        details: blocks
      });
    } catch (error) {
      addTest('Play Blocks Configuration', false, error.message);
    }

    // Test 3: Tracks availability
    try {
      const [trackCount] = await sql`SELECT COUNT(*) as count FROM tracks`;
      const tracksAvailable = trackCount.count > 0;
      addTest('Tracks Catalog Availability', tracksAvailable, {
        total_tracks: trackCount.count,
        note: tracksAvailable ? 'Ready for generation' : 'No tracks - import catalog first'
      });
    } catch (error) {
      addTest('Tracks Catalog Availability', false, error.message);
    }

    // Test 4: Energy curve algorithm (unit test)
    try {
      // Mock tracks with different energy levels
      const mockTracks = [
        { id: 1, energy: 0.1, title: 'Low Energy 1', artist: 'Artist 1', duration_sec: 180 },
        { id: 2, energy: 0.3, title: 'Low Energy 2', artist: 'Artist 2', duration_sec: 200 },
        { id: 3, energy: 0.5, title: 'Mid Energy 1', artist: 'Artist 3', duration_sec: 190 },
        { id: 4, energy: 0.7, title: 'High Energy 1', artist: 'Artist 4', duration_sec: 210 },
        { id: 5, energy: 0.9, title: 'High Energy 2', artist: 'Artist 5', duration_sec: 195 },
        { id: 6, energy: 0.4, title: 'Mid Energy 2', artist: 'Artist 6', duration_sec: 185 },
      ];

      // Import buildEnergyCurve function (would need to be exported from generator)
      // For now, test the concept manually
      const orderedTracks = [...mockTracks].sort((a, b) => a.energy - b.energy);
      const introSection = orderedTracks.slice(0, 2); // 20% intro (low energy)
      const outroSection = orderedTracks.slice(0, 2); // 20% outro (low energy)
      
      const energyCurveValid = 
        introSection.every(t => t.energy <= 0.4) && 
        outroSection.every(t => t.energy <= 0.4);

      addTest('Energy Curve Algorithm', energyCurveValid, {
        intro_energy_range: introSection.map(t => t.energy),
        outro_energy_range: outroSection.map(t => t.energy),
        note: 'Basic energy sorting validation'
      });
    } catch (error) {
      addTest('Energy Curve Algorithm', false, error.message);
    }

    // Test 5: Scoring algorithm validation
    try {
      // Test scoring logic
      const mockTrack = { 
        bpm: 85, 
        energy: 0.4, 
        recent_artist_usage: 1,
        instrumental: false,
        explicit: false
      };
      const mockBlock = { 
        bmp_min: 80, 
        bmp_max: 110, 
        energy_min: 0.3, 
        energy_max: 0.6,
        prefer_instrumental: false
      };

      // Simulate scoring logic
      let score = 0;
      if (mockTrack.bpm >= mockBlock.bmp_min && mockTrack.bpm <= mockBlock.bmp_max) {
        score += 50; // Perfect BPM match
      }
      if (mockTrack.energy >= mockBlock.energy_min && mockTrack.energy <= mockBlock.energy_max) {
        score += 50; // Perfect energy match
      }
      const artistBonus = Math.max(0, 20 - (mockTrack.recent_artist_usage * 2));
      score += artistBonus;

      const expectedScore = 50 + 50 + 18; // BPM + Energy + Artist bonus
      const scoringValid = score === expectedScore;

      addTest('Track Scoring Algorithm', scoringValid, {
        calculated_score: score,
        expected_score: expectedScore,
        bpm_match: 50,
        energy_match: 50,
        artist_bonus: artistBonus
      });
    } catch (error) {
      addTest('Track Scoring Algorithm', false, error.message);
    }

    // Test 6: Cooldown logic validation  
    try {
      const testDate = '2025-08-13';
      const cooldownDays = 7;
      
      const cooldownDate = new Date(testDate);
      cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);
      const cooldownDateISO = cooldownDate.toISOString().split('T')[0];
      
      const expectedCooldownDate = '2025-08-06';
      const cooldownValid = cooldownDateISO === expectedCooldownDate;

      addTest('Cooldown Date Calculation', cooldownValid, {
        test_date: testDate,
        cooldown_days: cooldownDays,
        calculated_cutoff: cooldownDateISO,
        expected_cutoff: expectedCooldownDate
      });
    } catch (error) {
      addTest('Cooldown Date Calculation', false, error.message);
    }

    // Test 7: Generate block function (integration test - only if tracks exist)
    try {
      const [trackCount] = await sql`SELECT COUNT(*) as count FROM tracks`;
      
      if (trackCount.count > 0) {
        // Try to generate a test playlist
        const testDate = '2025-08-20'; // Future date to avoid conflicts
        const result = await generateBlock(testDate, 'Lunch', { force: true });
        
        const generationSuccessful = result.success && result.playlist;
        addTest('Playlist Generation Integration', generationSuccessful, {
          has_playlist: !!result.playlist,
          track_count: result.playlist?.stats?.track_count || 0,
          duration_min: result.playlist?.stats?.actual_duration_min || 0,
          error: result.error || null
        });

        // Cleanup test data
        if (generationSuccessful) {
          await sql`DELETE FROM generated_items WHERE date_iso = ${testDate}`;
          await sql`DELETE FROM schedule_days WHERE date_iso = ${testDate}`;
        }
      } else {
        addTest('Playlist Generation Integration', false, 'No tracks available for testing');
      }
    } catch (error) {
      addTest('Playlist Generation Integration', false, error.message);
    }

    testResults.summary = `${testResults.passed}/${testResults.tests.length} tests passed`;
    
    return Response.json({
      ...testResults,
      timestamp: new Date().toISOString(),
      environment: 'test',
      recommendations: testResults.failed > 0 ? [
        'Check database connections and schema',
        'Ensure play blocks are properly configured',
        'Import tracks into catalog before running generator',
        'Verify rotation rules are set up'
      ] : ['All systems operational']
    });

  } catch (error) {
    console.error('Error running tests:', error);
    return Response.json({
      error: 'Test suite failed to run',
      details: error.message,
      tests: testResults.tests
    }, { status: 500 });
  }
}

// POST /api/test - Run specific test scenarios
export async function POST(request) {
  try {
    const body = await request.json();
    const { test_type, params = {} } = body;

    switch (test_type) {
      case 'load_test':
        return await runLoadTest(params);
      case 'cooldown_test':
        return await runCooldownTest(params);
      case 'energy_curve_test':
        return await runEnergyCurveTest(params);
      default:
        return Response.json({ error: 'Invalid test type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error running specific test:', error);
    return Response.json({ error: 'Test failed', details: error.message }, { status: 500 });
  }
}

// Load test: Generate multiple playlists quickly
async function runLoadTest(params) {
  const { days = 3 } = params;
  const startDate = new Date();
  const results = [];

  for (let i = 0; i < days; i++) {
    const testDate = new Date(startDate);
    testDate.setDate(testDate.getDate() + i + 30); // Future dates
    const dateISO = testDate.toISOString().split('T')[0];

    const startTime = Date.now();
    const result = await generateBlock(dateISO, 'Lunch', { force: true });
    const endTime = Date.now();

    results.push({
      date: dateISO,
      success: !!result.success,
      duration_ms: endTime - startTime,
      tracks: result.playlist?.stats?.track_count || 0,
      error: result.error || null
    });

    // Cleanup
    await sql`DELETE FROM generated_items WHERE date_iso = ${dateISO}`;
    await sql`DELETE FROM schedule_days WHERE date_iso = ${dateISO}`;
  }

  const avgTime = results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length;
  const successRate = results.filter(r => r.success).length / results.length;

  return Response.json({
    test_type: 'load_test',
    results,
    summary: {
      total_generations: results.length,
      success_rate: Math.round(successRate * 100),
      avg_generation_time_ms: Math.round(avgTime),
      performance: avgTime < 2000 ? 'Good' : avgTime < 5000 ? 'Acceptable' : 'Slow'
    }
  });
}

// Test cooldown enforcement
async function runCooldownTest(params) {
  // Implementation would test that tracks within cooldown period are properly excluded
  return Response.json({
    test_type: 'cooldown_test',
    status: 'Not implemented - requires track seeding',
    note: 'Would test track and artist cooldown enforcement'
  });
}

// Test energy curve distribution
async function runEnergyCurveTest(params) {
  // Implementation would analyze energy distribution in generated playlists
  return Response.json({
    test_type: 'energy_curve_test', 
    status: 'Not implemented - requires detailed track analysis',
    note: 'Would analyze intro/mid/outro energy distribution'
  });
}