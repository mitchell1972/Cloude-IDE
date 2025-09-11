const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const logger = require('../utils/logger');

// Basic health check endpoint
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: require('../package.json').version,
      checks: {
        javaRuntime: false,
        javaCompiler: false,
        filesystem: false,
        memory: false
      }
    };
    
    // Check Java runtime availability
    try {
      await runCommand('java', ['-version'], { timeout: 5000 });
      healthStatus.checks.javaRuntime = true;
    } catch (error) {
      logger.warn('Java runtime check failed:', error.message);
    }
    
    // Check Java compiler availability
    try {
      await runCommand('javac', ['-version'], { timeout: 5000 });
      healthStatus.checks.javaCompiler = true;
    } catch (error) {
      logger.warn('Java compiler check failed:', error.message);
    }
    
    // Check filesystem access
    try {
      const fs = require('fs').promises;
      const testDir = '/tmp/java-executions';
      await fs.mkdir(testDir, { recursive: true });
      const testFile = `${testDir}/health-check-test.txt`;
      await fs.writeFile(testFile, 'health check test');
      const content = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);
      
      healthStatus.checks.filesystem = content === 'health check test';
    } catch (error) {
      logger.warn('Filesystem check failed:', error.message);
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.rss + memUsage.heapUsed + memUsage.external;
    healthStatus.checks.memory = totalMemory < (2048 * 1024 * 1024); // Less than 2GB
    
    // Calculate response time
    healthStatus.responseTime = Date.now() - startTime;
    
    // Determine overall health
    const criticalChecks = ['javaRuntime', 'javaCompiler', 'filesystem'];
    const allCriticalChecksPass = criticalChecks.every(check => healthStatus.checks[check] === true);
    
    if (!allCriticalChecksPass) {
      healthStatus.status = 'degraded';
      res.status(503);
    }
    
    res.json(healthStatus);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

// Detailed health check with comprehensive diagnostics
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: require('../package.json').version,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        javaHome: process.env.JAVA_HOME,
        path: process.env.PATH
      },
      resources: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        loadAverage: require('os').loadavg(),
        freeMem: require('os').freemem(),
        totalMem: require('os').totalmem()
      },
      checks: {
        javaRuntime: { status: false, details: null },
        javaCompiler: { status: false, details: null },
        filesystem: { status: false, details: null },
        diskSpace: { status: false, details: null },
        tempDirectory: { status: false, details: null }
      }
    };
    
    // Java runtime check with version details
    try {
      const javaResult = await runCommand('java', ['-version'], { timeout: 5000 });
      detailedHealth.checks.javaRuntime = {
        status: true,
        details: javaResult.stderr || javaResult.stdout,
        exitCode: javaResult.exitCode
      };
    } catch (error) {
      detailedHealth.checks.javaRuntime = {
        status: false,
        details: error.message
      };
    }
    
    // Java compiler check with version details
    try {
      const javacResult = await runCommand('javac', ['-version'], { timeout: 5000 });
      detailedHealth.checks.javaCompiler = {
        status: true,
        details: javacResult.stderr || javacResult.stdout,
        exitCode: javacResult.exitCode
      };
    } catch (error) {
      detailedHealth.checks.javaCompiler = {
        status: false,
        details: error.message
      };
    }
    
    // Filesystem check
    try {
      const fs = require('fs').promises;
      const testDir = '/tmp/java-executions/health-test';
      await fs.mkdir(testDir, { recursive: true });
      const testFile = `${testDir}/test.java`;
      const testCode = 'public class HealthTest { public static void main(String[] args) { System.out.println("Health Check"); } }';
      await fs.writeFile(testFile, testCode);
      const content = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);
      await fs.rmdir(testDir);
      
      detailedHealth.checks.filesystem = {
        status: content === testCode,
        details: 'Read/write operations successful'
      };
    } catch (error) {
      detailedHealth.checks.filesystem = {
        status: false,
        details: error.message
      };
    }
    
    // Disk space check
    try {
      const dfResult = await runCommand('df', ['/tmp'], { timeout: 3000 });
      detailedHealth.checks.diskSpace = {
        status: true,
        details: dfResult.stdout
      };
    } catch (error) {
      detailedHealth.checks.diskSpace = {
        status: false,
        details: error.message
      };
    }
    
    // Temp directory check
    try {
      const fs = require('fs').promises;
      const tempDir = '/tmp/java-executions';
      await fs.access(tempDir, fs.constants.F_OK | fs.constants.W_OK);
      const stat = await fs.stat(tempDir);
      
      detailedHealth.checks.tempDirectory = {
        status: true,
        details: {
          path: tempDir,
          writable: true,
          created: stat.birthtime,
          modified: stat.mtime
        }
      };
    } catch (error) {
      detailedHealth.checks.tempDirectory = {
        status: false,
        details: error.message
      };
    }
    
    // Calculate response time
    detailedHealth.responseTime = Date.now() - startTime;
    
    // Determine overall health
    const criticalChecks = ['javaRuntime', 'javaCompiler', 'filesystem'];
    const criticalChecksPassing = criticalChecks.every(
      check => detailedHealth.checks[check].status === true
    );
    
    if (!criticalChecksPassing) {
      detailedHealth.status = 'unhealthy';
      res.status(503);
    }
    
    res.json(detailedHealth);
    
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

