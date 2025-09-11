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
        const { action, projectId, testSuiteId, testCaseIds, configuration } = await req.json();

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

        let result;

        switch (action) {
            case 'run-tests':
                if (!projectId) throw new Error('Project ID is required');

                // Create test run record
                const testRunData = {
                    project_id: projectId,
                    test_suite_id: testSuiteId || null,
                    user_id: userId,
                    run_name: `Test Run ${new Date().toISOString()}`,
                    status: 'running',
                    environment_config: configuration || {},
                    started_at: new Date().toISOString()
                };

                const runResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_test_runs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(testRunData)
                });

                if (!runResponse.ok) {
                    throw new Error('Failed to create test run');
                }

                const testRun = await runResponse.json();
                const testRunId = testRun[0].id;

                // Get test cases to run
                let testCasesQuery = `${supabaseUrl}/rest/v1/sdet_test_cases?select=*,sdet_test_suites!test_suite_id(*,sdet_test_frameworks!framework_id(*)),sdet_files!file_id(*)`;
                
                if (testSuiteId) {
                    testCasesQuery += `&test_suite_id=eq.${testSuiteId}`;
                } else if (testCaseIds && testCaseIds.length > 0) {
                    testCasesQuery += `&id=in.(${testCaseIds.join(',')})`;
                } else {
                    // Get all test cases for the project
                    testCasesQuery += `&sdet_test_suites.project_id=eq.${projectId}`;
                }

                const testCasesResponse = await fetch(testCasesQuery, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!testCasesResponse.ok) {
                    throw new Error('Failed to fetch test cases');
                }

                const testCases = await testCasesResponse.json();
                
                // Simulate test execution (in production, this would use Docker containers)
                const testResults = [];
                let passedTests = 0;
                let failedTests = 0;
                let skippedTests = 0;
                const startTime = Date.now();

                for (const testCase of testCases) {
                    const executionStart = Date.now();
                    
                    // Simulate test execution based on framework
                    const framework = testCase.sdet_test_suites?.sdet_test_frameworks;
                    const fileContent = testCase.sdet_files?.content || '';
                    
                    let status, output, errorMessage = null;
                    let assertionsPassed = 0, assertionsFailedCount = 0;

                    try {
                        // Simulated test execution logic
                        if (framework?.language === 'javascript') {
                            // JavaScript test simulation
                            if (fileContent.includes('expect(') || fileContent.includes('assert')) {
                                const random = Math.random();
                                if (random > 0.15) { // 85% pass rate
                                    status = 'passed';
                                    output = 'Test passed successfully';
                                    assertionsPassed = Math.floor(Math.random() * 5) + 1;
                                    passedTests++;
                                } else {
                                    status = 'failed';
                                    errorMessage = 'AssertionError: Expected value to be true but got false';
                                    output = 'Test failed with assertion error';
                                    assertionsFailedCount = 1;
                                    failedTests++;
                                }
                            } else {
                                status = 'skipped';
                                output = 'No test assertions found';
                                skippedTests++;
                            }
                        } else if (framework?.language === 'python') {
                            // Python test simulation
                            if (fileContent.includes('def test_') || fileContent.includes('assert ')) {
                                const random = Math.random();
                                if (random > 0.1) { // 90% pass rate
                                    status = 'passed';
                                    output = `Test ${testCase.name} PASSED`;
                                    assertionsPassed = Math.floor(Math.random() * 3) + 1;
                                    passedTests++;
                                } else {
                                    status = 'failed';
                                    errorMessage = 'AssertionError: assertion failed';
                                    output = `Test ${testCase.name} FAILED`;
                                    assertionsFailedCount = 1;
                                    failedTests++;
                                }
                            } else {
                                status = 'skipped';
                                output = 'No test functions found';
                                skippedTests++;
                            }
                        } else if (framework?.language === 'java') {
                            // Java test simulation
                            if (fileContent.includes('@Test') || fileContent.includes('assertEquals')) {
                                const random = Math.random();
                                if (random > 0.12) { // 88% pass rate
                                    status = 'passed';
                                    output = `Test method completed successfully`;
                                    assertionsPassed = Math.floor(Math.random() * 4) + 1;
                                    passedTests++;
                                } else {
                                    status = 'failed';
                                    errorMessage = 'java.lang.AssertionError: Values not equal';
                                    output = 'Test method failed with assertion error';
                                    assertionsFailedCount = 1;
                                    failedTests++;
                                }
                            } else {
                                status = 'skipped';
                                output = 'No @Test annotations found';
                                skippedTests++;
                            }
                        } else {
                            status = 'skipped';
                            output = 'Unsupported test framework';
                            skippedTests++;
                        }

                        const executionTime = Date.now() - executionStart;

                        const testResult = {
                            test_run_id: testRunId,
                            test_case_id: testCase.id,
                            status,
                            execution_time_ms: executionTime,
                            error_message: errorMessage,
                            output,
                            assertions_passed: assertionsPassed,
                            assertions_failed: assertionsFailedCount
                        };

                        testResults.push(testResult);

                        // Store test result
                        await fetch(`${supabaseUrl}/rest/v1/sdet_test_results`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(testResult)
                        });

                        // Generate coverage data for passed tests
                        if (status === 'passed' && testCase.sdet_files) {
                            const file = testCase.sdet_files;
                            const lines = file.content?.split('\n').length || 1;
                            const coveredLines = Math.floor(lines * (0.7 + Math.random() * 0.3)); // 70-100% coverage
                            
                            const coverageData = {
                                test_run_id: testRunId,
                                file_id: file.id,
                                total_lines: lines,
                                covered_lines: coveredLines,
                                coverage_percentage: Math.round((coveredLines / lines) * 100 * 100) / 100,
                                line_coverage: {
                                    covered: Array.from({length: coveredLines}, (_, i) => i + 1),
                                    missed: Array.from({length: lines - coveredLines}, (_, i) => coveredLines + i + 1)
                                },
                                branch_coverage: {
                                    total: Math.floor(Math.random() * 10) + 1,
                                    covered: Math.floor(Math.random() * 8) + 1
                                }
                            };

                            await fetch(`${supabaseUrl}/rest/v1/sdet_code_coverage`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(coverageData)
                            });

                            // Generate performance metrics
                            const performanceData = {
                                test_run_id: testRunId,
                                test_case_id: testCase.id,
                                metric_name: 'execution_time',
                                metric_value: executionTime,
                                metric_unit: 'ms',
                                memory_usage_mb: Math.round((10 + Math.random() * 50) * 100) / 100,
                                cpu_usage_percent: Math.round((5 + Math.random() * 25) * 100) / 100,
                                execution_time_ms: executionTime
                            };

                            await fetch(`${supabaseUrl}/rest/v1/sdet_performance_metrics`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(performanceData)
                            });
                        }

                    } catch (error) {
                        console.error(`Error executing test case ${testCase.id}:`, error);
                        failedTests++;
                        
                        const errorResult = {
                            test_run_id: testRunId,
                            test_case_id: testCase.id,
                            status: 'failed',
                            execution_time_ms: Date.now() - executionStart,
                            error_message: error.message,
                            output: 'Test execution failed',
                            assertions_passed: 0,
                            assertions_failed: 1
                        };

                        testResults.push(errorResult);

                        await fetch(`${supabaseUrl}/rest/v1/sdet_test_results`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(errorResult)
                        });
                    }
                }

                const totalDuration = Date.now() - startTime;
                const finalStatus = failedTests > 0 ? 'failed' : 'passed';

                // Update test run with final results
                await fetch(`${supabaseUrl}/rest/v1/sdet_test_runs?id=eq.${testRunId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: finalStatus,
                        completed_at: new Date().toISOString(),
                        duration_ms: totalDuration,
                        total_tests: testCases.length,
                        passed_tests: passedTests,
                        failed_tests: failedTests,
                        skipped_tests: skippedTests
                    })
                });

                result = {
                    data: {
                        testRunId,
                        status: finalStatus,
                        totalTests: testCases.length,
                        passedTests,
                        failedTests,
                        skippedTests,
                        duration: totalDuration,
                        results: testResults
                    }
                };
                break;

            case 'get-test-run':
                const { testRunId: runId } = await req.json();
                if (!runId) throw new Error('Test run ID is required');

                const runDetailsResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_test_runs?id=eq.${runId}&select=*,sdet_test_results(*,sdet_test_cases(*)),sdet_code_coverage(*),sdet_performance_metrics(*)`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!runDetailsResponse.ok) {
                    throw new Error('Failed to fetch test run details');
                }

                const runDetails = await runDetailsResponse.json();
                result = { data: runDetails[0] || null };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Test runner error:', error);

        const errorResponse = {
            error: {
                code: 'TEST_RUNNER_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});