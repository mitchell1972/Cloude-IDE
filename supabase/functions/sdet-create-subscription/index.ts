Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { planType, customerEmail } = await req.json();

        if (!planType || !customerEmail) {
            throw new Error('Plan type and customer email are required');
        }

        // Get environment variables
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

        if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing required environment variables');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Get plan details from database
        const planResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_plans?plan_type=eq.${planType}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!planResponse.ok) {
            throw new Error('Failed to fetch plan details');
        }

        const plans = await planResponse.json();
        if (plans.length === 0) {
            throw new Error(`Plan '${planType}' not found`);
        }

        const plan = plans[0];

        // Create Stripe customer
        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                email: customerEmail,
                'metadata[user_id]': userId
            })
        });

        if (!customerResponse.ok) {
            const errorText = await customerResponse.text();
            throw new Error(`Failed to create Stripe customer: ${errorText}`);
        }

        const customer = await customerResponse.json();

        // Create Stripe checkout session
        const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                customer: customer.id,
                'payment_method_types[0]': 'card',
                'line_items[0][price]': plan.price_id,
                'line_items[0][quantity]': '1',
                mode: 'subscription',
                success_url: `${frontendUrl}/subscription?session_id={CHECKOUT_SESSION_ID}&subscription=success`,
                cancel_url: `${frontendUrl}/subscription?subscription=cancelled`,
                'metadata[user_id]': userId,
                'metadata[plan_type]': planType
            })
        });

        if (!checkoutResponse.ok) {
            const errorText = await checkoutResponse.text();
            throw new Error(`Failed to create checkout session: ${errorText}`);
        }

        const session = await checkoutResponse.json();

        // Create subscription record in database (pending)
        const subscriptionResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                user_id: userId,
                stripe_customer_id: customer.id,
                price_id: plan.price_id,
                status: 'pending',
                stripe_subscription_id: session.id // temporary, will be updated by webhook
            })
        });

        if (!subscriptionResponse.ok) {
            console.error('Failed to create subscription record:', await subscriptionResponse.text());
            // Don't throw error here as Stripe session is already created
        }

        return new Response(JSON.stringify({
            data: {
                checkoutUrl: session.url,
                sessionId: session.id,
                customerId: customer.id
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Subscription creation error:', error);

        const errorResponse = {
            error: {
                code: 'SUBSCRIPTION_CREATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});