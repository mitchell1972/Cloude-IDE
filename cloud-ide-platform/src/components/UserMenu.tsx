import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { User, Settings, LogOut, CreditCard, X, Check, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface UserMenuProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  onNavigateToSubscription: () => void
}

interface Plan {
  id: number
  price_id: string
  plan_type: string
  price: number
  monthly_limit: number
}

interface Subscription {
  id: number
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  price_id: string
  status: string
  cloudide_plans: Plan
}

export const UserMenu: React.FC<UserMenuProps> = ({ theme, onThemeToggle, onNavigateToSubscription }) => {
  const { user, signOut } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)

  const fetchSubscription = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('cloudide_subscriptions')
        .select(`
          *,
          cloudide_plans!price_id(
            id,
            price_id,
            plan_type,
            price,
            monthly_limit
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      setSubscription(data)
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
    }
  }

  useEffect(() => {
    fetchSubscription()
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    setShowMenu(false)
  }

  const handleSubscriptionClick = () => {
    setShowMenu(false)
    onNavigateToSubscription()
  }

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white hidden md:block">
          {user.user_metadata?.full_name || user.email?.split('@')[0]}
        </span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.user_metadata?.full_name || user.email}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Current Subscription */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Current Plan
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {subscription?.cloudide_plans?.plan_type || 'Free'}
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {subscription?.cloudide_plans?.price 
                    ? `$${(subscription.cloudide_plans.price / 100).toFixed(2)}/mo`
                    : 'Free'
                  }
                </span>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={handleSubscriptionClick}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Subscription & Billing</span>
              </button>
              
              <button
                onClick={onThemeToggle}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              
              <button
                onClick={() => {}}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
