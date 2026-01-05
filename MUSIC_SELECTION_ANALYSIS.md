# Music Selection Issues - Analysis & Solutions

## Current Problems Identified

### 1. **Tone/Vibe Inconsistency** 
The app is creating energy variations that break the consistent background music vibe you want.

**Root Cause:** The `buildEnergyCurve()` function in `apps/web/src/app/api/generator/route.js` (lines 278-351) intentionally creates energy variations:
- 20% intro: Lower energy tracks
- 60% mid: Energy gradually increases
- 20% outro: Returns to lower energy

This is designed for dynamic playlists, but for restaurant background music, you need **consistent energy/tone throughout**.

### 2. **No Seed Track/Reference System**
The app currently has **no way to use your reference playlists** to guide music selection. It only uses:
- BPM ranges (e.g., 60-95 for Lunch)
- Energy ranges (e.g., 0.1-0.4 for Lunch)
- Basic filtering (instrumental preference, explicit content)

**Missing:** There's no system to:
- Import tracks from your reference playlists
- Use those tracks as "seed" references to find similar music
- Learn the characteristics (BPM, energy, genre, etc.) from your preferred tracks

### 3. **Volume/Sound Level Inconsistency**
The `normalize_loudness` setting exists in the database but **is not actually being used** anywhere in the code. It's just stored but never applied.

**Root Cause:** The setting is saved but there's no code that:
- Fetches audio features (loudness) from Spotify API
- Normalizes volume levels between tracks
- Applies volume adjustments during playback

### 4. **Playlist Import Not Implemented**
The import route (`apps/web/src/app/api/catalog/import/route.js`) shows that `playlist_url` import is **not implemented** - it just throws an error saying "requires music service API".

## What You Need to Provide

### Option 1: Playlist URIs (Recommended)
**Format:** Spotify playlist URIs or URLs
- Example: `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M`
- Or: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`

**What the developer needs to do:**
1. Implement playlist import functionality
2. Fetch all tracks from your reference playlists
3. Analyze their audio features (BPM, energy, loudness, etc.)
4. Use these as "seed tracks" to find similar music
5. Set BPM/energy ranges based on your actual preferences

### Option 2: Individual Track URIs
**Format:** List of Spotify track URIs
- Example: `spotify:track:4iV5W9uYEdYUVa79Axb7Rh`

**What the developer needs to do:**
1. Import these tracks into the catalog
2. Analyze their characteristics
3. Use Spotify's "Get Recommendations" API with these as seed tracks
4. Find similar tracks that match the vibe

### Option 3: Artist Names (Less Effective)
**Format:** Artist names you like
- Example: "Ólafur Arnalds", "Nils Frahm"

**Limitation:** This is less precise than using actual track/playlist references.

## Recommended Solution

### Step 1: Import Your Reference Playlists
The developer needs to implement:
```javascript
// In apps/web/src/app/api/catalog/import/route.js
// Add Spotify API integration to:
1. Fetch playlist tracks using Spotify API
2. Get audio features for each track (BPM, energy, loudness, etc.)
3. Store tracks in database with all metadata
4. Calculate average BPM/energy ranges from your references
```

### Step 2: Use Seed Tracks for Recommendations
Instead of just filtering by BPM/energy ranges, use Spotify's Recommendations API:
```javascript
// Use your reference tracks as "seed_tracks" parameter
// This will find similar music that matches the vibe
GET https://api.spotify.com/v1/recommendations
  ?seed_tracks=track1,track2,track3
  &target_energy=0.3
  &target_tempo=80
  &limit=100
```

### Step 3: Remove Energy Curve Variation
For consistent background music, modify `buildEnergyCurve()` to:
- Keep energy **consistent** throughout (no intro/mid/outro variation)
- Or make it optional via a setting

### Step 4: Implement Loudness Normalization
Add code to:
- Fetch `loudness` audio feature from Spotify API
- Store it in the database
- Use it to filter/prioritize tracks with similar loudness
- Or apply volume normalization during playback

## What to Tell Your Developer

**Share this with them:**

> "I need the following fixes:
> 
> 1. **Implement playlist import from Spotify URIs** - I'll provide playlist URIs that represent the vibe I want. The app should import all tracks from these playlists and analyze their characteristics.
> 
> 2. **Use seed tracks for recommendations** - Instead of just filtering by BPM/energy ranges, use my reference tracks as seed tracks with Spotify's Recommendations API to find similar music.
> 
> 3. **Remove energy curve variations** - The `buildEnergyCurve()` function creates energy variations (intro/mid/outro), but I need consistent background music. Either remove this or make it optional.
> 
> 4. **Implement loudness normalization** - The `normalize_loudness` setting exists but isn't used. Please fetch loudness data from Spotify API and use it to ensure consistent volume levels.
> 
> 5. **Tighten BPM/energy ranges** - After importing my reference playlists, calculate the actual BPM/energy ranges from those tracks and use tighter ranges to ensure consistency."

## Files That Need Changes

1. **`apps/web/src/app/api/catalog/import/route.js`**
   - Implement Spotify playlist import
   - Fetch audio features (BPM, energy, loudness)

2. **`apps/web/src/app/api/generator/route.js`**
   - Modify `buildEnergyCurve()` to keep energy consistent
   - Add seed track support for recommendations
   - Use loudness data for filtering

3. **Database Schema**
   - Ensure `tracks` table has `loudness` column
   - Add `seed_track` or `reference_playlist` tracking

4. **`apps/web/src/app/api/settings/route.js`**
   - Ensure `normalize_loudness` setting is properly used

## Next Steps

1. **You:** Collect 2-3 Spotify playlist URIs that represent your ideal restaurant vibe
2. **Developer:** Implement playlist import functionality
3. **Developer:** Modify generation algorithm to use seed tracks
4. **Developer:** Remove/fix energy curve variations
5. **Developer:** Implement loudness normalization
6. **Test:** Generate new playlists and verify consistency
