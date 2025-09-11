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
        const url = new URL(req.url);
        const method = req.method;
        const body = method !== 'GET' ? await req.json() : null;

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!serviceRoleKey || !supabaseUrl || !anonKey) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header with improved validation
        let authHeader = req.headers.get('authorization');
        
        // Also check for Authorization header (capital A)
        if (!authHeader) {
            authHeader = req.headers.get('Authorization');
        }
        
        // Check if we have the supabase auth headers
        if (!authHeader) {
            // Try getting from other headers that supabase might use
            const apiKey = req.headers.get('apikey');
            if (apiKey === anonKey) {
                // This is a valid anon request, but we still need user auth
                throw new Error('User authentication required');
            }
            throw new Error('Authentication required');
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Validate the JWT token using the anon key instead of service role
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        });

        if (!userResponse.ok) {
            console.error('Auth validation failed:', userResponse.status, await userResponse.text());
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;
        
        if (!userId) {
            throw new Error('User ID not found in token');
        }

        // Parse action from request body or URL parameters
        const action = body?.action || url.searchParams.get('action');

        let result;

        switch (action) {
            case 'create-project':
                const { name, description, template = 'blank', isPublic = false } = body;
                if (!name) throw new Error('Project name is required');

                const projectData = {
                    name,
                    description: description || '',
                    user_id: userId,
                    is_public: isPublic,
                    template_type: template,
                    share_token: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const createResponse = await fetch(`${supabaseUrl}/rest/v1/projects`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(projectData)
                });

                if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    console.error('Project creation failed:', createResponse.status, errorText);
                    throw new Error(`Failed to create project: ${errorText}`);
                }

                const projectResult = await createResponse.json();
                result = { data: Array.isArray(projectResult) ? projectResult[0] : projectResult };
                break;

            case 'get-projects':
                const projectsResponse = await fetch(`${supabaseUrl}/rest/v1/projects?user_id=eq.${userId}&order=created_at.desc`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!projectsResponse.ok) {
                    throw new Error('Failed to fetch projects');
                }

                const projects = await projectsResponse.json();
                result = { data: projects };
                break;

            case 'save-file':
                const { projectId, filePath, content, fileType, isFolder = false, parentFolderId = null } = body;
                if (!projectId || !filePath) throw new Error('Project ID and file path are required');

                // Check if user owns the project or has access
                const projectCheckResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const projectCheck = await projectCheckResponse.json();
                if (!projectCheck || projectCheck.length === 0) {
                    throw new Error('Project not found or access denied');
                }

                // Check if file already exists
                const existingFileResponse = await fetch(`${supabaseUrl}/rest/v1/files?project_id=eq.${projectId}&path=eq.${filePath}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const existingFiles = await existingFileResponse.json();
                const fileData = {
                    project_id: projectId,
                    name: filePath.split('/').pop(),
                    path: filePath,
                    content: content || '',
                    file_type: fileType || 'text',
                    size_bytes: content ? new Blob([content]).size : 0,
                    user_id: userId,
                    is_folder: isFolder,
                    parent_folder_id: parentFolderId,
                    updated_at: new Date().toISOString()
                };

                let fileResponse;
                if (existingFiles && existingFiles.length > 0) {
                    // Update existing file
                    fileResponse = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${existingFiles[0].id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(fileData)
                    });
                } else {
                    // Create new file
                    fileResponse = await fetch(`${supabaseUrl}/rest/v1/files`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(fileData)
                    });
                }

                if (!fileResponse.ok) {
                    throw new Error('Failed to save file');
                }

                const file = await fileResponse.json();
                result = { data: file[0] || file };
                break;

            case 'get-files':
                const { project_id } = url.searchParams.get('project_id') ? { project_id: url.searchParams.get('project_id') } : body;
                if (!project_id) throw new Error('Project ID is required');

                // Check project access
                const projectAccessResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${project_id}&user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const projectAccess = await projectAccessResponse.json();
                if (!projectAccess || projectAccess.length === 0) {
                    throw new Error('Project not found or access denied');
                }

                const filesResponse = await fetch(`${supabaseUrl}/rest/v1/files?project_id=eq.${project_id}&order=created_at.asc`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!filesResponse.ok) {
                    throw new Error('Failed to fetch files');
                }

                const files = await filesResponse.json();
                result = { data: files };
                break;

            case 'delete-file':
                const { fileId } = body;
                if (!fileId) throw new Error('File ID is required');

                // Check file ownership
                const fileOwnerResponse = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}&user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const fileOwner = await fileOwnerResponse.json();
                if (!fileOwner || fileOwner.length === 0) {
                    throw new Error('File not found or access denied');
                }

                const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to delete file');
                }

                result = { data: { success: true, message: 'File deleted successfully' } };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('File management error:', error);

        const errorResponse = {
            error: {
                code: 'FILE_MANAGEMENT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});