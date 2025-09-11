const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const expressWs = require('express-ws');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./utils/logger');
const JavaExecutor = require('./services/JavaExecutor');
const { validateJavaRequest, validateCompileRequest } = require('./middleware/validation');
const { authenticate } = require('./middleware/auth');
const healthRoutes = require('./routes/health');
const statsRoutes = require('./routes/stats');

const app = express();
expressWs(app); // Enable WebSocket support

const PORT = process.env.PORT || 3000;
const MAX_CONCURRENT_EXECUTIONS = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 10;

// Global execution tracking
const activeExecutions = new Map();
let currentExecutions = 0;

// Initialize Java executor
const javaExecutor = new JavaExecutor();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: `${process.env.MAX_CODE_SIZE_KB || 500}kb` }));
app.use(express.urlencoded({ extended: true, limit: `${process.env.MAX_CODE_SIZE_KB || 500}kb` }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  logger.info(`Request ${requestId}: ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check routes
app.use('/api/health', healthRoutes);
app.use('/api/stats', statsRoutes);

// Real Java compilation and execution endpoint
app.post('/api/compile-and-run', authenticate, validateJavaRequest, async (req, res) => {
  const executionId = uuidv4();
  
  try {
    // Check concurrent execution limit
    if (currentExecutions >= MAX_CONCURRENT_EXECUTIONS) {
      return res.status(429).json({
        error: 'Server is at maximum capacity. Please try again later.',
        executionId,
        retryAfter: 30
      });
    }

    currentExecutions++;
    activeExecutions.set(executionId, {
      startTime: Date.now(),
      status: 'running',
      requestId: req.requestId
    });

    const { code, className, mainMethod = true, timeout } = req.body;
    
    logger.info(`Starting Java execution ${executionId}`, {
      executionId,
      requestId: req.requestId,
      codeLength: code.length,
      className,
      mainMethod
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Execution-ID', executionId);
    
    // Execute Java code with real compilation and execution
    const result = await javaExecutor.compileAndRun({
      code,
      className,
      mainMethod,
      executionId,
      timeout: timeout || parseInt(process.env.JAVA_EXECUTION_TIMEOUT) || 30000
    });

    // Update execution status
    activeExecutions.set(executionId, {
      ...activeExecutions.get(executionId),
      status: 'completed',
      endTime: Date.now(),
      success: result.success
    });

    logger.info(`Java execution completed ${executionId}`, {
      executionId,
      success: result.success,
      executionTime: result.executionTime,
      compilationTime: result.compilationTime
    });

    res.json({
      success: true,
      executionId,
      result
    });

  } catch (error) {
    logger.error(`Java execution failed ${executionId}:`, {
      executionId,
      error: error.message,
      stack: error.stack
    });

    // Update execution status
    activeExecutions.set(executionId, {
      ...activeExecutions.get(executionId),
      status: 'failed',
      endTime: Date.now(),
      error: error.message
    });

    res.status(500).json({
      success: false,
      executionId,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    currentExecutions--;
    
    // Clean up execution tracking after 5 minutes
    setTimeout(() => {
      activeExecutions.delete(executionId);
    }, 300000);
  }
});

// Java compilation only endpoint
app.post('/api/compile-only', authenticate, validateCompileRequest, async (req, res) => {
  const compilationId = uuidv4();
  
  try {
    const { code, className } = req.body;
    
    logger.info(`Starting Java compilation ${compilationId}`, {
      compilationId,
      requestId: req.requestId,
      codeLength: code.length,
      className
    });

    // Compile Java code only
    const result = await javaExecutor.compileOnly({
      code,
      className,
      compilationId
    });

    logger.info(`Java compilation completed ${compilationId}`, {
      compilationId,
      success: result.success,
      compilationTime: result.compilationTime
    });

    res.json({
      success: true,
      compilationId,
      result
    });

  } catch (error) {
    logger.error(`Java compilation failed ${compilationId}:`, {
      compilationId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      compilationId,
      error: error.message
    });
  }
});

// WebSocket endpoint for real-time execution streaming
app.ws('/ws/execute', (ws, req) => {
  const connectionId = uuidv4();
  logger.info(`WebSocket connection established: ${connectionId}`);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'execute') {
        const executionId = uuidv4();
        
        // Validate request
        if (!data.code || !data.className) {
          ws.send(JSON.stringify({
            type: 'error',
            executionId,
            error: 'Missing required fields: code, className'
          }));
          return;
        }

        // Check concurrent execution limit
        if (currentExecutions >= MAX_CONCURRENT_EXECUTIONS) {
          ws.send(JSON.stringify({
            type: 'error',
            executionId,
            error: 'Server is at maximum capacity. Please try again later.'
          }));
          return;
        }

        currentExecutions++;
        
        // Send execution started event
        ws.send(JSON.stringify({
          type: 'started',
          executionId
        }));
        
        try {
          // Execute with real-time streaming
          await javaExecutor.compileAndRunStream({
            code: data.code,
            className: data.className,
            mainMethod: data.mainMethod !== false,
            executionId,
            timeout: data.timeout || 30000,
            onOutput: (output) => {
              ws.send(JSON.stringify({
                type: 'output',
                executionId,
                data: output
              }));
            },
            onError: (error) => {
              ws.send(JSON.stringify({
                type: 'error',
                executionId,
                error
              }));
            },
            onComplete: (result) => {
              ws.send(JSON.stringify({
                type: 'completed',
                executionId,
                result
              }));
            }
          });
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            executionId,
            error: error.message
          }));
        } finally {
          currentExecutions--;
        }
      }
    } catch (error) {
      logger.warn(`Invalid WebSocket message from ${connectionId}:`, error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', () => {
    logger.info(`WebSocket connection closed: ${connectionId}`);
  });
  
  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${connectionId}:`, error.message);
  });
});

// Execution status endpoint
app.get('/api/execution/:executionId/status', authenticate, (req, res) => {
  const { executionId } = req.params;
  const execution = activeExecutions.get(executionId);
  
  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found or has expired'
    });
  }
  
  res.json({
    executionId,
    status: execution.status,
    startTime: execution.startTime,
    endTime: execution.endTime,
    duration: execution.endTime ? execution.endTime - execution.startTime : Date.now() - execution.startTime,
    success: execution.success
  });
});

// System status endpoint
app.get('/api/status', authenticate, (req, res) => {
  const systemStats = javaExecutor.getSystemStats();
  
  res.json({
    service: 'Real Java Executor Service',
    version: require('./package.json').version,
    status: 'operational',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeExecutions: currentExecutions,
    maxExecutions: MAX_CONCURRENT_EXECUTIONS,
    java: {
      version: systemStats.javaVersion,
      home: process.env.JAVA_HOME,
      available: systemStats.javaAvailable
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  });
  
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  javaExecutor.cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  javaExecutor.cleanup();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Real Java Executor Service started on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    maxExecutions: MAX_CONCURRENT_EXECUTIONS,
    javaHome: process.env.JAVA_HOME
  });
  
  // Test Java availability on startup
  javaExecutor.testJavaAvailability().then(available => {
    if (!available) {
      logger.error('Java is not available - service will not function properly');
    } else {
      logger.info('Java runtime verified and ready');
    }
  });
});

module.exports = app;