# Cookie Debugging Guide

## Problem
The frontend (port 4000) and API (port 5177) were running on different ports, causing cross-origin cookie issues.

## Solution Implemented
1. **Vite Proxy**: Added proxy configuration in `vite.config.ts` to forward `/api/*` requests to `http://localhost:5177`
2. **Updated Frontend URLs**: Changed hardcoded `http://127.0.0.1:5177` to relative `/api` paths
3. **Cookie Domain**: Set cookie domain to `localhost` for development
4. **CORS Configuration**: Updated CORS to allow both frontend and API origins

## Environment Setup

### Required Environment Variables
Create a `.env.local` file in your project root:

```bash
# Frontend Configuration
NEXT_PUBLIC_APP_ORIGIN=http://localhost:4000

# API Configuration
NODE_ENV=development

# Spotify Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# Vercel Configuration (auto-set in production)
VERCEL_URL=your_vercel_url_here
```

### Development vs Production
- **Development**: Uses `API_URL = "http://localhost:5177"` for direct API calls
- **Production**: Uses relative URLs with Vercel proxy

## Testing the Fix

### 1. Start Both Servers
```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start frontend
npm run dev
```

### 2. Test Cookie Functionality
- Click the "Test Cookie" button in the UI
- Check browser console for detailed logs
- Verify cookies are being set and read correctly

### 3. Test Spotify Auth Flow
- Click "Connect Spotify" 
- Complete OAuth flow
- Verify `sp_tokens` cookie is set
- Check if subsequent API calls include the cookie

### 4. Debug Endpoints
- `/api/test-cookie` - Tests basic cookie functionality
- `/api/auth/debug` - Shows current cookie state and request headers

## Vercel Deployment

The `vercel.json` is configured to:
- Route `/api/*` requests to the Hono API
- Serve the React Router frontend for all other routes
- Use Node.js 18.x runtime for API functions

## Expected Behavior
- Cookies should now persist between frontend and API calls
- Spotify authentication should work end-to-end
- No more "no_token" errors from `/api/me`

## Troubleshooting
If cookies still don't work:
1. Check browser dev tools → Application → Cookies
2. Verify both servers are running on correct ports
3. Check CORS headers in Network tab
4. Ensure `credentials: "include"` is set on fetch calls
5. Verify environment variables are set correctly
6. Check that `.env.local` file exists and contains required variables
