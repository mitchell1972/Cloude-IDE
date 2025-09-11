const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Service statistics endpoint
router.get('/', optionalAuth, (req, res) => {
  try {
    const stats = {
      service: 'Real Java Executor Service',
      version: require('../package.json').version,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        human: formatUptime(process.uptime())
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpuUsage: process.cpuUsage(),
        memory: {
          usage: process.memoryUsage(),
          system: {
            free: require('os').freemem(),
            total: require('os').totalmem()
          }
        },
        loadAverage: require('os').loadavg()
      },
      java: {
        home: process.env.JAVA_HOME,
        version: 'Java 17' // This would be dynamically determined in a real implementation
      },
      configuration: {
        maxExecutionTime: process.env.JAVA_EXECUTION_TIMEOUT || 30000,
        maxMemoryMB: process.env.MAX_MEMORY_MB || 512,
        maxConcurrentExecutions: process.env.MAX_CONCURRENT_EXECUTIONS || 10,
        maxCodeSizeKB: process.env.MAX_CODE_SIZE_KB || 500,
        cleanupIntervalMS: process.env.CLEANUP_INTERVAL_MS || 300000
      }
    };
    
    // Add detailed stats only for authenticated requests
    if (req.authenticated) {
      stats.detailed = {
        environment: process.env,
        memoryDetailed: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(process.memoryUsage().external / 1024 / 1024)} MB`
        }
      };
    }
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Failed to generate stats:', error);
    res.status(500).json({
      error: 'Failed to generate statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// Performance metrics endpoint
router.get('/performance', optionalAuth, (req, res) => {
  try {
    const performance = {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: require('os').loadavg()
      },
      memory: {
        process: process.memoryUsage(),
        system: {
          free: require('os').freemem(),
          total: require('os').totalmem(),
          usage: ((require('os').totalmem() - require('os').freemem()) / require('os').totalmem() * 100).toFixed(2) + '%'
        }
      },
      uptime: {
        process: process.uptime(),
        system: require('os').uptime()
      },
      network: {
        interfaces: require('os').networkInterfaces()
      }
    };
    
    res.json(performance);
    
  } catch (error) {
    logger.error('Failed to generate performance metrics:', error);
    res.status(500).json({
      error: 'Failed to generate performance metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Usage statistics endpoint
router.get('/usage', optionalAuth, (req, res) => {
  try {
    // In a real implementation, this would come from a database or metrics store
    const usage = {
      timestamp: new Date().toISOString(),
      period: '24h',
      executions: {
        total: 0,
        successful: 0,
        failed: 0,
        timeouts: 0
      },
      compilation: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0
      },
      runtime: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0
      },
      resources: {
        peakMemoryUsage: 0,
        averageCpuUsage: 0,
        totalProcessingTime: 0
      }
    };
    
    res.json(usage);
    
  } catch (error) {
    logger.error('Failed to generate usage statistics:', error);
    res.status(500).json({
      error: 'Failed to generate usage statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

module.exports = router;