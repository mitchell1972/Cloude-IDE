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
        const { action, projectId, sessionToken, operationData, fileId, userId: providedUserId } = await req.json();

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

        let result;

        switch (action) {
            case 'create-session':
                if (!projectId) throw new Error('Project ID is required');

                // Check if user owns the project
                const projectResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const projects = await projectResponse.json();
                if (!projects || projects.length === 0) {
                    throw new Error('Project not found or access denied');
                }

                // Create collaboration session
                const sessionData = {
                    project_id: projectId,
                    host_user_id: userId,
                    session_token: crypto.randomUUID(),
                    is_active: true,
                    max_participants: 10
                };

                const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_sessions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(sessionData)
                });

                if (!sessionResponse.ok) {
                    throw new Error('Failed to create collaboration session');
                }

                const session = await sessionResponse.json();

                // Add host as participant
                await fetch(`${supabaseUrl}/rest/v1/collaboration_participants`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        session_id: session[0].id,
                        user_id: userId,
                        is_active: true
                    })
                });

                result = { data: session[0] };
                break;

            case 'join-session':
                if (!sessionToken) throw new Error('Session token is required');

                // Find active session
                const joinSessionResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_sessions?session_token=eq.${sessionToken}&is_active=eq.true`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const sessions = await joinSessionResponse.json();
                if (!sessions || sessions.length === 0) {
                    throw new Error('Session not found or inactive');
                }

                const activeSession = sessions[0];

                // Check participant count
                const participantsResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_participants?session_id=eq.${activeSession.id}&is_active=eq.true`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const participants = await participantsResponse.json();
                if (participants && participants.length >= activeSession.max_participants) {
                    throw new Error('Session is full');
                }

                // Check if user is already in session
                const existingParticipant = participants.find(p => p.user_id === userId);
                if (!existingParticipant) {
                    // Add user as participant
                    await fetch(`${supabaseUrl}/rest/v1/collaboration_participants`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            session_id: activeSession.id,
                            user_id: userId,
                            is_active: true
                        })
                    });
                }

                result = {
                    data: {
                        session: activeSession,
                        participants: participants.length + (existingParticipant ? 0 : 1)
                    }
                };
                break;

            case 'record-edit':
                if (!sessionToken || !operationData || !fileId) {
                    throw new Error('Session token, operation data, and file ID are required');
                }

                // Verify session and participant
                const editSessionResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_sessions?session_token=eq.${sessionToken}&is_active=eq.true`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const editSessions = await editSessionResponse.json();
                if (!editSessions || editSessions.length === 0) {
                    throw new Error('Session not found or inactive');
                }

                const editSession = editSessions[0];

                // Verify participant
                const participantResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_participants?session_id=eq.${editSession.id}&user_id=eq.${userId}&is_active=eq.true`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const participantCheck = await participantResponse.json();
                if (!participantCheck || participantCheck.length === 0) {
                    throw new Error('User is not a participant in this session');
                }

                // Record the edit
                const editData = {
                    session_id: editSession.id,
                    user_id: userId,
                    file_id: fileId,
                    operation_type: operationData.type || 'text-edit',
                    operation_data: operationData,
                    cursor_position: operationData.cursorPosition || 0
                };

                const editResponse = await fetch(`${supabaseUrl}/rest/v1/real_time_edits`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(editData)
                });

                if (!editResponse.ok) {
                    throw new Error('Failed to record edit operation');
                }

                const edit = await editResponse.json();
                result = { data: edit[0] };
                break;

            case 'get-recent-edits':
                if (!sessionToken) throw new Error('Session token is required');

                // Get session
                const recentSessionResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_sessions?session_token=eq.${sessionToken}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const recentSessions = await recentSessionResponse.json();
                if (!recentSessions || recentSessions.length === 0) {
                    throw new Error('Session not found');
                }

                const recentSession = recentSessions[0];

                // Get recent edits (last 100)
                const recentEditsResponse = await fetch(`${supabaseUrl}/rest/v1/real_time_edits?session_id=eq.${recentSession.id}&order=created_at.desc&limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!recentEditsResponse.ok) {
                    throw new Error('Failed to fetch recent edits');
                }

                const recentEdits = await recentEditsResponse.json();
                result = { data: recentEdits.reverse() }; // Reverse to get chronological order
                break;

            case 'leave-session':
                if (!sessionToken) throw new Error('Session token is required');

                // Find session
                const leaveSessionResponse = await fetch(`${supabaseUrl}/rest/v1/collaboration_sessions?session_token=eq.${sessionToken}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const leaveSessions = await leaveSessionResponse.json();
                if (leaveSessions && leaveSessions.length > 0) {
                    const leaveSession = leaveSessions[0];

                    // Mark participant as inactive
                    await fetch(`${supabaseUrl}/rest/v1/collaboration_participants?session_id=eq.${leaveSession.id}&user_id=eq.${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            is_active: false,
                            left_at: new Date().toISOString()
                        })
                    });
                }

                result = { data: { success: true, message: 'Left session successfully' } };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Collaboration error:', error);

        const errorResponse = {
            error: {
                code: 'COLLABORATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});