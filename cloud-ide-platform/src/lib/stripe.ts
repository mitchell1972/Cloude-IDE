import { loadStripe } from '@stripe/stripe-js'

// Initialize Stripe
export const stripePromise = loadStripe('pk_test_51QQz9PLniIk7TL9B5u6fglJFtAb3SfaZoQkXoiDqCLfVCLKoQzNyFepfK8kUuHk5b0xBtcdL7H2gx7rflAKJNpCq00m2SrwK0Y')

// Stripe subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free Tier',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '2 hours execution time/month',
      '2 projects max',
      '100MB storage',
      'Basic code execution',
      'Community support'
    ]
  },
  pro: {
    name: 'Pro Plan',
    price: 1900, // $19.00
    currency: 'usd',
    interval: 'month',
    features: [
      '50 hours execution time/month',
      'Unlimited projects',
      '5GB storage',
      'Advanced code execution',
      'Real-time collaboration',
      'Priority support'
    ]
  },
  enterprise: {
    name: 'Enterprise Plan',
    price: 14900, // $149.00
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited execution time',
      'Unlimited projects',
      '50GB storage',
      'Advanced code execution',
      'Real-time collaboration',
      'Team features',
      'Dedicated support'
    ]
  }
}

// Format price for display
export const formatPrice = (price: number, currency = 'usd') => {
  if (price === 0) return 'Free'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(price / 100)
}

// Get plan features
export const getPlanFeatures = (planType: string) => {
  return SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS]?.features || []
}