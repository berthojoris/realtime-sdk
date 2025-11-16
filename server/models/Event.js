const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  // Event identification
  eventType: {
    type: String,
    required: true,
    enum: ['click', 'navigation', 'scroll', 'input', 'error', 'custom'],
    index: true
  },
  eventName: {
    type: String,
    required: true,
    index: true
  },
  
  // Event properties (flexible schema for different event types)
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  
  // Session and user identification
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  
  // Context information
  url: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  referrer: {
    type: String,
    index: true
  },
  
  // Device and browser information
  screenResolution: String,
  viewportSize: String,
  timezone: String,
  language: String,
  
  // Metadata
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Batch information
  batchId: String,
  sentAt: Date,
  
  // Server-side processing
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Geolocation (if available)
  geo: {
    country: String,
    region: String,
    city: String,
    ip: String
  },
  
  // Performance metrics
  performance: {
    loadTime: Number,
    domContentLoaded: Number,
    firstContentfulPaint: Number,
    largestContentfulPaint: Number
  }
}, {
  // Enable automatic timestamps
  timestamps: true,
  
  // Use a custom collection name
  collection: 'events'
});

// Compound indexes for common queries
eventSchema.index({ sessionId: 1, timestamp: -1 });
eventSchema.index({ userId: 1, timestamp: -1 });
eventSchema.index({ eventType: 1, timestamp: -1 });
eventSchema.index({ eventName: 1, timestamp: -1 });
eventSchema.index({ url: 1, timestamp: -1 });
eventSchema.index({ receivedAt: 1 });

// TTL index for data retention (default 1 year)
eventSchema.index({ receivedAt: 1 }, { 
  expireAfterSeconds: 365 * 24 * 60 * 60 
});

// Pre-save middleware for data processing
eventSchema.pre('save', function(next) {
  // Ensure timestamp is a Date object
  if (this.timestamp && typeof this.timestamp === 'number') {
    this.timestamp = new Date(this.timestamp);
  }
  
  // Extract domain from URL for analytics
  if (this.url && !this.domain) {
    try {
      const urlObj = new URL(this.url);
      this.domain = urlObj.hostname;
    } catch (error) {
      // Invalid URL, skip domain extraction
    }
  }
  
  next();
});

// Static methods for common queries
eventSchema.statics = {
  // Get events by session
  async findBySessionId(sessionId, limit = 100) {
    return this.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get events by user
  async findByUserId(userId, limit = 100) {
    return this.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get events by time range
  async findByTimeRange(startDate, endDate, eventType = null) {
    const query = {
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    return this.find(query)
      .sort({ timestamp: -1 })
      .lean();
  },
  
  // Get event counts by type
  async getEventCountsByType(timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    return this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  },
  
  // Get top events by name
  async getTopEvents(limit = 10, timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    return this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  },
  
  // Get events by URL
  async getEventsByUrl(url, limit = 100) {
    return this.find({ url })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get real-time events (last 5 minutes)
  async getRealTimeEvents(limit = 50) {
    const startDate = new Date(Date.now() - 5 * 60 * 1000);
    
    return this.find({ timestamp: { $gte: startDate } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get funnel analysis
  async getFunnelAnalysis(events, timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const pipeline = [
      { $match: { 
        timestamp: { $gte: startDate },
        eventName: { $in: events }
      }},
      { $group: {
        _id: '$eventName',
        uniqueSessions: { $addToSet: '$sessionId' },
        count: { $sum: 1 }
      }},
      { $project: {
        eventName: '$_id',
        count: 1,
        uniqueSessions: { $size: '$uniqueSessions' }
      }},
      { $sort: { count: -1 } }
    ];
    
    return this.aggregate(pipeline);
  }
};

// Instance methods
eventSchema.methods = {
  // Check if event is recent (within last hour)
  isRecent() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.timestamp > oneHourAgo;
  },
  
  // Get event age in minutes
  getAgeInMinutes() {
    return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60));
  },
  
  // Anonymize sensitive data
  anonymize() {
    // Remove or mask sensitive fields
    if (this.properties) {
      const sensitiveKeys = ['email', 'password', 'token', 'key', 'secret'];
      sensitiveKeys.forEach(key => {
        if (this.properties[key]) {
          this.properties[key] = '***';
        }
      });
    }
    
    // Anonymize IP if present
    if (this.geo && this.geo.ip) {
      const ip = this.geo.ip.split('.');
      if (ip.length === 4) {
        this.geo.ip = `${ip[0]}.${ip[1]}.0.0`;
      }
    }
    
    return this;
  }
};

// Virtual fields
eventSchema.virtual('domain').get(function() {
  if (this.url) {
    try {
      return new URL(this.url).hostname;
    } catch (error) {
      return null;
    }
  }
  return null;
});

eventSchema.virtual('age').get(function() {
  return this.getAgeInMinutes();
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);