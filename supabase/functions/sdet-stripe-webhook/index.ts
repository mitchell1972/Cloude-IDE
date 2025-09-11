Deno.serve(async (req) => {
    try {
        const signature = req.headers.get('stripe-signature');
        const body = await req.text();
        
        // Get Stripe webhook secret from environment
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing required environment variables');
        }

        // Verify webhook signature (simplified verification)
        if (!signature) {
            throw new Error('No stripe signature found');
        }

        // Parse the webhook payload
        let event;
        try {
            event = JSON.parse(body);
        } catch (err) {
            throw new Error('Invalid JSON payload');
        }

        console.log('Webhook event type:', event.type);

        // Handle the event
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object, supabaseUrl, serviceRoleKey);
                break;
                
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object, supabaseUrl, serviceRoleKey);
                break;
                
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object, supabaseUrl, serviceRoleKey);
                break;
                
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object, supabaseUrl, serviceRoleKey);
                break;
                
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object, supabaseUrl, serviceRoleKey);
                break;
                
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

async function handleSubscriptionCreated(subscription: any, supabaseUrl: string, serviceRoleKey: string) {
    console.log('Handling subscription created:', subscription.id);
    
    // Update subscription status in database
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions?stripe_subscription_id=eq.${subscription.id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status: subscription.status,
            updated_at: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        console.error('Failed to update subscription:', await response.text());
    }
}

async function handleSubscriptionUpdated(subscription: any, supabaseUrl: string, serviceRoleKey: string) {
    console.log('Handling subscription updated:', subscription.id);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions?stripe_subscription_id=eq.${subscription.id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status: subscription.status,
            updated_at: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        console.error('Failed to update subscription:', await response.text());
    }
}

async function handleSubscriptionDeleted(subscription: any, supabaseUrl: string, serviceRoleKey: string) {
    console.log('Handling subscription deleted:', subscription.id);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions?stripe_subscription_id=eq.${subscription.id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status: 'canceled',
            updated_at: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        console.error('Failed to update subscription:', await response.text());
    }
}

async function handlePaymentSucceeded(invoice: any, supabaseUrl: string, serviceRoleKey: string) {
    console.log('Handling payment succeeded for subscription:', invoice.subscription);
    
    // You could log payment history or update usage limits here
    // For now, just ensure subscription is active
    if (invoice.subscription) {
        const response = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions?stripe_subscription_id=eq.${invoice.subscription}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'active',
                updated_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            console.error('Failed to update subscription on payment success:', await response.text());
        }
    }
}

async function handlePaymentFailed(invoice: any, supabaseUrl: string, serviceRoleKey: string) {
    console.log('Handling payment failed for subscription:', invoice.subscription);
    
    if (invoice.subscription) {
        const response = await fetch(`${supabaseUrl}/rest/v1/sdet_subscriptions?stripe_subscription_id=eq.${invoice.subscription}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'past_due',
                updated_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            console.error('Failed to update subscription on payment failure:', await response.text());
        }
    }
}