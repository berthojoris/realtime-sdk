const path = require('path');
require('dotenv').config();

/**
 * Environment configuration for analytics server
 * Supports multiple VPS deployments with flexible CORS and IP settings
 */
class EnvironmentConfig {
  constructor() {
    this.loadEnvironmentConfig();
  }

  loadEnvironmentConfig() {
    // Server configuration
    this.server = {
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
      host: process.env.HOST || '0.0.0.0'
    };

    // Database configuration
    this.database = {
      mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/realtime_analytics',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    };

    // CORS configuration
    this.cors = this.parseCorsConfig();

    // IP whitelist configuration
    this.ipWhitelist = this.parseIpWhitelist();

    // Security configuration
    this.security = {
      apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      maxRequestsPerWindow: parseInt(process.env.MAX_REQUESTS_PER_WINDOW) || 1000,
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
      trustProxy: process.env.TRUST_PROXY === 'true'
    };

    // Analytics configuration
    this.analytics = {
      batchSize: parseInt(process.env.BATCH_SIZE) || 100,
      batchTimeoutMs: parseInt(process.env.BATCH_TIMEOUT_MS) || 5000,
      maxEventSize: parseInt(process.env.MAX_EVENT_SIZE) || 1024 * 1024, // 1MB
      retentionDays: parseInt(process.env.RETENTION_DAYS) || 90
    };
  }

  parseCorsConfig() {
    const corsOrigins = process.env.CORS_ORIGINS;
    const corsMethods = process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS';
    const corsHeaders = process.env.CORS_HEADERS || 'Content-Type,Authorization,X-API-Key';
    const corsCredentials = process.env.CORS_CREDENTIALS !== 'false';

    let origins = [];
    
    if (corsOrigins) {
      // Parse comma-separated origins
      origins = corsOrigins.split(',').map(origin => origin.trim());
    } else {
      // Default origins based on environment
      if (this.server.environment === 'production') {
        origins = [
          'https://yourdomain.com',
          'https://www.yourdomain.com'
        ];
      } else {
        origins = [
          'http://localhost:3000',
          'http://localhost:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:8080'
        ];
      }
    }

    // Support wildcards and dynamic origins
    const processedOrigins = origins.map(origin => {
      if (origin === '*' || origin.includes('*')) {
        return origin; // Keep wildcard patterns
      }
      return origin;
    });

    return {
      origins: processedOrigins,
      methods: corsMethods.split(',').map(method => method.trim()),
      headers: corsHeaders.split(',').map(header => header.trim()),
      credentials: corsCredentials,
      maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400 // 24 hours
    };
  }

  parseIpWhitelist() {
    const whitelistEnv = process.env.IP_WHITELIST;
    
    if (!whitelistEnv) {
      return {
        enabled: false,
        ips: [],
        cidrs: []
      };
    }

    const enabled = process.env.IP_WHITELIST_ENABLED !== 'false';
    const ips = [];
    const cidrs = [];

    whitelistEnv.split(',').forEach(entry => {
      entry = entry.trim();
      if (entry.includes('/')) {
        cidrs.push(entry);
      } else {
        ips.push(entry);
      }
    });

    return {
      enabled,
      ips,
      cidrs
    };
  }

  /**
   * Check if an IP is whitelisted
   * @param {string} ip - IP address to check
   * @returns {boolean} - Whether IP is allowed
   */
  isIpWhitelisted(ip) {
    if (!this.ipWhitelist.enabled) {
      return true;
    }

    // Direct IP match
    if (this.ipWhitelist.ips.includes(ip)) {
      return true;
    }

    // CIDR range check
    for (const cidr of this.ipWhitelist.cidrs) {
      if (this.isIpInCidr(ip, cidr)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   * @param {string} ip - IP address
   * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
   * @returns {boolean} - Whether IP is in range
   */
  isIpInCidr(ip, cidr) {
    const [network, prefixLength] = cidr.split('/');
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
    
    return (ipInt & mask) === (networkInt & mask);
  }

  /**
   * Convert IP string to integer
   * @param {string} ip - IP address
   * @returns {number} - Integer representation
   */
  ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * Get CORS origin function for dynamic origin checking
   * @returns {Function} - CORS origin function
   */
  getCorsOriginFunction() {
    const allowedOrigins = this.cors.origins;
    
    return (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check for wildcard
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check for exact match
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check for pattern matches
      for (const allowedOrigin of allowedOrigins) {
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          if (regex.test(origin)) {
            return callback(null, true);
          }
        }
      }

      // Origin not allowed
      console.warn(`CORS: Origin ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    };
  }

  /**
   * Get configuration summary for logging
   * @returns {Object} - Configuration summary
   */
  getConfigSummary() {
    return {
      environment: this.server.environment,
      cors: {
        originsCount: this.cors.origins.length,
        credentials: this.cors.credentials,
        methods: this.cors.methods
      },
      ipWhitelist: {
        enabled: this.ipWhitelist.enabled,
        ipsCount: this.ipWhitelist.ips.length,
        cidrsCount: this.ipWhitelist.cidrs.length
      },
      security: {
        apiKeyRequired: this.security.apiKeyRequired,
        rateLimitEnabled: this.security.rateLimitEnabled,
        trustProxy: this.security.trustProxy
      }
    };
  }
}

module.exports = new EnvironmentConfig();