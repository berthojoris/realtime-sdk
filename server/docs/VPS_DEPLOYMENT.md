# VPS Deployment Guide for Analytics Server

This guide explains how to configure the analytics server for deployment on different VPS instances with proper CORS and IP whitelist settings.

## Overview

The analytics server now supports flexible configuration for multi-VPS deployments, allowing you to:
- Configure multiple CORS origins
- Set up IP whitelists for security
- Deploy across different environments (development, staging, production)
- Support wildcard domains and subdomains

## Configuration Files

### 1. Environment Configuration (`.env`)

Copy the example environment file and customize it for your deployment:

```bash
cp .env.example .env
```

Key configuration sections:

#### Server Configuration
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
```

#### CORS Configuration
```env
# Multiple domains
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com

# Wildcard subdomains
CORS_ORIGINS=https://*.yourdomain.com

# Multiple domains with wildcards
CORS_ORIGINS=https://*.yourdomain.com,https://*.anotherdomain.com
```

#### IP Whitelist Configuration
```env
# Individual IPs
IP_WHITELIST=192.168.1.100,10.0.0.50

# CIDR ranges
IP_WHITELIST=192.168.1.0/24,10.0.0.0/8

# Mixed IPs and CIDR ranges
IP_WHITELIST=192.168.1.100,10.0.0.0/8,172.16.0.0/12
```

## Deployment Scenarios

### Scenario 1: Single Domain with CDN

```env
NODE_ENV=production
CORS_ORIGINS=https://app.yourdomain.com,https://cdn.yourdomain.com
IP_WHITELIST=203.0.113.10,198.51.100.0/24
TRUST_PROXY=true
```

**Setup:**
- Main application at `app.yourdomain.com`
- CDN serving static assets at `cdn.yourdomain.com`
- VPS IP: `203.0.113.10`
- Office network: `198.51.100.0/24`

### Scenario 2: Multi-Region Deployment

```env
NODE_ENV=production
CORS_ORIGINS=https://app.yourdomain.com,https://eu-app.yourdomain.com,https://asia-app.yourdomain.com
IP_WHITELIST=203.0.113.0/24,198.51.100.0/24,192.0.2.0/24
TRUST_PROXY=true
```

**Setup:**
- US server: `203.0.113.0/24`
- EU server: `198.51.100.0/24`
- Asia server: `192.0.2.0/24`

### Scenario 3: Development Environment

```env
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000
IP_WHITELIST_ENABLED=false
RATE_LIMIT_ENABLED=false
```

**Setup:**
- Local development servers
- IP whitelist disabled for easy testing
- Rate limiting disabled for debugging

### Scenario 4: Staging Environment

```env
NODE_ENV=staging
CORS_ORIGINS=https://staging.yourdomain.com,https://test.yourdomain.com
IP_WHITELIST=192.168.1.0/24
API_KEY_REQUIRED=true
```

**Setup:**
- Staging domain: `staging.yourdomain.com`
- Test domain: `test.yourdomain.com`
- Internal network access only

## Security Configuration

### IP Whitelist Best Practices

1. **Enable in Production**: Always enable IP whitelist in production
2. **Use CIDR Ranges**: Prefer CIDR ranges over individual IPs for flexibility
3. **Include Backup IPs**: Add multiple IPs for redundancy
4. **Monitor Access**: Log blocked IP attempts for security monitoring

### CORS Security

1. **Avoid Wildcards**: Don't use `*` in production environments
2. **Specific Origins**: List exact domains instead of wildcards when possible
3. **Credentials**: Only enable credentials if absolutely necessary
4. **Methods**: Limit to only necessary HTTP methods

### Rate Limiting

```env
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_WINDOW=1000
RATE_LIMIT_WINDOW_MS=900000
```

## Nginx Configuration Example

When using Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Deployment

### Dockerfile Example

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  analytics:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - CORS_ORIGINS=https://yourdomain.com
      - IP_WHITELIST=192.168.1.0/24
      - MONGO_URI=mongodb://mongo:27017/analytics
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:5
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

## Testing Configuration

### Testing CORS Origins

```bash
# Test CORS preflight request
curl -X OPTIONS http://your-server:3001/api/events \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

### Testing IP Whitelist

```bash
# Test from allowed IP
curl http://your-server:3001/health

# Test from blocked IP (should return 403)
curl http://your-server:3001/health
```

## Monitoring and Logging

### Health Check Endpoint

The server provides a comprehensive health check endpoint:

```bash
curl http://your-server:3001/health
```

Response includes:
- Server status
- Configuration summary
- Memory usage
- Uptime

### Logging

The server logs:
- CORS violations
- IP whitelist blocks
- Rate limit hits
- Configuration changes

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check if origin is in `CORS_ORIGINS`
   - Verify wildcard patterns
   - Check preflight requests

2. **IP Whitelist Blocks**
   - Verify IP detection with `X-Client-IP` header
   - Check proxy configuration (`TRUST_PROXY`)
   - Validate CIDR notation

3. **Rate Limiting**
   - Check rate limit headers
   - Verify IP-based limiting
   - Adjust limits as needed

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
RATE_LIMIT_ENABLED=false
IP_WHITELIST_ENABLED=false
```

## Migration Guide

### From Old Configuration

1. Copy existing `.env` file
2. Update CORS origins format
3. Add IP whitelist configuration
4. Test with new configuration
5. Deploy to production

### Configuration Validation

The server validates configuration on startup and logs any issues. Check the startup logs for configuration problems.

## Support

For issues with VPS deployment configuration:

1. Check the health endpoint for configuration summary
2. Review server logs for CORS/IP errors
3. Test with curl commands
4. Verify environment variables are set correctly