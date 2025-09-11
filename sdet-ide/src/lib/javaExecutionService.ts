// Java Execution Microservice API Client
// Handles communication with the standalone Java execution microservice

interface JavaExecutionRequest {
  code: string;
  className: string;
  timeout?: number;
  memoryLimit?: string;
}

interface CompilationOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface JavaExecutionResponse {
  success: boolean;
  compilationOutput: CompilationOutput;
  executionOutput: ExecutionOutput;
  executionTime: number;
  memoryUsed: string;
  timestamp: string;
  executionId?: string;
  error?: string;
  message?: string;
}

interface MicroserviceStatus {
  success: boolean;
  status?: {
    docker: {
      connected: boolean;
      version: string;
      containers: {
        running: number;
        limit: number;
      };
    };
    java: {
      image: string;
      available: boolean;
      pullRequired: boolean;
    };
    service: {
      currentExecutions: number;
      maxConcurrentExecutions: number;
      defaultTimeout: number;
      defaultMemoryLimit: string;
    };
  };
  healthy?: boolean;
  error?: string;
  message?: string;
}

class JavaExecutionService {
  private baseUrl: string;
  private timeout: number = 45000; // 45 seconds timeout

  constructor() {
    // Try multiple potential microservice URLs
    // In production, this should be set via environment variables
    this.baseUrl = this.detectMicroserviceUrl();
  }

  private detectMicroserviceUrl(): string {
    // Check for environment variable first
    if (typeof window !== 'undefined' && (window as any).JAVA_EXECUTION_SERVICE_URL) {
      return (window as any).JAVA_EXECUTION_SERVICE_URL;
    }

    // Always use localhost for now since we're running the microservice locally
    return 'http://localhost:3001';
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
            if (errorData.message) {
              errorMessage += `: ${errorData.message}`;
            }
          }
        } catch {
          // If we can't parse the error response, use the default message
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - the service may be unavailable');
        }
        // Network errors, CORS issues, etc.
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Cannot connect to Java execution service. Please check if the service is running.');
        }
      }
      throw error;
    }
  }

  /**
   * Extract the Java class name from the source code
   */
  private extractClassName(code: string): string {
    // Look for public class declaration
    const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
    if (publicClassMatch) {
      return publicClassMatch[1];
    }

    // Look for any class declaration
    const classMatch = code.match(/class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }

    // Default fallback
    return 'Main';
  }

  /**
   * Execute Java code using the microservice
   */
  async executeJavaCode(
    code: string,
    options: {
      timeout?: number;
      memoryLimit?: string;
      className?: string;
    } = {}
  ): Promise<JavaExecutionResponse> {
    const className = options.className || this.extractClassName(code);
    
    const request: JavaExecutionRequest = {
      code: code.trim(),
      className,
      timeout: options.timeout || 30000,
      memoryLimit: options.memoryLimit || '128m'
    };

    console.log('Executing Java code via microservice:', {
      className,
      codeLength: code.length,
      timeout: request.timeout,
      memoryLimit: request.memoryLimit
    });

    return await this.makeRequest<JavaExecutionResponse>('/api/execute', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Check if the microservice is healthy and ready
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ status: string }>('/health');
      return response.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get detailed status of Docker and Java runtime
   */
  async getStatus(): Promise<MicroserviceStatus> {
    return await this.makeRequest<MicroserviceStatus>('/api/execute/status');
  }

  /**
   * Prepare the Java runtime (pull Docker image if needed)
   */
  async prepareRuntime(): Promise<{ success: boolean; message: string }> {
    return await this.makeRequest<{ success: boolean; message: string }>('/api/execute/prepare', {
      method: 'POST'
    });
  }

  /**
   * Get service information
   */
  async getServiceInfo(): Promise<any> {
    return await this.makeRequest<any>('/api/execute');
  }

  /**
   * Update the base URL (useful for switching between dev/prod)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Export a singleton instance
export const javaExecutionService = new JavaExecutionService();

// Export types for use in components
export type {
  JavaExecutionRequest,
  JavaExecutionResponse,
  CompilationOutput,
  ExecutionOutput,
  MicroserviceStatus
};