// Java-specific health check
router.get('/java', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const javaHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      java: {
        runtime: { available: false, version: null, details: null },
        compiler: { available: false, version: null, details: null },
        compilation: { working: false, details: null },
        execution: { working: false, details: null }
      }
    };
    
    // Test Java runtime
    try {
      const javaResult = await runCommand('java', ['-version'], { timeout: 5000 });
      javaHealth.java.runtime = {
        available: true,
        version: extractJavaVersion(javaResult.stderr),
        details: javaResult.stderr
      };
    } catch (error) {
      javaHealth.java.runtime.details = error.message;
    }
    
    // Test Java compiler
    try {
      const javacResult = await runCommand('javac', ['-version'], { timeout: 5000 });
      javaHealth.java.compiler = {
        available: true,
        version: extractJavacVersion(javacResult.stderr),
        details: javacResult.stderr
      };
    } catch (error) {
      javaHealth.java.compiler.details = error.message;
    }
    
    // Test actual compilation and execution
    if (javaHealth.java.runtime.available && javaHealth.java.compiler.available) {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        const testDir = `/tmp/java-executions/health-java-${Date.now()}`;
        await fs.mkdir(testDir, { recursive: true });
        
        const javaFile = path.join(testDir, 'HealthTest.java');
        const testCode = `
public class HealthTest {
    public static void main(String[] args) {
        System.out.println("Java execution health check successful");
        System.out.println("Current time: " + System.currentTimeMillis());
    }
}
        `.trim();
        
        // Write test file
        await fs.writeFile(javaFile, testCode);
        
        // Compile
        const compileResult = await runCommand('javac', [javaFile], {
          timeout: 10000,
          cwd: testDir
        });
        
        if (compileResult.success) {
          javaHealth.java.compilation = {
            working: true,
            details: 'Compilation successful'
          };
          
          // Execute
          const executeResult = await runCommand('java', ['-cp', testDir, 'HealthTest'], {
            timeout: 10000,
            cwd: testDir
          });
          
          javaHealth.java.execution = {
            working: executeResult.success,
            details: executeResult.success ? executeResult.stdout : executeResult.stderr,
            exitCode: executeResult.exitCode
          };
        } else {
          javaHealth.java.compilation = {
            working: false,
            details: compileResult.stderr
          };
        }
        
        // Cleanup
        try {
          await fs.unlink(javaFile);
          const classFile = path.join(testDir, 'HealthTest.class');
          try {
            await fs.unlink(classFile);
          } catch (e) {}
          await fs.rmdir(testDir);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup health test files:', cleanupError.message);
        }
        
      } catch (error) {
        javaHealth.java.compilation = {
          working: false,
          details: error.message
        };
      }
    }
    
    // Determine overall status
    const javaWorking = javaHealth.java.runtime.available && 
                       javaHealth.java.compiler.available && 
                       javaHealth.java.compilation.working && 
                       javaHealth.java.execution.working;
    
    if (!javaWorking) {
      javaHealth.status = 'unhealthy';
      res.status(503);
    }
    
    javaHealth.responseTime = Date.now() - startTime;
    res.json(javaHealth);
    
  } catch (error) {
    logger.error('Java health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

// Helper function to run commands with timeout
function runCommand(command, args, options = {}) {
  const { timeout = 5000, cwd } = options;
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64',
        PATH: `${process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64'}/bin:${process.env.PATH}`
      }
    });
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command ${command} timed out after ${timeout}ms`));
    }, timeout);
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

// Helper function to extract Java version
function extractJavaVersion(versionOutput) {
  const match = versionOutput.match(/version "([^"]+)"/);
  return match ? match[1] : 'unknown';
}

// Helper function to extract javac version
function extractJavacVersion(versionOutput) {
  const match = versionOutput.match(/javac ([\d.]+)/);
  return match ? match[1] : 'unknown';
}

module.exports = router;