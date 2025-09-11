import { create } from 'zustand'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const stripePromise = loadStripe('pk_test_51QQz9PLniIk7TL9B5u6fglJFtAb3SfaZoQkXoiDqCLfVCLKoQzNyFepfK8kUuHk5b0xBtcdL7H2gx7rflAKJNpCq00m2SrwK0Y')

export interface Plan {
  id: string
  price_id: string
  plan_type: string
  price: number
  monthly_limit: number
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  price_id: string
  status: string
  created_at: string
  plan?: Plan
}

interface SubscriptionState {
  plans: Plan[]
  currentSubscription: Subscription | null
  loading: boolean
  
  loadPlans: () => Promise<void>
  loadCurrentSubscription: () => Promise<void>
  createSubscription: (planType: string, customerEmail: string) => Promise<void>
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plans: [],
  currentSubscription: null,
  loading: false,

  loadPlans: async () => {
    try {
      const { data, error } = await supabase
        .from('ide_plans')
        .select('*')
        .order('price', { ascending: true })
      
      if (error) throw error
      
      set({ plans: data || [] })
    } catch (error: any) {
      toast.error('Failed to load subscription plans')
    }
  },

  loadCurrentSubscription: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data, error } = await supabase
        .from('ide_subscriptions')
        .select(`
          *,
          ide_plans!price_id (
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
      
      set({ currentSubscription: data })
    } catch (error: any) {
      console.error('Failed to load current subscription:', error)
    }
  },

  createSubscription: async (planType: string, customerEmail: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planType,
          customerEmail
        }
      })
      
      if (error) throw error
      
      if (data.data?.checkoutUrl) {
        toast.success('Redirecting to payment...')
        window.location.href = data.data.checkoutUrl
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subscription')
    } finally {
      set({ loading: false })
    }
  }
}))