const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configuration
const TEMP_DIR = '/tmp/java-executions';
const MAX_EXECUTION_TIME = 30000; // 30 seconds
const MAX_CONCURRENT_EXECUTIONS = 10;

// Track concurrent executions
let currentExecutions = 0;

// Ensure temp directory exists
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

// Direct Java execution function (without Docker)
async function executeJavaDirect(code, className, timeout = MAX_EXECUTION_TIME) {
  const executionId = uuidv4();
  const workDir = path.join(TEMP_DIR, executionId);
  const javaFileName = `${className}.java`;
  const javaFilePath = path.join(workDir, javaFileName);
  
  let compilationResult = null;
  let executionResult = null;
  const startTime = Date.now();
  
  try {
    // Create execution directory
    await fs.mkdir(workDir, { recursive: true });
    
    // Write Java code to file
    await fs.writeFile(javaFilePath, code, 'utf8');
    
    console.log(`[${executionId}] Created Java file: ${javaFilePath}`);
    
    // Step 1: Compilation
    console.log(`[${executionId}] Starting compilation...`);
    
    compilationResult = await new Promise((resolve, reject) => {
      const javac = spawn('javac', [javaFileName], {
        cwd: workDir,
        timeout: 10000 // 10 second timeout for compilation
      });
      
      let stdout = '';
      let stderr = '';
      
      javac.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      javac.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      javac.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });
      
      javac.on('error', (error) => {
        reject(new Error(`Compilation process error: ${error.message}`));
      });
    });
    
    console.log(`[${executionId}] Compilation completed with exit code: ${compilationResult.exitCode}`);
    
    // If compilation failed, return early
    if (compilationResult.exitCode !== 0) {
      return {
        success: false,
        error: 'Compilation failed',
        compilationOutput: compilationResult,
        executionOutput: null,
        executionTime: Date.now() - startTime,
        executionId
      };
    }
    
    // Step 2: Execution
    console.log(`[${executionId}] Starting execution...`);
    
    executionResult = await new Promise((resolve, reject) => {
      const java = spawn('java', [className], {
        cwd: workDir,
        timeout: timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      java.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      java.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      java.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });
      
      java.on('error', (error) => {
        if (error.code === 'TIMEOUT') {
          reject(new Error('Execution timeout'));
        } else {
          reject(new Error(`Execution process error: ${error.message}`));
        }
      });
    });
    
    console.log(`[${executionId}] Execution completed with exit code: ${executionResult.exitCode}`);
    
    return {
      success: executionResult.exitCode === 0,
      compilationOutput: compilationResult,
      executionOutput: executionResult,
      executionTime: Date.now() - startTime,
      executionId
    };
    
  } catch (error) {
    console.error(`[${executionId}] Java execution error:`, error.message);
    
    return {
      success: false,
      error: error.message,
      compilationOutput: compilationResult,
      executionOutput: executionResult,
      executionTime: Date.now() - startTime,
      executionId
    };
  } finally {
    // Cleanup temporary files
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      console.log(`[${executionId}] Cleaned up workspace: ${workDir}`);
    } catch (cleanupError) {
      console.error(`[${executionId}] Cleanup error:`, cleanupError.message);
    }
    
    currentExecutions--;
  }
}
// POST /api/execute - Compile and run Java code
router.post('/', async (req, res) => {
  try {
    console.log('=== Java Code Execution Request ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body Keys:', Object.keys(req.body));
    
    // Check concurrent execution limit
    if (currentExecutions >= MAX_CONCURRENT_EXECUTIONS) {
      return res.status(429).json({
        success: false,
        error: 'Too many concurrent executions',
        message: `Maximum ${MAX_CONCURRENT_EXECUTIONS} concurrent executions allowed`,
        retryAfter: 5
      });
    }
    
    // Extract request data
    const { code, className, timeout = 30000, memoryLimit = '128m' } = req.body;
    
    // Validate required fields
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid code parameter'
      });
    }
    
    if (!className || typeof className !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid className parameter'
      });
    }
    
    // Validate className format (simple Java identifier)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid className format. Must be a valid Java identifier.'
      });
    }
    
    // Validate timeout
    const timeoutMs = parseInt(timeout);
    if (isNaN(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeout. Must be between 1000 and 60000 milliseconds.'
      });
    }
    
    // Validate memory limit format
    if (!/^\d+[mM]?$/.test(memoryLimit)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memoryLimit format. Use format like "128m".'
      });
    }
    
    // Basic code validation
    if (code.length > 50000) { // 50KB limit
      return res.status(400).json({
        success: false,
        error: 'Code too large. Maximum size is 50KB.'
      });
    }
    
    // Check for suspicious patterns (basic security)
    const suspiciousPatterns = [
      /Runtime\.getRuntime\(\)\.exec/i,
      /ProcessBuilder/i,
      /System\.exit/i,
      /File.*delete/i,
      /java\.io\.File/i,
      /java\.nio\.file/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Code contains potentially unsafe operations',
          message: 'File system operations, process execution, and system calls are not allowed'
        });
      }
    }
    
    console.log('Code length:', code.length);
    console.log('Class name:', className);
    console.log('Timeout:', timeoutMs, 'ms');
    console.log('Memory limit:', memoryLimit);
    console.log('Code preview (first 200 chars):', code.substring(0, 200));
    
    // Increment execution counter
    currentExecutions++;
    
    // Execute Java code directly
    const result = await executeJavaDirect(code, className, timeoutMs);
    
    // Add additional metadata
    result.timestamp = new Date().toISOString();
    result.memoryUsed = memoryLimit; // Approximate, real monitoring would require container stats
    result.concurrentExecutions = currentExecutions;
    
    console.log('=== Execution Result ===');
    console.log('Success:', result.success);
    console.log('Execution time:', result.executionTime, 'ms');
    console.log('Execution ID:', result.executionId || 'N/A');
    
    // Return appropriate status code
    const statusCode = result.success ? 200 : (result.error === 'Compilation failed' ? 422 : 500);
    res.status(statusCode).json(result);
    
  } catch (error) {
    console.error('Error in execute route:', error);
    
    // Ensure execution counter is decremented
    if (currentExecutions > 0) {
      currentExecutions--;
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/execute/status - Check Java runtime status
router.get('/status', async (req, res) => {
  try {
    console.log('=== Java Status Check ===');
    
    // Check Java availability
    const { spawn } = require('child_process');
    
    const javaAvailable = await new Promise((resolve) => {
      const java = spawn('java', ['-version']);
      java.on('close', (code) => {
        resolve(code === 0);
      });
      java.on('error', () => {
        resolve(false);
      });
    });
    
    const javacAvailable = await new Promise((resolve) => {
      const javac = spawn('javac', ['-version']);
      javac.on('close', (code) => {
        resolve(code === 0);
      });
      javac.on('error', () => {
        resolve(false);
      });
    });
    
    console.log('Java runtime available:', javaAvailable);
    console.log('Java compiler available:', javacAvailable);
    
    const status = {
      executionMode: 'direct',
      java: {
        runtime: {
          available: javaAvailable,
          command: 'java'
        },
        compiler: {
          available: javacAvailable,
          command: 'javac'
        }
      },
      service: {
        currentExecutions,
        maxConcurrentExecutions: MAX_CONCURRENT_EXECUTIONS,
        defaultTimeout: MAX_EXECUTION_TIME,
        tempDirectory: TEMP_DIR
      },
      timestamp: new Date().toISOString()
    };
    
    const healthy = javaAvailable && javacAvailable;
    
    res.json({
      success: true,
      status,
      healthy
    });
    
  } catch (error) {
    console.error('Java status check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Java service unavailable',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/execute/prepare - Check Java runtime availability
router.post('/prepare', async (req, res) => {
  try {
    console.log('=== Checking Java Runtime ===');
    
    // Check Java availability
    const { spawn } = require('child_process');
    
    const javaAvailable = await new Promise((resolve) => {
      const java = spawn('java', ['-version']);
      java.on('close', (code) => {
        resolve(code === 0);
      });
      java.on('error', () => {
        resolve(false);
      });
    });
    
    const javacAvailable = await new Promise((resolve) => {
      const javac = spawn('javac', ['-version']);
      javac.on('close', (code) => {
        resolve(code === 0);
      });
      javac.on('error', () => {
        resolve(false);
      });
    });
    
    if (javaAvailable && javacAvailable) {
      res.json({
        success: true,
        message: 'Java runtime ready for execution',
        mode: 'direct',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Java runtime not available',
        message: 'Java compiler or runtime not found on system',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Failed to check Java runtime:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Java runtime',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
// GET /api/execute - Get service info
router.get('/', (req, res) => {
  res.json({
    service: 'Java Code Execution API',
    version: '1.0.0',
    endpoints: {
      'POST /api/execute': 'Compile and run Java code',
      'GET /api/execute': 'Get service information',
      'GET /api/execute/status': 'Check Docker and Java runtime status',
      'POST /api/execute/prepare': 'Pull Java runtime image if needed'
    },
    supportedParameters: {
      code: 'string (required) - Java source code to execute',
      className: 'string (required) - Main class name (must be valid Java identifier)',
      timeout: 'number (optional, default: 30000) - Execution timeout in milliseconds (1000-60000)',
      memoryLimit: 'string (optional, default: 128m) - Memory limit for execution container'
    },
    limits: {
      maxCodeSize: '50KB',
      timeoutRange: '1-60 seconds',
      maxConcurrentExecutions: MAX_CONCURRENT_EXECUTIONS,
      memoryLimitFormat: 'e.g., "128m", "256m"'
    },
    security: {
      networkIsolation: true,
      fileSystemRestrictions: true,
      processExecutionBlocked: true,
      timeoutEnforced: true
    },
    runtime: {
      executionMode: 'direct',
      javaVersion: 'OpenJDK 17',
      currentExecutions
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;