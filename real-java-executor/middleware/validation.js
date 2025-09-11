const Joi = require('joi');
const logger = require('../utils/logger');

// Java code execution request validation schema
const javaExecutionSchema = Joi.object({
  code: Joi.string()
    .min(1)
    .max(100000) // 100KB max code size
    .required()
    .messages({
      'string.empty': 'Java code cannot be empty',
      'string.max': 'Java code cannot exceed 100KB',
      'any.required': 'Java code is required'
    }),
    
  className: Joi.string()
    .pattern(/^[A-Za-z_$][A-Za-z0-9_$]*$/)
    .max(100)
    .optional()
    .messages({
      'string.pattern.base': 'Class name must be a valid Java identifier',
      'string.max': 'Class name cannot exceed 100 characters'
    }),
    
  mainMethod: Joi.boolean()
    .default(true)
    .optional(),
    
  timeout: Joi.number()
    .integer()
    .min(1000)
    .max(120000) // Max 2 minutes
    .optional()
    .default(30000)
});

// Java compilation only request validation schema
const javaCompilationSchema = Joi.object({
  code: Joi.string()
    .min(1)
    .max(100000)
    .required()
    .messages({
      'string.empty': 'Java code cannot be empty',
      'string.max': 'Java code cannot exceed 100KB',
      'any.required': 'Java code is required'
    }),
    
  className: Joi.string()
    .pattern(/^[A-Za-z_$][A-Za-z0-9_$]*$/)
    .max(100)
    .optional()
    .messages({
      'string.pattern.base': 'Class name must be a valid Java identifier',
      'string.max': 'Class name cannot exceed 100 characters'
    })
});

// Validation middleware for Java execution requests
const validateJavaRequest = (req, res, next) => {
  const { error, value } = javaExecutionSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    logger.warn('Java execution request validation failed', {
      requestId: req.requestId,
      errors: errorDetails
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }
  
  // Additional security checks
  const code = value.code;
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /Runtime\.getRuntime\(\)/i,
    /ProcessBuilder/i,
    /System\.exit\(/i,
    /Files?\.delete/i,
    /new\s+File\(/i,
    /FileWriter|FileOutputStream|FileInputStream/i,
    /java\.io\.File/i,
    /java\.lang\.Process/i,
    /exec\(/i,
    /\bsudo\b/i,
    /\brm\b.*-rf/i,
    /\$\{/i, // Environment variable expansion
    /`[^`]*`/i, // Backticks
    /java\.nio\.file/i,
    /java\.net/i,
    /Socket/i,
    /URL\(/i,
    /HttpURLConnection/i
  ];
  
  const foundDangerousPatterns = dangerousPatterns.filter(pattern => pattern.test(code));
  
  if (foundDangerousPatterns.length > 0) {
    logger.warn('Potentially dangerous Java code detected', {
      requestId: req.requestId,
      patterns: foundDangerousPatterns.length,
      codeLength: code.length
    });
    
    return res.status(400).json({
      error: 'Code contains potentially dangerous operations',
      message: 'File I/O, network operations, process execution, and system operations are not allowed for security reasons'
    });
  }
  
  // Check code size after validation
  if (Buffer.byteLength(code, 'utf8') > 204800) { // 200KB
    return res.status(413).json({
      error: 'Code size exceeds maximum allowed limit (200KB)'
    });
  }
  
  req.body = value;
  next();
};

// Validation middleware for Java compilation requests
const validateCompileRequest = (req, res, next) => {
  const { error, value } = javaCompilationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    logger.warn('Java compilation request validation failed', {
      requestId: req.requestId,
      errors: errorDetails
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }
  
  req.body = value;
  next();
};

module.exports = {
  validateJavaRequest,
  validateCompileRequest,
  javaExecutionSchema,
  javaCompilationSchema
};