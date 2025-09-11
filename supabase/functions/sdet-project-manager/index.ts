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

        const pathSegments = url.pathname.split('/').filter(Boolean);
        const action = pathSegments[pathSegments.length - 1] || url.searchParams.get('action');

        let result;

        switch (action) {
            case 'create-project':
                const { name, description, language, framework, template = 'blank' } = body;
                if (!name || !language) throw new Error('Project name and language are required');

                const projectData = {
                    name,
                    description: description || '',
                    user_id: userId,
                    language,
                    framework: framework || null,
                    is_public: false,
                    share_token: crypto.randomUUID()
                };

                const createResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_projects`, {
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
                    throw new Error('Failed to create project');
                }

                const project = await createResponse.json();
                
                // Create initial project structure based on language and template
                const initialFiles = getInitialProjectFiles(language, framework, template);
                
                for (const file of initialFiles) {
                    const fileData = {
                        project_id: project[0].id,
                        name: file.name,
                        path: file.path,
                        content: file.content,
                        file_type: file.fileType,
                        size_bytes: new Blob([file.content]).size,
                        user_id: userId,
                        is_folder: file.isFolder || false,
                        is_test_file: file.isTestFile || false,
                        parent_folder_id: null
                    };

                    await fetch(`${supabaseUrl}/rest/v1/sdet_files`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(fileData)
                    });
                }

                result = { data: project[0] };
                break;

            case 'get-projects':
                const projectsResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?user_id=eq.${userId}&order=created_at.desc`, {
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

            case 'get-project-details':
                const projectId = url.searchParams.get('project_id') || body?.projectId;
                if (!projectId) throw new Error('Project ID is required');

                // Get project with files, test suites, and recent test runs
                const detailsResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?id=eq.${projectId}&user_id=eq.${userId}&select=*,sdet_files(*),sdet_test_suites(*,sdet_test_frameworks(*)),sdet_test_runs(*)`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!detailsResponse.ok) {
                    throw new Error('Failed to fetch project details');
                }

                const projectDetails = await detailsResponse.json();
                if (!projectDetails || projectDetails.length === 0) {
                    throw new Error('Project not found or access denied');
                }

                result = { data: projectDetails[0] };
                break;

            case 'save-file':
                const { projectId: projId, filePath, content, fileType, isFolder = false, isTestFile = false, parentFolderId = null } = body;
                if (!projId || !filePath) throw new Error('Project ID and file path are required');

                // Check project ownership
                const projectCheckResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_projects?id=eq.${projId}&user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const projectCheck = await projectCheckResponse.json();
                if (!projectCheck || projectCheck.length === 0) {
                    throw new Error('Project not found or access denied');
                }

                // Check if file exists
                const existingFileResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_files?project_id=eq.${projId}&path=eq.${filePath}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const existingFiles = await existingFileResponse.json();
                const fileData = {
                    project_id: projId,
                    name: filePath.split('/').pop(),
                    path: filePath,
                    content: content || '',
                    file_type: fileType || detectFileType(filePath),
                    size_bytes: content ? new Blob([content]).size : 0,
                    user_id: userId,
                    is_folder: isFolder,
                    is_test_file: isTestFile || detectTestFile(filePath),
                    parent_folder_id: parentFolderId,
                    updated_at: new Date().toISOString()
                };

                let fileResponse;
                if (existingFiles && existingFiles.length > 0) {
                    // Update existing file
                    fileResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_files?id=eq.${existingFiles[0].id}`, {
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
                    fileResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_files`, {
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

            case 'get-test-frameworks':
                const frameworksResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_test_frameworks?is_active=eq.true&order=language,name`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!frameworksResponse.ok) {
                    throw new Error('Failed to fetch test frameworks');
                }

                const frameworks = await frameworksResponse.json();
                result = { data: frameworks };
                break;

            case 'create-test-suite':
                const { projectId: testProjId, name: suiteName, description: suiteDesc, frameworkId, configuration: suiteConfig } = body;
                if (!testProjId || !suiteName || !frameworkId) {
                    throw new Error('Project ID, suite name, and framework ID are required');
                }

                const testSuiteData = {
                    project_id: testProjId,
                    name: suiteName,
                    description: suiteDesc || '',
                    framework_id: frameworkId,
                    configuration: suiteConfig || {},
                    is_active: true
                };

                const suiteResponse = await fetch(`${supabaseUrl}/rest/v1/sdet_test_suites`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(testSuiteData)
                });

                if (!suiteResponse.ok) {
                    throw new Error('Failed to create test suite');
                }

                const testSuite = await suiteResponse.json();
                result = { data: testSuite[0] };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Project manager error:', error);

        const errorResponse = {
            error: {
                code: 'PROJECT_MANAGER_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Helper functions
function getInitialProjectFiles(language, framework, template) {
    const files = [];
    
    switch (language) {
        case 'python':
            files.push({
                name: 'main.py',
                path: 'main.py',
                content: '# Welcome to your Python SDET project\nprint("Hello, World!")\n',
                fileType: 'python',
                isTestFile: false
            });
            
            if (framework === 'pytest') {
                files.push({
                    name: 'test_main.py',
                    path: 'tests/test_main.py',
                    content: 'import pytest\n\ndef test_hello_world():\n    """Test the hello world functionality"""\n    expected = "Hello, World!"\n    result = "Hello, World!"\n    assert result == expected\n\ndef test_addition():\n    """Test basic addition"""\n    assert 2 + 2 == 4\n',
                    fileType: 'python',
                    isTestFile: true
                });
                files.push({
                    name: 'pytest.ini',
                    path: 'pytest.ini',
                    content: '[tool:pytest]\ntestpaths = tests\npython_files = test_*.py\npython_classes = Test*\npython_functions = test_*\n',
                    fileType: 'ini',
                    isTestFile: false
                });
            }
            break;
            
        case 'javascript':
            files.push({
                name: 'main.js',
                path: 'src/main.js',
                content: '// Welcome to your JavaScript SDET project\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n\nfunction add(a, b) {\n    return a + b;\n}\n\nmodule.exports = { greet, add };\n',
                fileType: 'javascript',
                isTestFile: false
            });
            
            if (framework === 'Jest') {
                files.push({
                    name: 'main.test.js',
                    path: 'tests/main.test.js',
                    content: 'const { greet, add } = require(\'../src/main\');\n\ndescribe(\'Main functionality\', () => {\n    test(\'should greet user correctly\', () => {\n        expect(greet(\'World\')).toBe(\'Hello, World!\');\n    });\n\n    test(\'should add two numbers\', () => {\n        expect(add(2, 3)).toBe(5);\n    });\n\n    test(\'should handle edge cases\', () => {\n        expect(add(0, 0)).toBe(0);\n        expect(add(-1, 1)).toBe(0);\n    });\n});\n',
                    fileType: 'javascript',
                    isTestFile: true
                });
                files.push({
                    name: 'package.json',
                    path: 'package.json',
                    content: '{\n  "name": "sdet-project",\n  "version": "1.0.0",\n  "scripts": {\n    "test": "jest",\n    "test:watch": "jest --watch",\n    "test:coverage": "jest --coverage"\n  },\n  "devDependencies": {\n    "jest": "^29.0.0"\n  }\n}\n',
                    fileType: 'json',
                    isTestFile: false
                });
            }
            break;
            
        case 'java':
            files.push({
                name: 'Main.java',
                path: 'src/main/java/Main.java',
                content: '// Welcome to your Java SDET project\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n\n    public static String greet(String name) {\n        return "Hello, " + name + "!";\n    }\n\n    public static int add(int a, int b) {\n        return a + b;\n    }\n}\n',
                fileType: 'java',
                isTestFile: false
            });
            
            if (framework === 'JUnit 5') {
                files.push({
                    name: 'MainTest.java',
                    path: 'src/test/java/MainTest.java',
                    content: 'import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\npublic class MainTest {\n\n    @Test\n    void testGreet() {\n        String result = Main.greet("World");\n        assertEquals("Hello, World!", result);\n    }\n\n    @Test\n    void testAdd() {\n        int result = Main.add(2, 3);\n        assertEquals(5, result);\n    }\n\n    @Test\n    void testAddEdgeCases() {\n        assertEquals(0, Main.add(0, 0));\n        assertEquals(0, Main.add(-1, 1));\n    }\n}\n',
                    fileType: 'java',
                    isTestFile: true
                });
            }
            break;
            
        case 'cpp':
            files.push({
                name: 'main.cpp',
                path: 'src/main.cpp',
                content: '#include <iostream>\n#include <string>\n\nstd::string greet(const std::string& name) {\n    return "Hello, " + name + "!";\n}\n\nint add(int a, int b) {\n    return a + b;\n}\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
                fileType: 'cpp',
                isTestFile: false
            });
            
            if (framework === 'Google Test') {
                files.push({
                    name: 'test_main.cpp',
                    path: 'tests/test_main.cpp',
                    content: '#include <gtest/gtest.h>\n#include "../src/main.cpp"\n\nTEST(MainTest, GreetTest) {\n    std::string result = greet("World");\n    EXPECT_EQ(result, "Hello, World!");\n}\n\nTEST(MainTest, AddTest) {\n    int result = add(2, 3);\n    EXPECT_EQ(result, 5);\n}\n\nTEST(MainTest, AddEdgeCases) {\n    EXPECT_EQ(add(0, 0), 0);\n    EXPECT_EQ(add(-1, 1), 0);\n}\n\nint main(int argc, char **argv) {\n    ::testing::InitGoogleTest(&argc, argv);\n    return RUN_ALL_TESTS();\n}\n',
                    fileType: 'cpp',
                    isTestFile: true
                });
            }
            break;
    }
    
    return files;
}

function detectFileType(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
        'py': 'python',
        'js': 'javascript',
        'ts': 'typescript',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'header',
        'hpp': 'header',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'xml': 'xml',
        'yml': 'yaml',
        'yaml': 'yaml',
        'md': 'markdown',
        'ini': 'ini',
        'txt': 'text'
    };
    return typeMap[extension] || 'text';
}

function detectTestFile(filePath) {
    const fileName = filePath.toLowerCase();
    return fileName.includes('test') || fileName.includes('spec') || fileName.startsWith('test_') || fileName.endsWith('_test.py') || fileName.endsWith('.test.js') || fileName.endsWith('.spec.js') || fileName.endsWith('Test.java');
}