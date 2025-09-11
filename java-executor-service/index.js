const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./utils/logger');
const javaExecutor = require('./services/javaExecutor');
const { validateJavaCode } = require('./middleware/validation');
const { authenticate } = require('./middleware/auth');
const healthCheck = require('./routes/health');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const MAX_CONCURRENT_EXECUTIONS = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 10;

// Global execution tracking
const activeExecutions = new Map();
let currentExecutions = 0;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
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
app.use(express.json({ limit: `${process.env.MAX_FILE_SIZE_KB || 100}kb` }));
app.use(express.urlencoded({ extended: true, limit: `${process.env.MAX_FILE_SIZE_KB || 100}kb` }));

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

// Health check route
app.use('/health', healthCheck);

// Java execution endpoint
app.post('/api/execute', authenticate, validateJavaCode, async (req, res) => {
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
      status: 'running'
    });

    const { code, className, mainMethod = true } = req.body;
    
    logger.info(`Starting Java execution ${executionId}`, {
      executionId,
      requestId: req.requestId,
      codeLength: code.length,
      className,
      mainMethod
    });

    // Set response headers for real-time streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Execution-ID', executionId);
    
    // Execute Java code
    const result = await javaExecutor.execute({
      code,
      className,
      mainMethod,
      executionId,
      maxTime: parseInt(process.env.MAX_EXECUTION_TIME) || 30000,
      maxMemory: parseInt(process.env.MAX_MEMORY_MB) || 512
    });

    // Update execution status
    activeExecutions.set(executionId, {
      ...activeExecutions.get(executionId),
      status: 'completed',
      endTime: Date.now()
    });

    logger.info(`Java execution completed ${executionId}`, {
      executionId,
      success: result.success,
      executionTime: result.executionTime
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
    duration: execution.endTime ? execution.endTime - execution.startTime : Date.now() - execution.startTime
  });
});

// WebSocket connection for real-time output
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  logger.info(`WebSocket connection established: ${connectionId}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe' && data.executionId) {
        ws.executionId = data.executionId;
        ws.send(JSON.stringify({
          type: 'subscribed',
          executionId: data.executionId
        }));
      }
    } catch (error) {
      logger.warn(`Invalid WebSocket message from ${connectionId}:`, error.message);
    }
  });
  
  ws.on('close', () => {
    logger.info(`WebSocket connection closed: ${connectionId}`);
  });
  
  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${connectionId}:`, error.message);
  });
});

// System status endpoint
app.get('/api/status', authenticate, (req, res) => {
  res.json({
    service: 'Java Executor Service',
    version: require('./package.json').version,
    status: 'operational',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeExecutions: currentExecutions,
    maxExecutions: MAX_CONCURRENT_EXECUTIONS,
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
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Java Executor Service started on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    maxExecutions: MAX_CONCURRENT_EXECUTIONS
  });
});

module.exports = { app, server, wss };