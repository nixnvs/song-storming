# Test Locally (Fastest Option)

## Quick Local Test

Instead of waiting for Vercel, you can test everything locally in 2-3 minutes:

### Step 1: Install Dependencies (if not already done)
```bash
cd apps/web
npm install
```

### Step 2: Set Up Environment Variables
Make sure you have a `.env` file in `apps/web/` with:
- `DATABASE_URL` - Your database connection string
- `SPOTIFY_CLIENT_ID` - Your Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Your Spotify app secret
- `SPOTIFY_REDIRECT_URI` - Your redirect URI (e.g., `http://localhost:4000/api/auth/spotify/callback`)

### Step 3: Run the App
```bash
cd apps/web
npm run dev
```

The app will start at `http://localhost:4000`

### Step 4: Test Your Fixes
1. Open `http://localhost:4000` in your browser
2. Click "Catalog & Settings" → Should navigate directly (no dropdown)
3. Click "Import Music" tab
4. Select "Track URIs" option
5. Paste your track URIs and test import
6. Enable "Normalize Loudness" in Rotation Rules
7. Generate a playlist to test

## Alternative: Merge to Main

If you want to deploy but Vercel preview is too slow:

1. **Create a Pull Request** and merge to `main`
2. **Production builds are often faster** (better caching, priority)
3. **Test on production URL** once deployed

```bash
# Create PR (or merge directly if you have access)
git checkout main
git merge fix/music-selection-consistency
git push origin main
```

## Check Vercel Build Status

The build might actually be progressing - Vercel logs can be slow to update. Check:
1. Vercel Dashboard → Your project → Deployments
2. Click on the latest deployment
3. Check if it's still "Building" or if it completed

Sometimes builds take 10-15 minutes on the first run (installing dependencies, etc.)
