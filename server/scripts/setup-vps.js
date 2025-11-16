#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Interactive VPS setup script
 * Helps users configure their analytics server for VPS deployment
 */
class VPSSetup {
  constructor() {
    this.config = {
      server: {},
      cors: {},
      ipWhitelist: {},
      security: {},
      database: {}
    };
  }

  async run() {
    console.log('🚀 Analytics Server VPS Setup');
    console.log('================================\n');

    await this.setupServerConfig();
    await this.setupCORSConfig();
    await this.setupIPWhitelist();
    await this.setupSecurityConfig();
    await this.setupDatabaseConfig();
    await this.generateEnvFile();
    await this.generateNginxConfig();
    
    console.log('\n✅ Setup complete!');
    console.log('📁 Generated files:');
    console.log('   - .env (environment configuration)');
    console.log('   - nginx.conf (Nginx configuration)');
    console.log('\n📖 Next steps:');
    console.log('   1. Review and customize the generated .env file');
    console.log('   2. Deploy the nginx.conf to your Nginx server');
    console.log('   3. Start your analytics server: npm start');
    console.log('   4. Test with: curl http://localhost:3001/health');
    
    rl.close();
  }

  async setupServerConfig() {
    console.log('📡 Server Configuration');
    
    this.config.server.port = await this.question('Port (3001): ') || '3001';
    this.config.server.environment = await this.question('Environment (development/staging/production): ') || 'production';
    this.config.server.host = await this.question('Host (0.0.0.0): ') || '0.0.0.0';
    
    console.log('');
  }

  async setupCORSConfig() {
    console.log('🌐 CORS Configuration');
    
    const corsType = await this.question('CORS setup type (single/multiple/wildcard/custom): ') || 'single';
    
    switch (corsType) {
      case 'single':
        const domain = await this.question('Domain (https://yourdomain.com): ') || 'https://yourdomain.com';
        this.config.cors.origins = [domain];
        break;
        
      case 'multiple':
        const domains = await this.question('Domains (comma-separated): ');
        this.config.cors.origins = domains.split(',').map(d => d.trim());
        break;
        
      case 'wildcard':
        const wildcard = await this.question('Wildcard pattern (https://*.yourdomain.com): ') || 'https://*.yourdomain.com';
        this.config.cors.origins = [wildcard];
        break;
        
      case 'custom':
        const custom = await this.question('Custom origins (comma-separated): ');
        this.config.cors.origins = custom.split(',').map(d => d.trim());
        break;
    }
    
    this.config.cors.credentials = await this.question('Allow credentials? (y/n): ') === 'y';
    
    console.log('');
  }

  async setupIPWhitelist() {
    console.log('🔒 IP Whitelist Configuration');
    
    const enableWhitelist = await this.question('Enable IP whitelist? (y/n): ') === 'y';
    
    if (enableWhitelist) {
      const ipType = await this.question('IP type (individual/cidr/mixed): ') || 'individual';
      
      switch (ipType) {
        case 'individual':
          const ips = await this.question('IP addresses (comma-separated): ');
          this.config.ipWhitelist.ips = ips.split(',').map(ip => ip.trim());
          this.config.ipWhitelist.cidrs = [];
          break;
          
        case 'cidr':
          const cidrs = await this.question('CIDR ranges (comma-separated): ');
          this.config.ipWhitelist.cidrs = cidrs.split(',').map(cidr => cidr.trim());
          this.config.ipWhitelist.ips = [];
          break;
          
        case 'mixed':
          const mixedIps = await this.question('IP addresses (comma-separated): ');
          const mixedCidrs = await this.question('CIDR ranges (comma-separated): ');
          this.config.ipWhitelist.ips = mixedIps ? mixedIps.split(',').map(ip => ip.trim()) : [];
          this.config.ipWhitelist.cidrs = mixedCidrs ? mixedCidrs.split(',').map(cidr => cidr.trim()) : [];
          break;
      }
      
      this.config.ipWhitelist.enabled = true;
    } else {
      this.config.ipWhitelist.enabled = false;
    }
    
    console.log('');
  }

  async setupSecurityConfig() {
    console.log('🛡️  Security Configuration');
    
    this.config.security.apiKeyRequired = await this.question('Require API key? (y/n): ') === 'y';
    this.config.security.rateLimitEnabled = await this.question('Enable rate limiting? (y/n): ') === 'y';
    
    if (this.config.security.rateLimitEnabled) {
      this.config.security.maxRequests = await this.question('Max requests per window (1000): ') || '1000';
      this.config.security.windowMs = await this.question('Window in minutes (15): ') || '15';
    }
    
    this.config.security.trustProxy = await this.question('Trust proxy headers? (y/n): ') === 'y';
    
    console.log('');
  }

  async setupDatabaseConfig() {
    console.log('🗄️  Database Configuration');
    
    this.config.database.mongoUri = await this.question('MongoDB URI (mongodb://localhost:27017/realtime_analytics): ') || 'mongodb://localhost:27017/realtime_analytics';
    this.config.database.redisUrl = await this.question('Redis URL (redis://localhost:6379): ') || 'redis://localhost:6379';
    
    console.log('');
  }

  async generateEnvFile() {
    const envContent = this.generateEnvContent();
    
    try {
      fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
      console.log('✅ Generated .env file');
    } catch (error) {
      console.error('❌ Failed to write .env file:', error.message);
    }
  }

