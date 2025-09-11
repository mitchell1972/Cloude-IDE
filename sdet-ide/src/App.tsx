import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './components/AuthPage';
import { IDELayout } from './components/IDELayout';
import SubscriptionPage from './components/SubscriptionPage';
import { Toaster } from 'react-hot-toast';
import './App.css';

type PageType = 'ide' | 'subscription'

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [currentPage, setCurrentPage] = useState<PageType>('ide');

  // Check URL for navigation
  useEffect(() => {
    const path = window.location.pathname
    if (path.includes('/subscription') || path.includes('/pricing')) {
      setCurrentPage('subscription')
    } else {
      setCurrentPage('ide')
    }
  }, [])

  const navigateToPage = (page: PageType) => {
    setCurrentPage(page)
    if (page === 'subscription') {
      window.history.pushState({}, '', '/subscription')
    } else {
      window.history.pushState({}, '', '/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">SDET IDE</h2>
          <p className="text-gray-600">Loading your testing environment...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage 
        mode={authMode} 
        onModeChange={setAuthMode} 
      />
    );
  }

  if (currentPage === 'subscription') {
    return (
      <>
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <button
              onClick={() => navigateToPage('ide')}
              className="text-xl font-bold text-blue-600 hover:text-blue-700"
            >
              ← Back to SDET IDE
            </button>
          </div>
        </nav>
        <SubscriptionPage />
      </>
    )
  }

  return <IDELayout onNavigateToSubscription={() => navigateToPage('subscription')} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;