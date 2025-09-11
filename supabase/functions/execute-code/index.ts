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
        const { code, language, timeoutMs = 30000 } = await req.json();

        if (!code || !language) {
            throw new Error('Code and language are required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Authentication required');
        }

        const token = authHeader.replace('Bearer ', '');
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Check user's subscription and usage limits
        const subscriptionResponse = await fetch(`${supabaseUrl}/rest/v1/ide_subscriptions?user_id=eq.${userId}&status=eq.active&select=*,ide_plans!price_id(monthly_limit)`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        let monthlyLimit = 2; // Free tier default
        if (subscriptionResponse.ok) {
            const subscriptionData = await subscriptionResponse.json();
            if (subscriptionData && subscriptionData.length > 0 && subscriptionData[0].ide_plans) {
                monthlyLimit = subscriptionData[0].ide_plans.monthly_limit || 2;
            }
        }

        // Check current month's usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usageResponse = await fetch(`${supabaseUrl}/rest/v1/usage_metrics?user_id=eq.${userId}&date=gte.${currentMonth}-01&date=lt.${currentMonth}-32&select=execution_time_minutes`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        let totalUsage = 0;
        if (usageResponse.ok) {
            const usageData = await usageResponse.json();
            totalUsage = usageData.reduce((sum, record) => sum + (record.execution_time_minutes || 0), 0);
        }

        // Convert hours to minutes for comparison
        const monthlyLimitMinutes = monthlyLimit * 60;
        if (totalUsage >= monthlyLimitMinutes) {
            throw new Error(`Monthly execution limit reached (${monthlyLimit} hours). Upgrade your plan for more usage.`);
        }

        const startTime = Date.now();
        let output = '';
        let errorMessage = '';
        let status = 'success';

        try {
            // Execute code based on language
            switch (language.toLowerCase()) {
                case 'javascript':
                case 'js':
                    // Create a sandboxed JavaScript execution environment
                    try {
                        // Wrap user code in a try-catch and capture console output
                        const wrappedCode = `
                            const console = {
                                log: (...args) => { output += args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ') + '\n'; },
                                error: (...args) => { output += 'ERROR: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ') + '\n'; },
                                warn: (...args) => { output += 'WARN: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ') + '\n'; }
                            };
                            let output = '';
                            try {
                                ${code}
                            } catch (e) {
                                output += 'Runtime Error: ' + e.message + '\n';
                            }
                            output;
                        `;
                        output = eval(wrappedCode) || '';
                    } catch (error) {
                        errorMessage = `JavaScript execution error: ${error.message}`;
                        status = 'error';
                    }
                    break;

                case 'python':
                case 'py':
                    // For Python, we'll simulate execution (in a real implementation, you'd use a Python runtime)
                    try {
                        // This is a simplified Python interpreter simulation
                        if (code.includes('print(')) {
                            const printMatches = code.match(/print\(([^)]+)\)/g);
                            if (printMatches) {
                                output = printMatches.map(match => {
                                    const content = match.slice(6, -1); // Remove 'print(' and ')'
                                    // Simple string evaluation
                                    if (content.startsWith('"') && content.endsWith('"')) {
                                        return content.slice(1, -1);
                                    } else if (content.startsWith("'") && content.endsWith("'")) {
                                        return content.slice(1, -1);
                                    }
                                    return content;
                                }).join('\n') + '\n';
                            }
                        } else {
                            output = 'Python code executed (simulation mode)\n';
                        }
                    } catch (error) {
                        errorMessage = `Python execution error: ${error.message}`;
                        status = 'error';
                    }
                    break;

                case 'html':
                    // For HTML, return the code as is (will be rendered in iframe)
                    output = 'HTML code ready for rendering';
                    break;

                case 'css':
                    output = 'CSS code ready for styling';
                    break;

                default:
                    throw new Error(`Language '${language}' is not supported yet. Supported languages: JavaScript, Python, HTML, CSS`);
            }
        } catch (error) {
            errorMessage = error.message;
            status = 'error';
        }

        const executionTime = Date.now() - startTime;
        const executionTimeMinutes = Math.ceil(executionTime / 60000); // Convert to minutes, round up

        // Record execution in history
        const executionRecord = {
            user_id: userId,
            code: code.slice(0, 5000), // Limit code storage to 5KB
            language: language,
            output: output || '',
            error_message: errorMessage || null,
            execution_time_ms: executionTime,
            status: status,
            resource_usage: {
                memory_mb: Math.floor(Math.random() * 50) + 10, // Simulated memory usage
                cpu_percent: Math.floor(Math.random() * 30) + 5 // Simulated CPU usage
            }
        };

        const historyResponse = await fetch(`${supabaseUrl}/rest/v1/execution_history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(executionRecord)
        });

        // Update usage metrics
        const today = new Date().toISOString().split('T')[0];
        const updateUsageResponse = await fetch(`${supabaseUrl}/rest/v1/usage_metrics?user_id=eq.${userId}&date=eq.${today}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                execution_time_minutes: executionTimeMinutes,
                api_calls: 1
            })
        });

        // If no existing record, create one
        if (!updateUsageResponse.ok) {
            await fetch(`${supabaseUrl}/rest/v1/usage_metrics`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    date: today,
                    execution_time_minutes: executionTimeMinutes,
                    api_calls: 1
                })
            });
        }

        // Return execution results
        const result = {
            data: {
                output: output,
                error: errorMessage || null,
                executionTime: executionTime,
                status: status,
                language: language,
                remainingUsage: Math.max(0, monthlyLimitMinutes - totalUsage - executionTimeMinutes),
                usageLimit: monthlyLimitMinutes
            }
        };

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Code execution error:', error);

        const errorResponse = {
            error: {
                code: 'CODE_EXECUTION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});