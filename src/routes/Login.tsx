import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, checkAuth } from '@/services/api';

export default function Login() {
  const nav = useNavigate();
  const [status, setStatus] = useState('Initializing...');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pinId, setPinId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    checkExistingAuth();
  }, []);

  async function checkExistingAuth() {
    try {
      // Check if already authenticated
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        nav('/');
        return;
      }

      setStatus('Ready to sign in');
    } catch (err) {
      console.error('Auth check failed:', err);
      setStatus('Ready to sign in');
    }
  }

  async function startPlexAuth() {
    try {
      setIsAuthenticating(true);
      setStatus('Creating authentication request...');

      // Create PIN with backend
      const pinData = await apiClient.createPlexPin();
      setPinId(pinData.id);
      setClientId(pinData.clientId);

      // Open Plex auth window
      setStatus('Opening Plex sign-in window...');
      const authWindow = window.open(pinData.authUrl, '_blank');

      // Start polling for authentication
      setStatus('Waiting for Plex authorization...');
      const pollInterval = setInterval(async () => {
        try {
          const result = await apiClient.checkPlexPin(pinData.id, pinData.clientId);

          if (result.authenticated) {
            clearInterval(pollInterval);
            setStatus('Authentication successful! Redirecting...');

            // Wait a moment for session to be established
            setTimeout(() => {
              nav('/');
            }, 1000);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isAuthenticating) {
          setStatus('Authentication timed out. Please try again.');
          setIsAuthenticating(false);
        }
      }, 120000);

    } catch (err) {
      console.error('Failed to start Plex auth:', err);
      setStatus('Failed to start authentication. Please try again.');
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Plex Media Player</h1>
            <p className="text-gray-400">Sign in with your Plex account</p>
          </div>

          {/* Status Message */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-300">{status}</p>
          </div>

          {/* Sign In Button */}
          {!isAuthenticating ? (
            <button
              onClick={startPlexAuth}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 2C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2H4M8 8L16 12L8 16V8Z"/>
              </svg>
              Sign in with Plex
            </button>
          ) : (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>Don't have a Plex account?</p>
            <a
              href="https://www.plex.tv/sign-up"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:text-orange-400 underline"
            >
              Create one for free
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}