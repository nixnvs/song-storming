# What's Wrong & What You Need to Provide

## Quick Summary

Your app has **4 main problems** causing inconsistent music:

1. ❌ **Energy variations** - The app intentionally creates energy ups/downs (intro/mid/outro), but you need consistent background music
2. ❌ **No reference system** - The app can't use your playlist URIs as references to find similar music
3. ❌ **Volume inconsistency** - The "normalize loudness" setting exists but isn't actually working
4. ❌ **Playlist import broken** - The feature to import from Spotify playlists isn't implemented yet

## What You Need to Provide

### ✅ **Best Option: Spotify Playlist URIs**

Provide your developer with **2-3 Spotify playlist URIs** that represent your ideal restaurant vibe.

**How to get a playlist URI:**
1. Open Spotify (web or desktop app)
2. Go to your playlist
3. Right-click → "Share" → "Copy link to playlist"
4. The link looks like: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
5. The URI format is: `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M`

**What the developer needs to do:**
- Implement code to import tracks from these playlists
- Analyze the tracks' characteristics (BPM, energy, loudness)
- Use these as "seed tracks" to find similar music
- Set tighter BPM/energy ranges based on your actual preferences

### Alternative: Individual Track URIs

If you prefer specific songs, provide a list of track URIs:
- Format: `spotify:track:4iV5W9uYEdYUVa79Axb7Rh`
- Get them the same way: Right-click track → Share → Copy link

## What to Tell Your Developer

Copy and paste this message:

---

**Subject: Fix Music Selection Issues**

Hi, I've identified the issues with the music selection. Here's what needs to be fixed:

**1. Remove Energy Curve Variations**
The `buildEnergyCurve()` function in `apps/web/src/app/api/generator/route.js` creates energy variations (20% intro low, 60% mid lift, 20% outro). For restaurant background music, I need **consistent energy throughout**. Please either:
- Remove the energy curve entirely, OR
- Make it optional via a setting

**2. Implement Playlist Import from Spotify**
The playlist import feature in `apps/web/src/app/api/catalog/import/route.js` is not implemented. Please add:
- Functionality to fetch tracks from Spotify playlist URIs
- Fetch audio features (BPM, energy, loudness, etc.) for each track
- Store tracks in database with all metadata

**3. Use Seed Tracks for Recommendations**
Instead of just filtering by BPM/energy ranges, use my reference tracks with Spotify's Recommendations API:
```
GET https://api.spotify.com/v1/recommendations
  ?seed_tracks=track1,track2,track3
  &target_energy=0.3
  &target_tempo=80
```

**4. Implement Loudness Normalization**
The `normalize_loudness` setting exists but isn't used. Please:
- Fetch `loudness` audio feature from Spotify API
- Store it in the tracks table
- Use it to filter/prioritize tracks with similar loudness levels

**5. Tighten Selection Criteria**
After importing my reference playlists, calculate the actual BPM/energy ranges from those tracks and use tighter ranges to ensure consistency.

I'll provide the playlist URIs once you confirm you can implement the import feature.

---

## Files That Need Changes

1. `apps/web/src/app/api/catalog/import/route.js` - Add Spotify playlist import
2. `apps/web/src/app/api/generator/route.js` - Remove/fix energy curve, add seed track support
3. Database - Add `loudness` column to tracks table if missing
4. `apps/web/src/app/api/settings/route.js` - Ensure normalize_loudness is actually used

## Expected Result After Fixes

✅ Consistent energy/tone throughout the playlist (no ups and downs)
✅ Music that matches your reference playlists' vibe
✅ Consistent volume levels between tracks
✅ Ability to import and use your preferred playlists as references
