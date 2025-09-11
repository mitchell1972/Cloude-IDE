const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const logger = require('../utils/logger');

// Health check endpoint
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
        javaCompiler: false,
        javaRuntime: false,
        filesystem: false,
        memory: false
      }
    };
    
    // Check Java compiler availability
    try {
      await runCommand('javac', ['-version'], { timeout: 5000 });
      healthStatus.checks.javaCompiler = true;
    } catch (error) {
      logger.warn('Java compiler check failed:', error.message);
    }
    
    // Check Java runtime availability
    try {
      await runCommand('java', ['-version'], { timeout: 5000 });
      healthStatus.checks.javaRuntime = true;
    } catch (error) {
      logger.warn('Java runtime check failed:', error.message);
    }
    
    // Check filesystem access
    try {
      const fs = require('fs').promises;
      const testFile = '/tmp/health-check-test';
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      healthStatus.checks.filesystem = true;
    } catch (error) {
      logger.warn('Filesystem check failed:', error.message);
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.rss + memUsage.heapUsed + memUsage.external;
    healthStatus.checks.memory = totalMemory < (1024 * 1024 * 1024); // Less than 1GB
    
    // Calculate response time
    healthStatus.responseTime = Date.now() - startTime;
    
    // Determine overall health
    const allChecksPass = Object.values(healthStatus.checks).every(check => check === true);
    
    if (!allChecksPass) {
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

// Detailed health check with additional diagnostics
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
        javaHome: process.env.JAVA_HOME
      },
      resources: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        loadAverage: require('os').loadavg()
      },
      checks: {
        javaCompiler: { status: false, details: null },
        javaRuntime: { status: false, details: null },
        filesystem: { status: false, details: null },
        diskSpace: { status: false, details: null }
      }
    };
    
    // Java compiler check with version details
    try {
      const javacResult = await runCommand('javac', ['-version'], { timeout: 5000 });
      detailedHealth.checks.javaCompiler = {
        status: true,
        details: javacResult.stderr || javacResult.stdout
      };
    } catch (error) {
      detailedHealth.checks.javaCompiler = {
        status: false,
        details: error.message
      };
    }
    
    // Java runtime check with version details
    try {
      const javaResult = await runCommand('java', ['-version'], { timeout: 5000 });
      detailedHealth.checks.javaRuntime = {
        status: true,
        details: javaResult.stderr || javaResult.stdout
      };
    } catch (error) {
      detailedHealth.checks.javaRuntime = {
        status: false,
        details: error.message
      };
    }
    
    // Filesystem check
    try {
      const fs = require('fs').promises;
      const testDir = '/tmp/java-executor-health';
      await fs.mkdir(testDir, { recursive: true });
      const testFile = `${testDir}/test.txt`;
      await fs.writeFile(testFile, 'health check test');
      const content = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);
      await fs.rmdir(testDir);
      
      detailedHealth.checks.filesystem = {
        status: content === 'health check test',
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
      const { spawn } = require('child_process');
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
    
    // Calculate response time
    detailedHealth.responseTime = Date.now() - startTime;
    
    // Determine overall health
    const criticalChecks = ['javaCompiler', 'javaRuntime', 'filesystem'];
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

// Helper function to run commands with timeout
function runCommand(command, args, options = {}) {
  const { timeout = 5000 } = options;
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
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

module.exports = router;