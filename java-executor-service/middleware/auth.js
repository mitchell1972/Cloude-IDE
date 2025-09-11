const logger = require('../utils/logger');

// Simple API key authentication
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;
  
  // Skip authentication in development if no API key is set
  if (process.env.NODE_ENV === 'development' && !apiKey) {
    logger.debug('Skipping authentication in development mode');
    return next();
  }
  
  if (!authHeader) {
    logger.warn('Missing authorization header', {
      requestId: req.requestId,
      ip: req.ip
    });
    
    return res.status(401).json({
      error: 'Authorization required',
      message: 'Please provide a valid API key in the Authorization header'
    });
  }
  
  const providedKey = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (!apiKey || providedKey !== apiKey) {
    logger.warn('Invalid API key provided', {
      requestId: req.requestId,
      ip: req.ip,
      providedKeyLength: providedKey.length
    });
    
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }
  
  logger.debug('Authentication successful', {
    requestId: req.requestId
  });
  
  next();
};

// Optional authentication - continues even if auth fails
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;
  
  if (!authHeader || !apiKey) {
    req.authenticated = false;
    return next();
  }
  
  const providedKey = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  req.authenticated = providedKey === apiKey;
  next();
};

module.exports = {
  authenticate,
  optionalAuth
};