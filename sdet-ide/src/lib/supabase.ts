import { createClient } from '@supabase/supabase-js'
import { javaExecutionService } from './javaExecutionService';

const supabaseUrl = "https://zjfilhbczaquokqlcoej.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmlsaGJjemFxdW9rcWxjb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzQ2MjIsImV4cCI6MjA3MTExMDYyMn0.b6YATor8UyDwYSiSagOQUxM_4sqfCv-89CBXVgC2hP0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test frameworks configuration
export const TEST_FRAMEWORKS = [
  {
    id: 'pytest',
    name: 'pytest',
    language: 'python',
    description: 'Python testing framework with fixtures, parametrization, and plugins',
    extensions: ['.py'],
    icon: '🐍'
  },
  {
    id: 'jest',
    name: 'Jest',
    language: 'javascript',
    description: 'JavaScript testing framework with mocking, snapshots, and coverage',
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
    icon: '🃏'
  },
  {
    id: 'junit',
    name: 'JUnit',
    language: 'java',
    description: 'Java testing framework with annotations and assertions',
    extensions: ['.java'],
    icon: '☕'
  }
];

// Helper functions for edge function calls
export async function executeTest(projectId: string, testCode: string, framework: string, files: any[] = [], isTest: boolean = true) {
  // Determine if this is Java code by checking multiple indicators
  const isJavaCode = framework === 'junit' || 
                     (files.length > 0 && files[0].language === 'java') || 
                     testCode.includes('public class') ||
                     testCode.includes('System.out.println');
  
  // For Java files, try the microservice first
  if (isJavaCode) {
    console.log('Detected Java code - attempting microservice execution');
    
    try {
      const result = await javaExecutionService.executeJavaCode(testCode, {
        timeout: 30000,
        memoryLimit: '256m'
      });
      
      // Transform microservice response to match expected format
      return {
        testRunId: result.executionId || Date.now().toString(),
        success: result.success,
        output: result.success 
          ? result.executionOutput.stdout || 'Program executed successfully'
          : result.error || result.compilationOutput?.stderr || result.executionOutput?.stderr || 'Execution failed',
        executionTime: result.executionTime || 0,
        testsRun: result.success ? 1 : 0,
        testsPassed: result.success ? 1 : 0,
        testsFailed: result.success ? 0 : 1,
        coverage: 0 // Not applicable for regular Java execution
      };
    } catch (error) {
      console.error('Java microservice execution failed, falling back to edge function:', error);
      
      // Fallback to edge function for Java with proper framework setting
      const { data, error: edgeError } = await supabase.functions.invoke('sdet-enhanced-executor', {
        body: {
          projectId,
          testType: isTest ? 'unit' : 'execution',
          testCode,
          framework: 'junit', // Force junit framework for Java code
          files: files.map(f => ({ ...f, language: 'java' })), // Ensure Java language is set
          isTest
        }
      });

      if (edgeError) {
        throw new Error(edgeError.message);
      }

      return data?.data || data;
    }
  }
  
  // For other languages, use the original Supabase edge function
  console.log(`Using Supabase edge function for ${framework} code`);
  
  const { data, error } = await supabase.functions.invoke('sdet-enhanced-executor', {
    body: {
      projectId,
      testType: isTest ? 'unit' : 'execution',
      testCode,
      framework,
      files,
      isTest
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.data || data;
}

export async function manageProject(action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke('sdet-manage-project', {
    body: {
      action,
      ...params
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.data || data;
}

// Export the Java execution service for direct use in components
export { javaExecutionService };