  generateEnvContent() {
    const { server, cors, ipWhitelist, security, database } = this.config;
    
    let content = '# Server Configuration\n';
    content += `PORT=${server.port}\n`;
    content += `HOST=${server.host}\n`;
    content += `NODE_ENV=${server.environment}\n\n`;
    
    content += '# CORS Configuration\n';
    content += `CORS_ORIGINS=${cors.origins.join(',')}\n`;
    content += `CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS\n`;
    content += `CORS_HEADERS=Content-Type,Authorization,X-API-Key\n`;
    content += `CORS_CREDENTIALS=${cors.credentials}\n`;
    content += `CORS_MAX_AGE=86400\n\n`;
    
    content += '# IP Whitelist Configuration\n';
    if (ipWhitelist.enabled) {
      const allIps = [...(ipWhitelist.ips || []), ...(ipWhitelist.cidrs || [])];
      content += `IP_WHITELIST=${allIps.join(',')}\n`;
      content += `IP_WHITELIST_ENABLED=true\n`;
    } else {
      content += `IP_WHITELIST=\n`;
      content += `IP_WHITELIST_ENABLED=false\n`;
    }
    content += '\n';
    
    content += '# Security Configuration\n';
    content += `API_KEY_REQUIRED=${security.apiKeyRequired}\n`;
    content += `RATE_LIMIT_ENABLED=${security.rateLimitEnabled}\n`;
    if (security.rateLimitEnabled) {
      content += `MAX_REQUESTS_PER_WINDOW=${security.maxRequests}\n`;
      content += `RATE_LIMIT_WINDOW_MS=${security.windowMs * 60 * 1000}\n`;
    }
    content += `TRUST_PROXY=${security.trustProxy}\n\n`;
    
    content += '# Database Configuration\n';
    content += `MONGO_URI=${database.mongoUri}\n`;
    content += `REDIS_URL=${database.redisUrl}\n\n`;
    
    content += '# Analytics Configuration\n';
    content += 'BATCH_SIZE=100\n';
    content += 'BATCH_TIMEOUT_MS=5000\n';
    content += 'MAX_EVENT_SIZE=1048576\n';
    content += 'RETENTION_DAYS=90\n';
    
    return content;
  }

  async generateNginxConfig() {
    const nginxContent = this.generateNginxContent();
    
    try {
      fs.writeFileSync(path.join(__dirname, '../nginx.conf'), nginxContent);
      console.log('✅ Generated nginx.conf file');
    } catch (error) {
      console.error('❌ Failed to write nginx.conf file:', error.message);
    }
  }

  generateNginxContent() {
    const { server, cors } = this.config;
    
    let content = '# Nginx configuration for Analytics Server\n';
    content += '# Place this file in /etc/nginx/sites-available/ and symlink to sites-enabled/\n\n';
    
    content += 'server {\n';
    content += `    listen 80;\n`;
    content += `    server_name yourdomain.com www.yourdomain.com;\n\n`;
    
    content += '    # Redirect to HTTPS\n';
    content += '    return 301 https://$server_name$request_uri;\n';
    content += '}\n\n';
    
    content += 'server {\n';
    content += `    listen 443 ssl http2;\n`;
    content += `    server_name yourdomain.com www.yourdomain.com;\n\n`;
    
    content += '    # SSL Configuration\n';
    content += '    ssl_certificate /path/to/your/certificate.crt;\n';
    content += '    ssl_certificate_key /path/to/your/private.key;\n';
    content += '    ssl_protocols TLSv1.2 TLSv1.3;\n';
    content += '    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;\n';
    content += '    ssl_prefer_server_ciphers off;\n\n';
    
    content += '    # Security Headers\n';
    content += '    add_header X-Frame-Options DENY;\n';
    content += '    add_header X-Content-Type-Options nosniff;\n';
    content += '    add_header X-XSS-Protection "1; mode=block";\n';
    content += '    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";\n\n';
    
    content += '    # CORS Headers\n';
    if (cors.origins.length > 0) {
      content += `    add_header Access-Control-Allow-Origin "${cors.origins.join(' ')}";\n`;
    }
    content += '    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";\n';
    content += '    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-API-Key";\n';
    if (cors.credentials) {
      content += '    add_header Access-Control-Allow-Credentials "true";\n';
    }
    content += '\n';
    
    content += '    # Proxy Configuration\n';
    content += '    location / {\n';
    content += `        proxy_pass http://localhost:${server.port};\n`;
    content += '        proxy_set_header Host $host;\n';
    content += '        proxy_set_header X-Real-IP $remote_addr;\n';
    content += '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n';
    content += '        proxy_set_header X-Forwarded-Proto $scheme;\n';
    content += '        proxy_set_header X-Forwarded-Host $server_name;\n\n';
    
    content += '        # WebSocket support\n';
    content += '        proxy_http_version 1.1;\n';
    content += '        proxy_set_header Upgrade $http_upgrade;\n';
    content += '        proxy_set_header Connection "upgrade";\n';
    content += '        proxy_cache_bypass $http_upgrade;\n';
    content += '    }\n\n';
    
    content += '    # Gzip Compression\n';
    content += '    gzip on;\n';
    content += '    gzip_vary on;\n';
    content += '    gzip_min_length 1024;\n';
    content += '    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;\n\n';
    
    content += '    # Logging\n';
    content += '    access_log /var/log/nginx/analytics_access.log;\n';
    content += '    error_log /var/log/nginx/analytics_error.log;\n';
    content += '}\n';
    
    return content;
  }

  question(prompt) {
    return new Promise(resolve => {
      rl.question(`${prompt} `, resolve);
    });
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  const setup = new VPSSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = VPSSetup;