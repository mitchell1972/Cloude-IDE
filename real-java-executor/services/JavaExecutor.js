const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sanitizeFilename = require('sanitize-filename');
const logger = require('../utils/logger');

class JavaExecutor {
  constructor() {
    this.tempDir = '/tmp/java-executions';
    this.activeProcesses = new Map();
    this.cleanupInterval = null;
    
    // Start periodic cleanup
    this.startCleanupScheduler();
  }

  /**
   * Compile and run Java code with real javac and java commands
   */
  async compileAndRun({ code, className, mainMethod = true, executionId, timeout = 30000 }) {
    const startTime = Date.now();
    const workDir = path.join(this.tempDir, sanitizeFilename(executionId));
    
    try {
      // Create working directory
      await fs.mkdir(workDir, { recursive: true });
      
      // Determine class name from code if not provided
      if (!className) {
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        className = classMatch ? classMatch[1] : 'Main';
      }
      
      const javaFile = path.join(workDir, `${sanitizeFilename(className)}.java`);
      
      logger.info(`Writing Java code to file: ${javaFile}`, {
        executionId,
        className,
        codeLength: code.length
      });
      
      // Write Java code to file
      await fs.writeFile(javaFile, code, 'utf8');
      
      // Compile Java code
      logger.info(`Compiling Java code: ${javaFile}`, { executionId });
      
      const compileResult = await this.runJavaCommand('javac', [javaFile], {
        cwd: workDir,
        timeout: parseInt(process.env.JAVA_COMPILE_TIMEOUT) || 15000,
        executionId
      });
      
      const compilationTime = Date.now() - startTime;
      
      if (!compileResult.success) {
        return {
          success: false,
          error: 'Compilation failed',
          output: '',
          stderr: compileResult.stderr,
          compilationError: true,
          compilationTime,
          executionTime: 0,
          className
        };
      }
      
      logger.info(`Compilation successful, executing Java program: ${className}`, { executionId });
      
      // Execute Java program
      const executeResult = await this.runJavaCommand('java', ['-cp', workDir, className], {
        cwd: workDir,
        timeout,
        executionId
      });
      
      const totalExecutionTime = Date.now() - startTime;
      const runtimeExecutionTime = totalExecutionTime - compilationTime;
      
      return {
        success: executeResult.success,
        output: executeResult.stdout,
        stderr: executeResult.stderr,
        error: executeResult.success ? null : executeResult.stderr,
        exitCode: executeResult.exitCode,
        compilationTime,
        executionTime: runtimeExecutionTime,
        totalTime: totalExecutionTime,
        className,
        compilationError: false,
        runtimeError: !executeResult.success && executeResult.exitCode !== 0
      };
      
    } catch (error) {
      logger.error(`Java execution error for ${executionId}:`, error);
      return {
        success: false,
        error: error.message,
        output: '',
        stderr: '',
        executionTime: Date.now() - startTime,
        compilationTime: 0,
        className
      };
    } finally {
      // Clean up working directory
      setTimeout(async () => {
        try {
          await this.cleanup(workDir);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup ${workDir}:`, cleanupError.message);
        }
      }, 5000); // Delay cleanup to ensure files are not in use
    }
  }

  /**
   * Compile Java code only (no execution)
   */
  async compileOnly({ code, className, compilationId }) {
    const startTime = Date.now();
    const workDir = path.join(this.tempDir, sanitizeFilename(compilationId));
    
    try {
      // Create working directory
      await fs.mkdir(workDir, { recursive: true });
      
      // Determine class name from code if not provided
      if (!className) {
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        className = classMatch ? classMatch[1] : 'Main';
      }
      
      const javaFile = path.join(workDir, `${sanitizeFilename(className)}.java`);
      
      // Write Java code to file
      await fs.writeFile(javaFile, code, 'utf8');
      
      // Compile Java code
      const compileResult = await this.runJavaCommand('javac', [javaFile], {
        cwd: workDir,
        timeout: parseInt(process.env.JAVA_COMPILE_TIMEOUT) || 15000,
        compilationId
      });
      
      const compilationTime = Date.now() - startTime;
      
      return {
        success: compileResult.success,
        output: compileResult.stdout,
        stderr: compileResult.stderr,
        error: compileResult.success ? null : compileResult.stderr,
        compilationTime,
        className
      };
      
    } catch (error) {
      logger.error(`Java compilation error for ${compilationId}:`, error);
      return {
        success: false,
        error: error.message,
        compilationTime: Date.now() - startTime
      };
    } finally {
      // Clean up working directory
      setTimeout(async () => {
        try {
          await this.cleanup(workDir);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup ${workDir}:`, cleanupError.message);
        }
      }, 5000);
    }
  }

  /**
   * Compile and run with real-time streaming output
   */
  async compileAndRunStream({ code, className, mainMethod = true, executionId, timeout = 30000, onOutput, onError, onComplete }) {
    const startTime = Date.now();
    const workDir = path.join(this.tempDir, sanitizeFilename(executionId));
    
    try {
      // Create working directory
      await fs.mkdir(workDir, { recursive: true });
      
      // Determine class name from code if not provided
      if (!className) {
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        className = classMatch ? classMatch[1] : 'Main';
      }
      
      const javaFile = path.join(workDir, `${sanitizeFilename(className)}.java`);
      
      onOutput(`Writing Java source to ${className}.java...\n`);
      
      // Write Java code to file
      await fs.writeFile(javaFile, code, 'utf8');
      
      onOutput(`Compiling ${className}.java...\n`);
      
      // Compile Java code with streaming
      const compileResult = await this.runJavaCommandStream('javac', [javaFile], {
        cwd: workDir,
        timeout: parseInt(process.env.JAVA_COMPILE_TIMEOUT) || 15000,
        executionId,
        onOutput: (data) => onOutput(`[COMPILER] ${data}`),
        onError: (data) => onOutput(`[COMPILER ERROR] ${data}`)
      });
      
      const compilationTime = Date.now() - startTime;
      
      if (!compileResult.success) {
        const result = {
          success: false,
          error: 'Compilation failed',
          output: '',
          stderr: compileResult.stderr,
          compilationError: true,
          compilationTime,
          executionTime: 0,
          className
        };
        onError(compileResult.stderr);
        onComplete(result);
        return result;
      }
      
      onOutput(`Compilation successful! Executing ${className}...\n`);
      onOutput(`${'='.repeat(50)}\n`);
      
      // Execute Java program with streaming
      const executeResult = await this.runJavaCommandStream('java', ['-cp', workDir, className], {
        cwd: workDir,
        timeout,
        executionId,
        onOutput,
        onError
      });
      
      const totalExecutionTime = Date.now() - startTime;
      const runtimeExecutionTime = totalExecutionTime - compilationTime;
      
      onOutput(`\n${'='.repeat(50)}\n`);
      onOutput(`Execution completed in ${runtimeExecutionTime}ms\n`);
      
      const result = {
        success: executeResult.success,
        output: executeResult.stdout,
        stderr: executeResult.stderr,
        error: executeResult.success ? null : executeResult.stderr,
        exitCode: executeResult.exitCode,
        compilationTime,
        executionTime: runtimeExecutionTime,
        totalTime: totalExecutionTime,
        className,
        compilationError: false,
        runtimeError: !executeResult.success && executeResult.exitCode !== 0
      };
      
      onComplete(result);
      return result;
      
    } catch (error) {
      logger.error(`Java streaming execution error for ${executionId}:`, error);
      const result = {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
      onError(error.message);
      onComplete(result);
      return result;
    } finally {
      // Clean up working directory
      setTimeout(async () => {
        try {
          await this.cleanup(workDir);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup ${workDir}:`, cleanupError.message);
        }
      }, 5000);
    }
  }
  
  /**
   * Run Java command (javac or java) with subprocess
   */
  async runJavaCommand(command, args, options = {}) {
    const { timeout = 30000, cwd, executionId } = options;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      
      // Add JVM options for better error reporting
      if (command === 'java') {
        args.unshift(
          '-Xmx512m', // Max heap size
          '-Xms64m',  // Initial heap size
          '-XX:+UseSerialGC', // Use serial garbage collector
          '-Dfile.encoding=UTF-8' // Ensure UTF-8 encoding
        );
      }
      
      logger.debug(`Executing: ${command} ${args.join(' ')}`, { executionId });
      
      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64',
          PATH: `${process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64'}/bin:${process.env.PATH}`
        }
      });
      
      // Track active process
      this.activeProcesses.set(executionId, child);
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        
        // Force kill after 2 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 2000);
      }, timeout);
      
      // Collect stdout
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);
        
        const executionTime = Date.now() - startTime;
        
        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr: stderr + `\nProcess terminated due to timeout (${timeout}ms)`,
            exitCode: -1,
            executionTime,
            timeout: true,
            signal
          });
        } else {
          resolve({
            success: code === 0,
            stdout,
            stderr,
            exitCode: code,
            signal,
            executionTime
          });
        }
      });
      
      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);
        
        resolve({
          success: false,
          stdout,
          stderr: stderr + `\nProcess error: ${error.message}`,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          error: error.message
        });
      });
    });
  }

  /**
   * Run Java command with real-time streaming
   */
  async runJavaCommandStream(command, args, options = {}) {
    const { timeout = 30000, cwd, executionId, onOutput, onError } = options;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      
      // Add JVM options for better error reporting
      if (command === 'java') {
        args.unshift(
          '-Xmx512m',
          '-Xms64m',
          '-XX:+UseSerialGC',
          '-Dfile.encoding=UTF-8'
        );
      }
      
      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64',
          PATH: `${process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64'}/bin:${process.env.PATH}`
        }
      });
      
      // Track active process
      this.activeProcesses.set(executionId, child);
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        onError(`Execution timeout (${timeout}ms) - terminating process...\n`);
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 2000);
      }, timeout);
      
      // Stream stdout
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (onOutput) onOutput(output);
      });
      
      // Stream stderr
      child.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        if (onError) onError(error);
      });
      
      // Handle process completion
      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);
        
        const executionTime = Date.now() - startTime;
        
        resolve({
          success: !killed && code === 0,
          stdout,
          stderr,
          exitCode: code,
          signal,
          executionTime,
          timeout: killed
        });
      });
      
      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);
        
        if (onError) onError(`Process error: ${error.message}\n`);
        
        resolve({
          success: false,
          stdout,
          stderr: stderr + `\nProcess error: ${error.message}`,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          error: error.message
        });
      });
    });
  }
  
  /**
   * Test Java availability
   */
  async testJavaAvailability() {
    try {
      const javaVersionResult = await this.runJavaCommand('java', ['-version'], {
        timeout: 5000,
        executionId: 'java-test'
      });
      
      const javacVersionResult = await this.runJavaCommand('javac', ['-version'], {
        timeout: 5000,
        executionId: 'javac-test'
      });
      
      return javaVersionResult.success && javacVersionResult.success;
    } catch (error) {
      logger.error('Failed to test Java availability:', error);
      return false;
    }
  }
  
  /**
   * Get system statistics
   */
  async getSystemStats() {
    try {
      const javaVersionResult = await this.runJavaCommand('java', ['-version'], {
        timeout: 5000,
        executionId: 'stats-check'
      });
      
      return {
        javaAvailable: javaVersionResult.success,
        javaVersion: javaVersionResult.stderr || javaVersionResult.stdout,
        activeProcesses: this.activeProcesses.size,
        tempDirExists: await this.checkTempDir()
      };
    } catch (error) {
      return {
        javaAvailable: false,
        javaVersion: null,
        activeProcesses: this.activeProcesses.size,
        tempDirExists: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check if temp directory exists and is writable
   */
  async checkTempDir() {
    try {
      await fs.access(this.tempDir, fs.constants.F_OK | fs.constants.W_OK);
      return true;
    } catch (error) {
      try {
        await fs.mkdir(this.tempDir, { recursive: true });
        return true;
      } catch (mkdirError) {
        logger.error('Failed to create temp directory:', mkdirError);
        return false;
      }
    }
  }
  
  /**
   * Clean up working directory
   */
  async cleanup(workDir) {
    try {
      const files = await fs.readdir(workDir);
      for (const file of files) {
        await fs.unlink(path.join(workDir, file));
      }
      await fs.rmdir(workDir);
      logger.debug(`Cleaned up working directory: ${workDir}`);
    } catch (error) {
      logger.debug(`Cleanup warning for ${workDir}:`, error.message);
    }
  }
  
  /**
   * Start periodic cleanup of old directories
   */
  startCleanupScheduler() {
    const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 300000; // 5 minutes
    
    this.cleanupInterval = setInterval(async () => {
      try {
        const dirs = await fs.readdir(this.tempDir);
        const now = Date.now();
        
        for (const dir of dirs) {
          const dirPath = path.join(this.tempDir, dir);
          try {
            const stat = await fs.stat(dirPath);
            const age = now - stat.mtime.getTime();
            
            // Clean up directories older than 10 minutes
            if (age > 600000) {
              await this.cleanup(dirPath);
              logger.debug(`Cleaned up old directory: ${dirPath}`);
            }
          } catch (statError) {
            // Directory might have been deleted already
          }
        }
      } catch (error) {
        logger.warn('Periodic cleanup failed:', error.message);
      }
    }, cleanupInterval);
  }
  
  /**
   * Stop cleanup scheduler and kill all active processes
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Kill all active processes
    for (const [executionId, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
        logger.info(`Terminated active process: ${executionId}`);
      } catch (error) {
        logger.warn(`Failed to terminate process ${executionId}:`, error.message);
      }
    }
    
    this.activeProcesses.clear();
  }
}

module.exports = JavaExecutor;