import React, { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'
import { AuthPage } from './components/AuthPage'
import { IDELayout } from './components/IDELayout'
import SubscriptionPage from './components/SubscriptionPage'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

type PageType = 'ide' | 'subscription'

function App() {
  const { user, initialized, initialize } = useAuthStore()
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [currentPage, setCurrentPage] = useState<PageType>('ide')

  // Initialize auth on app load
  useEffect(() => {
    initialize()
  }, [initialize])

  // Check URL for navigation
  useEffect(() => {
    const path = window.location.pathname
    if (path.includes('/subscription') || path.includes('/pricing')) {
      setCurrentPage('subscription')
    } else {
      setCurrentPage('ide')
    }
  }, [])

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('cloudide-theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      // Default to dark theme
      setTheme('dark')
    }
  }, [])

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem('cloudide-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const navigateToPage = (page: PageType) => {
    setCurrentPage(page)
    if (page === 'subscription') {
      window.history.pushState({}, '', '/subscription')
    } else {
      window.history.pushState({}, '', '/')
    }
  }

  // Show loading state while initializing
  if (!initialized) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-gray-900 transition-colors duration-200">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-gray-600 dark:text-gray-400">Initializing CloudIDE...</p>
          </div>
        </div>
      </div>
    )
  }

  const renderCurrentPage = () => {
    if (!user) {
      return <AuthPage theme={theme} />
    }

    if (currentPage === 'subscription') {
      return (
        <>
          <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <button
                onClick={() => navigateToPage('ide')}
                className="text-xl font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Back to CloudIDE
              </button>
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {theme === 'dark' ? '🌞' : '🌙'}
              </button>
            </div>
          </nav>
          <SubscriptionPage />
        </>
      )
    }

    return (
      <IDELayout 
        theme={theme} 
        onThemeToggle={handleThemeToggle}
        onNavigateToSubscription={() => navigateToPage('subscription')}
      />
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`${theme === 'dark' ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-gray-900 transition-colors duration-200">
          {renderCurrentPage()}
        </div>
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: theme === 'dark' ? '#1f2937' : '#ffffff',
              color: theme === 'dark' ? '#f9fafb' : '#111827',
              border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: theme === 'dark' ? '#1f2937' : '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: theme === 'dark' ? '#1f2937' : '#ffffff',
              },
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

export default App