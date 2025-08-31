declare module '@/utils/spotifyAuth' {
    export interface PKCEChallenge {
      codeVerifier: string;
      codeChallenge: string;
    }
  
    export function generatePKCEChallenge(): Promise<PKCEChallenge>;
    export function buildSpotifyAuthUrl(): Promise<string>;
    export function checkSpotifyAuth(): Promise<boolean>;
    export function ensureSpotifyAuth(): Promise<boolean>;
  
    export interface PlaylistResult {
      success: boolean;
      playlistUrl?: string;
      playlistId?: string;
      tracksAdded?: number;
      name?: string;
      error?: string;
    }
  
    export function createDailyBlockPlaylist(
      dateISO: string,
      blockName: string,
      uris: string[]
    ): Promise<PlaylistResult>;
  }