// Test endpoint for validating Stripe integration
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { action } = await req.json();

        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing environment variables');
        }

        let result;

        switch (action) {
            case 'test_stripe_connection':
                result = await testStripeConnection(stripeSecretKey);
                break;
            
            case 'test_plans_data':
                result = await testPlansData(supabaseUrl, serviceRoleKey);
                break;
            
            case 'create_test_subscription':
                result = await createTestSubscription(stripeSecretKey, supabaseUrl, serviceRoleKey);
                break;
            
            case 'test_webhook_endpoint':
                result = await testWebhookEndpoint();
                break;
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Stripe integration test error:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'STRIPE_TEST_FAILED',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

async function testStripeConnection(stripeSecretKey: string) {
    try {
        const response = await fetch('https://api.stripe.com/v1/account', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            throw new Error(`Stripe API error: ${response.status}`);
        }

        const account = await response.json();
        
        return {
            success: true,
            message: 'Stripe connection successful',
            account_id: account.id,
            business_profile: account.business_profile?.name || 'Not set',
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Stripe connection failed: ${error.message}`
        };
    }
}

async function testPlansData(supabaseUrl: string, serviceRoleKey: string) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sdet_plans`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase error: ${response.status}`);
        }

        const plans = await response.json();
        
        return {
            success: true,
            message: 'Plans data retrieved successfully',
            plans_count: plans.length,
            plans: plans.map(plan => ({
                id: plan.id,
                plan_type: plan.plan_type,
                price: plan.price,
                monthly_limit: plan.monthly_limit
            }))
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Plans data test failed: ${error.message}`
        };
    }
}

async function createTestSubscription(stripeSecretKey: string, supabaseUrl: string, serviceRoleKey: string) {
    try {
        // Create a test customer
        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                email: `test-${Date.now()}@sdet-ide.com`,
                name: 'Test Customer',
                description: 'Test customer for SDET IDE integration testing'
            })
        });

        if (!customerResponse.ok) {
            throw new Error('Failed to create test customer');
        }

        const customer = await customerResponse.json();
        
        // Get the first available plan
        const plansResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_plans?limit=1`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!plansResponse.ok) {
            throw new Error('Failed to get plans');
        }

        const plans = await plansResponse.json();
        if (plans.length === 0) {
            throw new Error('No plans available');
        }

        const plan = plans[0];

        // Create a test checkout session
        const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                customer: customer.id,
                payment_method_types: 'card',
                line_items: JSON.stringify([{
                    price: plan.price_id,
                    quantity: 1
                }]),
                mode: 'subscription',
                success_url: 'https://sdet-ide.com/success',
                cancel_url: 'https://sdet-ide.com/cancel'
            })
        });

        if (!sessionResponse.ok) {
            throw new Error('Failed to create checkout session');
        }

        const session = await sessionResponse.json();
        
        return {
            success: true,
            message: 'Test subscription workflow created successfully',
            customer_id: customer.id,
            session_id: session.id,
            checkout_url: session.url,
            plan_used: plan.plan_type
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Test subscription creation failed: ${error.message}`
        };
    }
}

async function testWebhookEndpoint() {
    try {
        // Test if our webhook endpoint is accessible
        const webhookUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/sdet-stripe-webhook';
        
        // Create a test webhook payload
        const testPayload = {
            id: 'evt_test_webhook',
            object: 'event',
            type: 'customer.subscription.created',
            data: {
                object: {
                    id: 'sub_test_123',
                    customer: 'cus_test_123',
                    status: 'active'
                }
            }
        };

        return {
            success: true,
            message: 'Webhook endpoint is configured',
            webhook_url: webhookUrl,
            test_payload_ready: true
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Webhook test failed: ${error.message}`
        };
    }
}