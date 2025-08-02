const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * Applies to all API routes with a moderate limit
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    logger.warn('General API rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again after 15 minutes.',
      retryAfter: '15 minutes'
    });
  },
  // Skip rate limiting for successful requests to less sensitive endpoints
  skip: (req, res) => {
    // Don't count successful GET requests to public endpoints
    return req.method === 'GET' && res.statusCode < 400 && 
           (req.path.includes('/recipes') || req.path.includes('/products'));
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Much more restrictive to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      body: req.body ? Object.keys(req.body) : undefined
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
      retryAfter: '15 minutes'
    });
  },
  // Don't skip any auth requests - count all attempts
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

/**
 * Very strict rate limiter for password reset and sensitive operations
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests for this sensitive operation, please try again after 1 hour.',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    logger.error('Strict rate limit exceeded for sensitive operation', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many requests for this sensitive operation, please try again after 1 hour.',
      retryAfter: '1 hour'
    });
  }
});

/**
 * Lenient rate limiter for public endpoints
 */
const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for public endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again in a minute.',
    retryAfter: '1 minute'
  },
  handler: (req, res) => {
    logger.info('Public endpoint rate limit exceeded', {
      ip: req.ip,
      url: req.url
    });
    
    res.status(429).json({
      error: 'Too many requests, please try again in a minute.',
      retryAfter: '1 minute'
    });
  },
  skipSuccessfulRequests: true // Don't count successful requests
});

module.exports = {
  apiLimiter,
  authLimiter,
  strictLimiter,
  publicLimiter
};