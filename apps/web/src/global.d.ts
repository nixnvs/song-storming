import 'react-router';
module 'virtual:load-fonts.jsx' {
	export function LoadFonts(): null;
}
declare module 'react-router' {
	interface AppLoadContext {
		// add context properties here
	}
}
declare module 'npm:stripe' {
	import Stripe from 'stripe';
	export default Stripe;
}
declare module '@auth/create/react' {
	import { SessionProvider } from '@auth/react';
	export { SessionProvider };
}

// Declarations for JS utils used by server-app.ts
declare module './src/utils/spotifyAuth.js' {
  export function generateCodeVerifier(): string
  export function generateCodeChallenge(verifier: string): Promise<string>
  export function buildAuthorizeUrl(args: {
    clientId: string
    redirectUri: string
    scopes: string[]
    codeChallenge: string
    state: string
  }): string
  export function exchangeCodeForToken(args: {
    clientId: string
    redirectUri: string
    code: string
    codeVerifier: string
  }): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}
