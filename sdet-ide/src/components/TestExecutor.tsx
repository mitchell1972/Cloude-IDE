import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { executeTest, TEST_FRAMEWORKS, javaExecutionService } from '../lib/supabase';
import { Play, Square, RotateCcw, Clock, CheckCircle, XCircle, AlertCircle, BarChart3, Wifi, WifiOff, Server } from 'lucide-react';

interface TestResult {
  testRunId: string;
  success: boolean;
  output: string;
  executionTime: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  coverage: number;
}

interface TestExecutorProps {
  projectId: string | null;
  currentFile: FileItem | null;
  testCode: string;
  isTest: boolean;
}

interface FileItem {
  id: string;
  name: string;
  content: string;
  language: string;
  file_type: 'file' | 'folder';
  parent_folder_id: string | null;
  is_folder: boolean;
  is_test_file: boolean;
  path: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface TestExecutorRef {
  executeTest: () => void;
}

export const TestExecutor = forwardRef<TestExecutorRef, TestExecutorProps>(({ projectId, currentFile, testCode, isTest }, ref) => {
  const [selectedFramework, setSelectedFramework] = useState('pytest');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'output' | 'coverage'>('output');
  
  // Microservice status tracking
  const [microserviceStatus, setMicroserviceStatus] = useState<{
    healthy: boolean;
    checking: boolean;
    lastChecked: Date | null;
    error: string | null;
  }>({ healthy: false, checking: false, lastChecked: null, error: null });
  const [showMicroserviceStatus, setShowMicroserviceStatus] = useState(false);

  // Check microservice status when component mounts or when we have a Java file
  useEffect(() => {
    if (currentFile?.language === 'java') {
      checkMicroserviceHealth();
      setShowMicroserviceStatus(true);
    } else {
      setShowMicroserviceStatus(false);
    }
  }, [currentFile?.language]);

  // Auto-detect framework based on current file
  useEffect(() => {
    if (currentFile && currentFile.language) {
      const framework = detectFrameworkFromLanguage(currentFile.language, currentFile.name);
      setSelectedFramework(framework);
    }
  }, [currentFile]);

  // Microservice health check function
  async function checkMicroserviceHealth() {
    setMicroserviceStatus(prev => ({ ...prev, checking: true, error: null }));
    
    try {
      const healthy = await javaExecutionService.checkHealth();
      setMicroserviceStatus({
        healthy,
        checking: false,
        lastChecked: new Date(),
        error: healthy ? null : 'Service is not responding'
      });
    } catch (error) {
      setMicroserviceStatus({
        healthy: false,
        checking: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  function detectFrameworkFromLanguage(language: string, filename: string): string {
    switch (language.toLowerCase()) {
      case 'python':
        return 'pytest';
      case 'javascript':
      case 'typescript':
        return 'jest';
      case 'java':
        return 'junit';
      default:
        // Check filename patterns
        if (filename.endsWith('.py')) return 'pytest';
        if (filename.endsWith('.js') || filename.endsWith('.ts')) return 'jest';
        if (filename.endsWith('.java')) return 'junit';
        return 'pytest'; // default
    }
  }

  function getExecutionButtonText(): string {
    if (!currentFile) return 'Execute';
    
    switch (currentFile.language) {
      case 'java': return 'Run Program';
      case 'python': return 'Run Script';
      case 'javascript':
      case 'typescript': return 'Execute Code';
      default: return 'Run Code';
    }
  }

  async function handleRunTest() {
    if (!projectId || !testCode.trim()) return;

    setIsRunning(true);
    setCurrentResult(null);
    
    try {
      // For Java files, check microservice health first
      if (currentFile?.language === 'java' && !microserviceStatus.healthy) {
        console.warn('Java microservice is not healthy, attempting to check status...');
        await checkMicroserviceHealth();
        
        // If still not healthy after check, warn but proceed (executeTest will handle the fallback)
        if (!microserviceStatus.healthy) {
          console.warn('Java microservice is offline, execution may fall back to error handling');
        }
      }
      
      const result = await executeTest(
        projectId, 
        testCode, 
        selectedFramework, 
        currentFile ? [currentFile] : [],
        isTest
      );
      
      setCurrentResult(result);
      setResults(prev => [result, ...prev.slice(0, 4)]); // Keep last 5 results
    } catch (error) {
      console.error('Execution failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';
      let additionalTips = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error types
        if (errorMessage.includes('Invalid token')) {
          errorMessage = 'Authentication failed. Please refresh the page and try again.';
        } else if (errorMessage.includes('Missing required parameters')) {
          errorMessage = 'Invalid request. Please ensure you have a valid project selected.';
        } else if (errorMessage.includes('Compilation failed') || errorMessage.includes('Compilation Error')) {
          errorMessage = `Compilation Error: ${errorMessage.replace(/^.*Compilation[\s\w]*:?\s*/, '')}`;
          if (currentFile?.language === 'java') {
            additionalTips = '\n\nJava Compilation Tips:\n• Check for missing semicolons\n• Verify class name matches filename\n• Ensure proper method signatures\n• Check for missing imports';
          }
        } else if (errorMessage.includes('non-zero status code') || errorMessage.includes('Execution failed')) {
          errorMessage = 'Execution failed. Please check your code for runtime errors.';
          if (currentFile?.language === 'java') {
            additionalTips = '\n\nJava Execution Tips:\n• Ensure main method signature: public static void main(String[] args)\n• Check for runtime exceptions (NullPointer, ArrayIndexOutOfBounds, etc.)\n• Verify all variables are properly initialized';
          }
        } else if (errorMessage.includes('Cannot connect to Java execution service') || errorMessage.includes('Microservice Error')) {
          errorMessage = 'Java execution service is currently unavailable.';
          additionalTips = '\n\nService Status:\n• The Java execution microservice may not be deployed\n• Network connectivity issues\n• Service temporarily overloaded\n\nPlease try again in a few moments or contact support.';
        } else if (errorMessage.includes('Request timeout')) {
          errorMessage = 'Execution timeout - your code may be taking too long to run.';
          if (currentFile?.language === 'java') {
            additionalTips = '\n\nTimeout Suggestions:\n• Check for infinite loops\n• Reduce computation complexity\n• Remove or optimize long-running operations';
          }
        }
      }
      
      const errorResult: TestResult = {
        testRunId: Date.now().toString(),
        success: false,
        output: `Error: ${errorMessage}${additionalTips}`,
        executionTime: 0,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 1,
        coverage: 0
      };
      setCurrentResult(errorResult);
    } finally {
      setIsRunning(false);
    }
  }

  // Expose executeTest method via ref
  useImperativeHandle(ref, () => ({
    executeTest: handleRunTest
  }));

  function getFrameworkIcon(frameworkId: string) {
    const framework = TEST_FRAMEWORKS.find(f => f.id === frameworkId);
    return framework?.icon || '📄';
  }

  function formatExecutionTime(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function getStatusIcon(result: TestResult) {
    if (result.success) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (result.testsFailed > 0) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  }

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isTest ? 'Test Execution' : 'Code Execution'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunTest}
              disabled={isRunning || !projectId || !testCode.trim()}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${
                  isRunning
                    ? 'bg-orange-100 text-orange-700 cursor-not-allowed'
                    : !projectId || !testCode.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }
              `}
            >
              {isRunning ? (
                <>
                  <Square className="w-4 h-4" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {isTest ? 'Run Tests' : getExecutionButtonText()}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Microservice Status - Show for Java files */}
        {showMicroserviceStatus && (
          <div className="mt-4 p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {microserviceStatus.checking ? (
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  ) : microserviceStatus.healthy ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    Java Execution Service
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  microserviceStatus.checking 
                    ? 'bg-yellow-100 text-yellow-800'
                    : microserviceStatus.healthy 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {microserviceStatus.checking 
                    ? 'Checking...'
                    : microserviceStatus.healthy 
                    ? 'Online'
                    : 'Offline'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                {microserviceStatus.lastChecked && (
                  <span className="text-xs text-gray-500">
                    {microserviceStatus.lastChecked.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={checkMicroserviceHealth}
                  disabled={microserviceStatus.checking}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>
            {microserviceStatus.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                <strong>Error:</strong> {microserviceStatus.error}
                <br />
                <span className="text-gray-600">
                  The Java execution microservice may not be deployed or accessible.
                  Java code execution will fall back to error handling.
                </span>
              </div>
            )}
            {microserviceStatus.healthy && (
              <div className="mt-2 text-xs text-green-600">
                ✅ Ready for authentic Java compilation and execution
              </div>
            )}
          </div>
        )}

        {/* Framework Selection - Only show for test files */}
        {isTest && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Test Framework</label>
            <div className="grid grid-cols-3 gap-2">
              {TEST_FRAMEWORKS.map((framework) => (
                <button
                  key={framework.id}
                  onClick={() => setSelectedFramework(framework.id)}
                  disabled={isRunning}
                  className={`
                    p-3 border rounded-lg text-left transition-colors
                    ${
                      selectedFramework === framework.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                    ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{framework.icon}</span>
                    <span className="text-sm font-medium">{framework.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {framework.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Result */}
      {currentResult && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon(currentResult)}
              <span className="text-sm font-medium">
                {currentResult.success 
                  ? (isTest ? 'Tests Passed' : 'Execution Successful') 
                  : (isTest ? 'Tests Failed' : 'Execution Failed')
                }
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatExecutionTime(currentResult.executionTime)}
              </span>
              <span>{currentResult.testsRun} tests</span>
              {currentResult.coverage > 0 && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {currentResult.coverage.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-lg font-bold text-green-600">{currentResult.testsPassed}</div>
              <div className="text-xs text-green-600">Passed</div>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <div className="text-lg font-bold text-red-600">{currentResult.testsFailed}</div>
              <div className="text-xs text-red-600">Failed</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-600">{currentResult.coverage.toFixed(1)}%</div>
              <div className="text-xs text-blue-600">Coverage</div>
            </div>
          </div>
        </div>
      )}

      {/* Result Tabs */}
      {currentResult && (
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('output')}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === 'output'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Test Output
            </button>
            <button
              onClick={() => setActiveTab('coverage')}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === 'coverage'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Coverage Report
            </button>
          </div>
        </div>
      )}

      {/* Result Content */}
      <div className="flex-1 overflow-y-auto">
        {currentResult ? (
          <div className="p-4">
            {activeTab === 'output' && (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                {currentResult.output || (isTest ? 'No test output available' : 'No program output')}
              </div>
            )}
            
            {activeTab === 'coverage' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Coverage Summary</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${currentResult.coverage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {currentResult.coverage.toFixed(1)}% of code covered by tests
                  </p>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>Detailed coverage report will be available when running against actual files.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Ready to Test</h3>
              <p className="text-sm">
                {!projectId
                  ? 'Select a project to start testing'
                  : !testCode.trim()
                  ? 'Write some test code and click "Run Tests"'
                  : 'Click "Run Tests" to execute your test code'}
              </p>
              <div className="mt-4 text-xs text-gray-400">
                <p>Supports pytest, Jest, and JUnit frameworks</p>
                <p>Automatic code coverage reporting</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Results */}
      {results.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Test Runs</h4>
          <div className="space-y-2">
            {results.slice(0, 3).map((result, index) => (
              <div
                key={result.testRunId}
                onClick={() => setCurrentResult(result)}
                className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(result)}
                  <span className="text-sm">
                    {result.testsPassed}/{result.testsRun} tests passed
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatExecutionTime(result.executionTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

TestExecutor.displayName = 'TestExecutor';