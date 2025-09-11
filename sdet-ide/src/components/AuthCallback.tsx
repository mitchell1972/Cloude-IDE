import React from 'react';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  useEffect(() => {
    async function handleAuthCallback() {
      // Get the hash fragment from the URL
      const hashFragment = window.location.hash;

      if (hashFragment && hashFragment.length > 0) {
        try {
          // Exchange the auth code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(hashFragment);

          if (error) {
            console.error('Error exchanging code for session:', error.message);
            // Redirect to error page or show error message
            window.location.href = '/login?error=' + encodeURIComponent(error.message);
            return;
          }

          if (data.session) {
            // Successfully signed in, redirect to app
            window.location.href = '/'; // or your app's main page
            return;
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          window.location.href = '/login?error=Authentication failed';
          return;
        }
      }

      // If we get here, something went wrong
      window.location.href = '/login?error=No session found';
    }

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Authentication</h2>
        <p className="text-gray-600">Please wait while we set up your account...</p>
      </div>
    </div>
  );
}