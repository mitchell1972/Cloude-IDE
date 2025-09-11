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
        const { action, projectId, projectData, fileData, fileId, folderId } = await req.json();

        if (!action) {
            throw new Error('Action parameter is required');
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

        let result;

        switch (action) {
            case 'create_project':
                result = await createProject(supabaseUrl, serviceRoleKey, userId, projectData);
                break;
            
            case 'update_project':
                result = await updateProject(supabaseUrl, serviceRoleKey, userId, projectId, projectData);
                break;
            
            case 'delete_project':
                result = await deleteProject(supabaseUrl, serviceRoleKey, userId, projectId);
                break;
            
            case 'get_projects':
                result = await getProjects(supabaseUrl, serviceRoleKey, userId);
                break;
            
            case 'get_project':
                result = await getProject(supabaseUrl, serviceRoleKey, userId, projectId);
                break;
            
            case 'create_file':
                result = await createFile(supabaseUrl, serviceRoleKey, userId, projectId, fileData);
                break;
            
            case 'update_file':
                result = await updateFile(supabaseUrl, serviceRoleKey, userId, fileId, fileData);
                break;
            
            case 'delete_file':
                result = await deleteFile(supabaseUrl, serviceRoleKey, userId, fileId);
                break;
            
            case 'get_files':
                result = await getFiles(supabaseUrl, serviceRoleKey, userId, projectId, folderId);
                break;
            
            case 'create_folder':
                result = await createFolder(supabaseUrl, serviceRoleKey, userId, projectId, fileData);
                break;
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Project management error:', error);

        const errorResponse = {
            error: {
                code: 'PROJECT_MANAGEMENT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Project management functions
async function createProject(supabaseUrl: string, serviceRoleKey: string, userId: string, projectData: any) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_projects`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            name: projectData.name,
            description: projectData.description || '',
            user_id: userId,
            language: projectData.language || 'python',
            framework: projectData.framework || 'pytest',
            settings: projectData.settings || {},
            is_public: projectData.isPublic || false
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create project: ${errorText}`);
    }

    const project = await response.json();
    return project[0];
}

async function updateProject(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string, projectData: any) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?id=eq.${projectId}&user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            name: projectData.name,
            description: projectData.description,
            settings: projectData.settings,
            is_public: projectData.isPublic,
            updated_at: new Date().toISOString()
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update project: ${errorText}`);
    }

    const project = await response.json();
    return project[0];
}

async function deleteProject(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string) {
    // First delete all files in the project
    await fetch(`${supabaseUrl}/rest/v1/sdet_files?project_id=eq.${projectId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    // Then delete the project
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?id=eq.${projectId}&user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete project: ${errorText}`);
    }

    return { success: true };
}

async function getProjects(supabaseUrl: string, serviceRoleKey: string, userId: string) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?user_id=eq.${userId}&order=updated_at.desc`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get projects: ${errorText}`);
    }

    return await response.json();
}

async function getProject(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?id=eq.${projectId}&user_id=eq.${userId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get project: ${errorText}`);
    }

    const projects = await response.json();
    return projects[0] || null;
}

// File management functions
async function createFile(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string, fileData: any) {
    // Determine if this is a folder or file
    const isFolder = fileData.fileType === 'folder';
    const fileType = isFolder ? 'folder' : (fileData.language || getFileTypeFromExtension(fileData.name));
    
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            project_id: projectId,
            user_id: userId,
            name: fileData.name,
            path: fileData.path || fileData.name,
            content: isFolder ? null : (fileData.content || ''),
            file_type: fileType,
            parent_folder_id: fileData.parentId || null,
            is_folder: isFolder,
            is_test_file: fileData.name.includes('test') || fileData.name.includes('spec'),
            size_bytes: isFolder ? 0 : (fileData.content ? new Blob([fileData.content]).size : 0)
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create file: ${errorText}`);
    }

    const file = await response.json();
    return file[0];
}

async function updateFile(supabaseUrl: string, serviceRoleKey: string, userId: string, fileId: string, fileData: any) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_files?id=eq.${fileId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            name: fileData.name,
            content: fileData.content,
            language: fileData.language,
            updated_at: new Date().toISOString()
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update file: ${errorText}`);
    }

    const file = await response.json();
    return file[0];
}

async function deleteFile(supabaseUrl: string, serviceRoleKey: string, userId: string, fileId: string) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_files?id=eq.${fileId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete file: ${errorText}`);
    }

    return { success: true };
}

async function getFiles(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string, parentId?: string) {
    let url = `${supabaseUrl}/rest/v1/sdet_files?project_id=eq.${projectId}&order=is_folder.desc,name.asc`;
    
    if (parentId) {
        url += `&parent_folder_id=eq.${parentId}`;
    } else {
        url += `&parent_folder_id=is.null`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get files: ${errorText}`);
    }

    return await response.json();
}

async function createFolder(supabaseUrl: string, serviceRoleKey: string, userId: string, projectId: string, folderData: any) {
    const response = await fetch(`${supabaseUrl}/rest/v1/sdet_files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            project_id: projectId,
            user_id: userId,
            name: folderData.name,
            path: folderData.path || folderData.name,
            file_type: 'folder',
            parent_folder_id: folderData.parentId || null,
            is_folder: true,
            is_test_file: false,
            content: null,
            size_bytes: 0
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create folder: ${errorText}`);
    }

    const folder = await response.json();
    return folder[0];
}

// Helper function to determine file type from extension
function getFileTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'py': return 'python';
        case 'js': return 'javascript';
        case 'ts': return 'typescript';
        case 'java': return 'java';
        case 'json': return 'json';
        case 'html': return 'html';
        case 'css': return 'css';
        case 'md': return 'markdown';
        case 'yaml': case 'yml': return 'yaml';
        case 'xml': return 'xml';
        case 'txt': return 'text';
        default: return 'text';
    }
}