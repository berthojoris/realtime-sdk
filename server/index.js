const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const Redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');

// Import routes and models
const eventRoutes = require('./routes/events');
const analyticsRoutes = require('./routes/analytics');
const dashboardRoutes = require('./routes/dashboard');
const Event = require('./models/Event');
const Session = require('./models/Session');
const User = require('./models/User');

class AnalyticsServer {
  constructor(config = {}) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.config = {
      port: config.port || 3001,
      mongoUri: config.mongoUri || 'mongodb://localhost:27017/realtime_analytics',
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      environment: config.environment || 'development',
      ...config
    };

    this.redis = null;
    this.mongoConnection = null;
  }

  async initialize() {
    try {
      await this.setupMiddleware();
      await this.connectDatabases();
      await this.setupRoutes();
      await this.setupSocketIO();
      await this.startServer();
      
      console.log(`🚀 Analytics Server running on port ${this.config.port}`);
      console.log(`📊 Dashboard available at http://localhost:${this.config.port}/dashboard`);
    } catch (error) {
      console.error('❌ Failed to initialize server:', error);
      process.exit(1);
    }
  }

  async setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.environment === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.config.environment === 'production' ? 1000 : 10000, // Limit each IP
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (this.config.environment === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: require('./package.json').version
      });
    });
  }

  async connectDatabases() {
    // Connect to MongoDB
    try {
      this.mongoConnection = await mongoose.connect(this.config.mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }

    // Connect to Redis
    try {
      this.redis = Redis.createClient({
        url: this.config.redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redis.on('error', (err) => console.error('Redis Client Error:', err));
      this.redis.on('connect', () => console.log('✅ Connected to Redis'));
      
      await this.redis.connect();
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      // Don't throw error - Redis is optional for basic functionality
    }
  }

  async setupRoutes() {
    // API routes
    this.app.use('/api/events', eventRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);

    // Serve static dashboard files
    this.app.use('/dashboard', express.static('public/dashboard'));
    
    // Dashboard route
    this.app.get('/dashboard', (req, res) => {
      res.sendFile('index.html', { root: 'public/dashboard' });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      
      res.status(err.status || 500).json({
        error: this.config.environment === 'production' 
          ? 'Internal server error' 
          : err.message,
        ...(this.config.environment === 'development' && { stack: err.stack })
      });
    });
  }

  async setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Join room for real-time analytics
      socket.on('join-analytics', (data) => {
        const room = data.room || 'global';
        socket.join(room);
        console.log(`📊 Client ${socket.id} joined analytics room: ${room}`);
      });

      // Handle real-time event subscriptions
      socket.on('subscribe-events', async (filters) => {
        try {
          const events = await this.getRealTimeEvents(filters);
          socket.emit('events-data', events);
        } catch (error) {
          socket.emit('error', { message: 'Failed to fetch events' });
        }
      });

      // Handle dashboard subscriptions
      socket.on('subscribe-dashboard', async () => {
        try {
          const dashboardData = await this.getDashboardData();
          socket.emit('dashboard-data', dashboardData);
        } catch (error) {
          socket.emit('error', { message: 'Failed to fetch dashboard data' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });

    // Set up real-time event broadcasting
    this.setupEventBroadcasting();
  }

  setupEventBroadcasting() {
    // Listen for new events and broadcast to connected clients
    const originalSave = Event.prototype.save;
    Event.prototype.save = async function() {
      const result = await originalSave.call(this);
      
      // Broadcast to all connected dashboard clients
      if (global.analyticsServer) {
        global.analyticsServer.io.emit('new-event', {
          eventType: this.eventType,
          eventName: this.eventName,
          timestamp: this.timestamp,
          sessionId: this.sessionId,
          userId: this.userId
        });
      }
      
      return result;
    };
  }

  async getRealTimeEvents(filters = {}) {
    const query = {};
    
    if (filters.eventType) {
      query.eventType = filters.eventType;
    }
    
    if (filters.sessionId) {
      query.sessionId = filters.sessionId;
    }
    
    if (filters.userId) {
      query.userId = filters.userId;
    }
    
    if (filters.timeRange) {
      const now = new Date();
      const timeRange = filters.timeRange;
      query.timestamp = {
        $gte: new Date(now.getTime() - timeRange * 60 * 1000)
      };
    }

    const events = await Event.find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return events;
  }

  async getDashboardData() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      events24h,
      totalSessions,
      sessions24h,
      totalUsers,
      users24h,
      topEvents,
      recentSessions
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ timestamp: { $gte: last24Hours } }),
      Session.countDocuments(),
      Session.countDocuments({ startTime: { $gte: last24Hours } }),
      User.countDocuments(),
      User.countDocuments({ lastSeen: { $gte: last24Hours } }),
      Event.aggregate([
        { $match: { timestamp: { $gte: last7Days } } },
        { $group: { _id: '$eventName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Session.find({ startTime: { $gte: last24Hours } })
        .sort({ startTime: -1 })
        .limit(10)
        .populate('userId', 'userId traits')
        .lean()
    ]);

    return {
      overview: {
        totalEvents,
        events24h,
        totalSessions,
        sessions24h,
        totalUsers,
        users24h
      },
      topEvents,
      recentSessions,
      timestamp: now.toISOString()
    };
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, (err) => {
        if (err) {
          reject(err);
        } else {
          global.analyticsServer = this;
          resolve();
        }
      });
    });
  }

  async shutdown() {
    console.log('🛑 Shutting down server...');
    
    if (this.mongoConnection) {
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected');
    }
    
    if (this.redis) {
      await this.redis.quit();
      console.log('✅ Redis disconnected');
    }
    
    this.server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  }
}

// Initialize server if this file is run directly
if (require.main === module) {
  const server = new AnalyticsServer({
    port: process.env.PORT || 3001,
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/realtime_analytics',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    environment: process.env.NODE_ENV || 'development'
  });

  server.initialize().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => server.shutdown());
  process.on('SIGINT', () => server.shutdown());
}

module.exports = AnalyticsServer;