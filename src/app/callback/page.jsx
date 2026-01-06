'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Loader } from 'lucide-react';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Spotify authentication...');

  useEffect(() => {
    handleSpotifyCallback();
  }, []);

  const handleSpotifyCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (error) {
        setStatus('error');
        setMessage(`Spotify authorization failed: ${error}`);
        setTimeout(() => window.location.href = '/?error=spotify_auth_failed', 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received from Spotify');
        setTimeout(() => window.location.href = '/?error=missing_code', 3000);
        return;
      }

      // Get PKCE verifier from session storage
      const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
      const redirectUri = sessionStorage.getItem('spotify_redirect_uri');
      
      if (!codeVerifier) {
        setStatus('error');
        setMessage('PKCE verification failed - please restart authentication');
        setTimeout(() => window.location.href = '/?error=pkce_failed', 3000);
        return;
      }

      setMessage('Exchanging authorization code for access token...');

      // Exchange code for tokens
      const response = await fetch('/api/auth/spotify/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          codeVerifier,
          redirectUri: redirectUri || `${window.location.origin}/callback`
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Token exchange failed');
      }

      if (result.success) {
        // Clear session storage
        sessionStorage.removeItem('spotify_code_verifier');
        sessionStorage.removeItem('spotify_redirect_uri');
        
        setStatus('success');
        setMessage('Successfully connected to Spotify!');
        
        // Redirect to main app with success message
        setTimeout(() => {
          window.location.href = '/?spotify_connected=true';
        }, 2000);
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      console.error('Spotify callback error:', error);
      setStatus('error');
      setMessage(`Authentication failed: ${error.message}`);
      setTimeout(() => window.location.href = `/?error=${encodeURIComponent(error.message)}`, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0D0D0D] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-8 max-w-md w-full text-center">
        
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'processing' && (
            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          )}
          
          {status === 'success' && (
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          )}
          
          {status === 'error' && (
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          )}
        </div>

        {/* Status Text */}
        <h1 className="text-2xl font-bold text-black dark:text-white mb-4 font-sora">
          {status === 'processing' && 'Connecting to Spotify'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Authentication Failed'}
        </h1>

        <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mb-6">
          {message}
        </p>

        {/* Processing indicator */}
        {status === 'processing' && (
          <div className="flex items-center justify-center space-x-2 text-sm text-[#6F6F6F] dark:text-[#AAAAAA]">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        )}

        {/* Auto-redirect message */}
        {(status === 'success' || status === 'error') && (
          <p className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Redirecting you back to the app...
          </p>
        )}
      </div>
    </div>
  );
}