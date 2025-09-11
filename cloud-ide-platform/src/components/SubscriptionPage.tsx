import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'
import { Check, Zap, Users, Shield, ArrowRight } from 'lucide-react'

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

const PLAN_FEATURES = {
  free: [
    '5 execution hours/month',
    '3 projects maximum',
    '1GB storage',
    'Basic code execution',
    'Community support'
  ],
  pro: [
    '50 execution hours/month',
    'Unlimited projects',
    '5GB storage',
    'Advanced code execution',
    'Real-time collaboration',
    'Priority support',
    'Code coverage analysis'
  ],
  enterprise: [
    '200 execution hours/month',
    'Unlimited projects',
    '50GB storage',
    'Advanced code execution',
    'Real-time collaboration',
    'Team management',
    'Dedicated support',
    'Custom integrations',
    'SSO integration'
  ]
}

const PLAN_ICONS = {
  free: <Zap className="w-8 h-8 text-blue-500" />,
  pro: <Users className="w-8 h-8 text-purple-500" />,
  enterprise: <Shield className="w-8 h-8 text-orange-500" />
}

export default function SubscriptionPage() {
  const { user } = useAuthStore()
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [fetchingData, setFetchingData] = useState(true)

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('cloudide_plans')
        .select('*')
        .order('price', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      console.error('Failed to fetch plans:', error)
      toast.error('Failed to load subscription plans')
    }
  }

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

      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows returned"
      setSubscription(data)
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      toast.error('Failed to load subscription data')
    }
  }

  useEffect(() => {
    const initializeData = async () => {
      setFetchingData(true)
      await Promise.all([fetchPlans(), fetchSubscription()])
      setFetchingData(false)
    }

    initializeData()

    // Handle payment result
    const urlParams = new URLSearchParams(window.location.search)
    const subscriptionStatus = urlParams.get('subscription')

    if (subscriptionStatus === 'success') {
      toast.success('🎉 Subscription activated successfully!')
      window.history.replaceState({}, document.title, window.location.pathname)
      
      setTimeout(() => {
        fetchSubscription()
      }, 2000)
    } else if (subscriptionStatus === 'cancelled') {
      toast.error('Subscription cancelled. You can try again anytime!')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [user])

  const handleSubscribe = async (planType: string) => {
    if (!user) {
      toast.error('Please sign in to subscribe')
      return
    }

    setLoading(planType)

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planType,
          customerEmail: user.email,
          tablePrefix: 'cloudide_'
        }
      })

      if (error) throw error

      if (data.data?.checkoutUrl) {
        toast.success('Redirecting to payment...')
        window.location.href = data.data.checkoutUrl
      }
    } catch (error: any) {
      console.error('Subscription error:', error)
      toast.error(error.message || 'Failed to create subscription')
    } finally {
      setLoading(null)
    }
  }

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free'
    return `$${(price / 100).toFixed(2)}`
  }

  const getCurrentPlanType = () => {
    if (!subscription || !subscription.cloudide_plans) return 'free'
    return subscription.cloudide_plans.plan_type
  }

  if (fetchingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your CloudIDE Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Power up your development workflow with professional cloud IDE capabilities.
            Start free and scale as you grow.
          </p>
        </div>

        {/* Current Subscription Status */}
        {subscription && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg max-w-2xl mx-auto">
            <div className="flex items-center justify-center text-green-800">
              <Check className="w-5 h-5 mr-2" />
              <span className="font-medium">
                You're currently on the {subscription.cloudide_plans?.plan_type?.charAt(0).toUpperCase() + subscription.cloudide_plans?.plan_type?.slice(1)} plan
              </span>
            </div>
          </div>
        )}

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = getCurrentPlanType() === plan.plan_type
            const features = PLAN_FEATURES[plan.plan_type as keyof typeof PLAN_FEATURES] || []
            const icon = PLAN_ICONS[plan.plan_type as keyof typeof PLAN_ICONS]
            const isPopular = plan.plan_type === 'pro'

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-xl border-2 transition-all duration-300 hover:shadow-2xl ${
                  isPopular
                    ? 'border-purple-500 scale-105'
                    : isCurrentPlan
                    ? 'border-green-500'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center justify-center mb-4">
                    {icon}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center capitalize">
                    {plan.plan_type}
                  </h3>
                  
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-gray-600 ml-2">/month</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full py-3 px-6 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.plan_type)}
                      disabled={loading === plan.plan_type || !user}
                      className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
                        isPopular
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading === plan.plan_type ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <span>{plan.price === 0 ? 'Get Started' : 'Subscribe Now'}</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Trusted by developers worldwide
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Join thousands of developers who use CloudIDE to build, test, and deploy 
            their applications faster with our powerful cloud development environment.
          </p>
        </div>
      </div>
    </div>
  )
}
