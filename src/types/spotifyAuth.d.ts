// Type declarations for the client-side Spotify auth helpers
// located at `src/utils/spotifyAuth.js` (ESM, browser-only)

declare module './src/utils/spotifyAuth.js' {
  export function generatePKCEChallenge(): Promise<{ codeVerifier: string; codeChallenge: string }>
  export function buildSpotifyAuthUrl(): Promise<string>
  export function checkSpotifyAuth(): Promise<boolean>
  export function ensureSpotifyAuth(): Promise<boolean>
  export function createDailyBlockPlaylist(
    dateISO: string,
    blockName: string,
    uris: string[]
  ): Promise<{ success: boolean; [key: string]: any }>
}

// Common alternate relative import patterns (harmless duplicates)
declare module './utils/spotifyAuth.js' {
  export * from './src/utils/spotifyAuth.js'
}
declare module 'src/utils/spotifyAuth.js' {
  export * from './src/utils/spotifyAuth.js'
}

