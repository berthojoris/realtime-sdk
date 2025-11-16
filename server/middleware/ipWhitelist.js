const config = require('../config/environment');

/**
 * IP Whitelist Middleware
 * Blocks requests from IPs not in the whitelist
 */
const ipWhitelistMiddleware = (req, res, next) => {
  // Skip IP whitelist check if disabled
  if (!config.ipWhitelist.enabled) {
    return next();
  }

  // Get client IP from various headers
  const clientIp = getClientIp(req);
  
  if (!clientIp) {
    return res.status(400).json({
      error: 'Unable to determine client IP',
      code: 'IP_DETECTION_FAILED'
    });
  }

  // Check if IP is whitelisted
  if (config.isIpWhitelisted(clientIp)) {
    // Add IP to request for logging
    req.clientIp = clientIp;
    return next();
  }

  // Log blocked IP attempt
  console.warn(`IP Whitelist: Blocked request from ${clientIp} to ${req.path}`);
  
  res.status(403).json({
    error: 'Access denied: IP not whitelisted',
    code: 'IP_NOT_ALLOWED',
    ip: clientIp
  });
};

/**
 * Extract client IP from request
 * @param {Object} req - Express request object
 * @returns {string|null} - Client IP address
 */
function getClientIp(req) {
  // Check various headers in order of preference
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const clientIp = req.headers['x-client-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
  const xForwardedFor = req.headers['x-forwarded-for'];
  
  // X-Forwarded-For can contain multiple IPs, take the first one
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0) {
      return ips[0];
    }
  }
  
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    if (ips.length > 0) {
      return ips[0];
    }
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (clientIp) {
    return clientIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to connection remote address
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.connection?.socket?.remoteAddress || 
         req.ip;
}

/**
 * Enhanced IP whitelist middleware with rate limiting per IP
 */
const ipWhitelistWithRateLimit = (req, res, next) => {
  // First check IP whitelist
  ipWhitelistMiddleware(req, res, (err) => {
    if (err) return next(err);
    
    // Add IP-based rate limiting headers
    const clientIp = req.clientIp;
    res.setHeader('X-Client-IP', clientIp);
    res.setHeader('X-IP-Whitelisted', 'true');
    
    next();
  });
};

/**
 * Conditional IP whitelist middleware
 * Only applies to specific routes or conditions
 * @param {Function} condition - Function that returns true if IP check should be applied
 * @returns {Function} - Middleware function
 */
const conditionalIpWhitelist = (condition) => {
  return (req, res, next) => {
    if (condition(req)) {
      return ipWhitelistMiddleware(req, res, next);
    }
    next();
  };
};

/**
 * IP whitelist middleware for API routes only
 */
const apiIpWhitelist = conditionalIpWhitelist((req) => {
  return req.path.startsWith('/api/');
});

/**
 * IP whitelist middleware for sensitive operations
 */
const sensitiveIpWhitelist = conditionalIpWhitelist((req) => {
  const sensitivePaths = [
    '/api/events',
    '/api/analytics',
    '/api/dashboard'
  ];
  return sensitivePaths.some(path => req.path.startsWith(path));
});

module.exports = {
  ipWhitelistMiddleware,
  ipWhitelistWithRateLimit,
  conditionalIpWhitelist,
  apiIpWhitelist,
  sensitiveIpWhitelist,
  getClientIp
};