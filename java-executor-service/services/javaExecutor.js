const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class JavaExecutor {
  constructor() {
    this.tempDir = '/tmp/java-executor';
    this.activeProcesses = new Map();
  }

  async execute({ code, className, mainMethod = true, executionId, maxTime = 30000, maxMemory = 512 }) {
    const startTime = Date.now();
    const workDir = path.join(this.tempDir, executionId);
    
    try {
      // Create working directory
      await fs.mkdir(workDir, { recursive: true });
      
      // Determine class name from code if not provided
      if (!className) {
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        className = classMatch ? classMatch[1] : 'Main';
      }
      
      const javaFile = path.join(workDir, `${className}.java`);
      
      // Write Java code to file
      await fs.writeFile(javaFile, code, 'utf8');
      
      logger.info(`Compiling Java code for execution ${executionId}`, {
        executionId,
        className,
        workDir
      });
      
      // Compile Java code
      const compileResult = await this.runCommand('javac', [javaFile], {
        cwd: workDir,
        timeout: 10000 // 10 second compile timeout
      });
      
      if (!compileResult.success) {
        return {
          success: false,
          error: 'Compilation failed',
          output: compileResult.stderr,
          compilationError: true,
          executionTime: Date.now() - startTime
        };
      }
      
      logger.info(`Running Java program for execution ${executionId}`, {
        executionId,
        className
      });
      
      // Execute Java program
      const executeResult = await this.runCommand('java', ['-cp', workDir, className], {
        cwd: workDir,
        timeout: maxTime,
        maxMemory
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: executeResult.success,
        output: executeResult.stdout,
        error: executeResult.stderr,
        exitCode: executeResult.exitCode,
        executionTime,
        compilationTime: compileResult.executionTime,
        memoryUsed: executeResult.memoryUsed,
        className
      };
      
    } catch (error) {
      logger.error(`Java execution error for ${executionId}:`, error);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    } finally {
      // Clean up working directory
      try {
        await this.cleanup(workDir);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup ${workDir}:`, cleanupError.message);
      }
    }
  }
  
  async runCommand(command, args, options = {}) {
    const { timeout = 30000, cwd, maxMemory = 512 } = options;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      
      // Add memory limit for Java processes
      if (command === 'java') {
        args.unshift(`-Xmx${maxMemory}m`, '-Xms64m');
      }
      
      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk'
        }
      });
      
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
        
        const executionTime = Date.now() - startTime;
        
        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr: stderr + '\nProcess terminated due to timeout',
            exitCode: -1,
            executionTime,
            timeout: true
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
  
  async cleanup(workDir) {
    try {
      const files = await fs.readdir(workDir);
      for (const file of files) {
        await fs.unlink(path.join(workDir, file));
      }
      await fs.rmdir(workDir);
    } catch (error) {
      // Directory might not exist or already cleaned up
      logger.debug(`Cleanup warning for ${workDir}:`, error.message);
    }
  }
  
  // Get current system load
  getSystemLoad() {
    return {
      activeProcesses: this.activeProcesses.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}

module.exports = new JavaExecutor();