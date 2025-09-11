const Joi = require('joi');
const logger = require('../utils/logger');

// Java code validation schema
const javaCodeSchema = Joi.object({
  code: Joi.string()
    .min(1)
    .max(50000) // 50KB max code size
    .required()
    .pattern(/^[\s\S]*$/) // Allow any characters including newlines
    .messages({
      'string.empty': 'Java code cannot be empty',
      'string.max': 'Java code cannot exceed 50KB',
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
    
  executionTimeout: Joi.number()
    .integer()
    .min(1000)
    .max(60000) // Max 1 minute
    .optional()
    .default(30000)
});

// Validation middleware
const validateJavaCode = (req, res, next) => {
  const { error, value } = javaCodeSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    logger.warn('Java code validation failed', {
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
    /FileWriter|FileOutputStream/i,
    /java\.io\.File/i,
    /java\.lang\.Process/i,
    /exec\(/i,
    /\bsudo\b/i,
    /\brm\b.*-rf/i,
    /\$\{/i, // Environment variable expansion
    /`[^`]*`/i, // Backticks (command execution)
  ];
  
  const foundDangerousPatterns = dangerousPatterns.filter(pattern => pattern.test(code));
  
  if (foundDangerousPatterns.length > 0) {
    logger.warn('Potentially dangerous code detected', {
      requestId: req.requestId,
      patterns: foundDangerousPatterns.length,
      codeLength: code.length
    });
    
    return res.status(400).json({
      error: 'Code contains potentially dangerous operations',
      message: 'File I/O, process execution, and system operations are not allowed for security reasons'
    });
  }
  
  // Check code size after validation
  if (Buffer.byteLength(code, 'utf8') > 102400) { // 100KB
    return res.status(413).json({
      error: 'Code size exceeds maximum allowed limit (100KB)'
    });
  }
  
  req.body = value;
  next();
};

module.exports = {
  validateJavaCode,
  javaCodeSchema
};