# How to Test the Fixes - Step by Step

## 🎯 Where to Find Everything in the App

### Step 1: Import Your Reference Tracks

1. **Open your app** (after deploying the branch)
2. **Click "Catalog & Settings"** in the left sidebar
3. **Click the "Import Music" tab** (should be selected by default)
4. **Select "Track URIs"** option (new option we just added)
5. **Paste your track URIs** in the text box:
   ```
   spotify:track:5eksCJ1r2T1kNIZPTHBGG2
   spotify:track:7Ma65Rw2NITbTtYTwsbtWe
   spotify:track:6UDWsYMH2MwgOxOS9sbnwC
   ... (paste all your track URIs, one per line or comma-separated)
   ```
6. **Click "Import Music"** button
7. Wait for success message showing how many tracks were imported

**Alternative:** You can also use "Playlist URL" option and paste a Spotify playlist URL/URI

### Step 2: Enable Loudness Normalization

1. **Still in "Catalog & Settings"**
2. **Click the "Rotation Rules" tab** (third tab)
3. **Check the box** next to "Normalize Loudness"
4. **Click "Save Rules"** button

### Step 3: Generate a Playlist to Test

1. **Go to "Service Start"** in the left sidebar
2. **Generate a new playlist** for today or any date
3. **Check the results:**
   - Energy should stay consistent (no big ups/downs)
   - Volume levels should be similar between tracks
   - Music should match your reference tracks' vibe

## 📍 Visual Guide

```
┌─────────────────────────────────────┐
│  Sidebar (Left)                     │
│  ┌───────────────────────────────┐ │
│  │ ▶ Service Start               │ │
│  │ 📅 Weekly Plan                │ │
│  │ 💾 Catalog & Settings  ←─── HERE│
│  │ 📜 History                    │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘

Once in Catalog & Settings:

┌─────────────────────────────────────┐
│  [Import Music] [Play Blocks]       │
│  [Rotation Rules] [Export Settings] │
│                                      │
│  Import Music Tab:                   │
│  ○ Artist Name                       │
│  ○ Playlist URL                      │
│  ● Track URIs  ←─── SELECT THIS      │
│  ○ CSV Upload                        │
│                                      │
│  [Paste track URIs here...]          │
│  [Import Music] button               │
└─────────────────────────────────────┘

Then switch to Rotation Rules tab:

┌─────────────────────────────────────┐
│  [Import Music] [Play Blocks]       │
│  [Rotation Rules] [Export Settings] │
│                                      │
│  ☑ Normalize Loudness  ←─── CHECK    │
│  [Save Rules] button                 │
└─────────────────────────────────────┘
```

## 🧪 Quick Test Checklist

- [ ] Import at least 5-10 reference tracks
- [ ] Enable "Normalize Loudness" setting
- [ ] Generate a new playlist
- [ ] Verify energy stays consistent (no dramatic changes)
- [ ] Check that volume levels are similar
- [ ] Confirm music matches your preferred vibe

## 🐛 Troubleshooting

**"Spotify authentication required" error:**
- Make sure you've logged in with Spotify first
- Go to the app and authenticate if needed

**Import fails:**
- Check that your track URIs start with `spotify:track:`
- Make sure you're authenticated with Spotify
- Some tracks might not be available in your region

**No loudness normalization:**
- Make sure you clicked "Save Rules" after checking the box
- The database might need a `loudness` column (see FIXES_IMPLEMENTED.md)

## 📝 Track URIs to Test With

You can copy these from `import_reference_tracks.js` or use these sample ones:

```
spotify:track:5eksCJ1r2T1kNIZPTHBGG2
spotify:track:7Ma65Rw2NITbTtYTwsbtWe
spotify:track:6UDWsYMH2MwgOxOS9sbnwC
spotify:track:4rplK4ylZurvDv5plS2dVS
spotify:track:1ivudlcJhIrbaaCfTejxgo
```
