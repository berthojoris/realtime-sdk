const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User identification
  userId: {
    type: String,
    index: true
  },
  
  // Timestamps
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  lastActivity: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date,
    index: true
  },
  
  // Session metrics
  pageViews: {
    type: Number,
    default: 0,
    min: 0
  },
  eventsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  duration: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Session status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Navigation information
  referrer: String,
  landingPage: {
    type: String,
    required: true,
    index: true
  },
  exitPage: String,
  
  // Device and browser information
  userAgent: {
    type: String,
    required: true
  },
  timezone: String,
  language: String,
  screenResolution: String,
  viewportSize: String,
  
  // Geolocation
  geo: {
    country: String,
    region: String,
    city: String,
    ip: String,
    latitude: Number,
    longitude: Number
  },
  
  // Device fingerprinting
  fingerprint: {
    type: String,
    index: true
  },
  
  // Session quality metrics
  bounceRate: {
    type: Boolean,
    default: false
  },
  engagementScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Custom properties
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Server-side processing
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  // Enable automatic timestamps
  timestamps: true,
  
  // Use a custom collection name
  collection: 'sessions'
});

// Compound indexes for common queries
sessionSchema.index({ userId: 1, startTime: -1 });
sessionSchema.index({ isActive: 1, lastActivity: -1 });
sessionSchema.index({ startTime: -1 });
sessionSchema.index({ landingPage: 1, startTime: -1 });
sessionSchema.index({ fingerprint: 1, startTime: -1 });

// TTL index for inactive sessions (default 90 days)
sessionSchema.index({ endTime: 1 }, { 
  expireAfterSeconds: 90 * 24 * 60 * 60,
  partialFilterExpression: { 
    endTime: { $exists: true },
    isActive: false 
  }
});

// Pre-save middleware for data processing
sessionSchema.pre('save', function(next) {
  // Ensure timestamps are Date objects
  if (this.startTime && typeof this.startTime === 'number') {
    this.startTime = new Date(this.startTime);
  }
  
  if (this.lastActivity && typeof this.lastActivity === 'number') {
    this.lastActivity = new Date(this.lastActivity);
  }
  
  // Calculate duration if not set
  if (!this.duration && this.startTime) {
    const endTime = this.endTime || new Date();
    this.duration = endTime.getTime() - this.startTime.getTime();
  }
  
  // Determine if session is a bounce (single page view)
  if (this.pageViews === 1 && !this.isActive) {
    this.bounceRate = true;
  }
  
  // Calculate engagement score based on duration and interactions
  this.calculateEngagementScore();
  
  next();
});

// Static methods for common queries
sessionSchema.statics = {
  // Get active sessions
  async getActiveSessions(limit = 100) {
    return this.find({ isActive: true })
      .sort({ lastActivity: -1 })
      .limit(limit)
      .populate('userId', 'userId traits')
      .lean();
  },
  
  // Get sessions by user
  async findByUserId(userId, limit = 50) {
    return this.find({ userId })
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get sessions by time range
  async findByTimeRange(startDate, endDate) {
    return this.find({
      startTime: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .sort({ startTime: -1 })
      .lean();
  },
  
  // Get session statistics
  async getSessionStats(timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      totalSessions,
      activeSessions,
      avgDuration,
      bounceRate,
      topLandingPages
    ] = await Promise.all([
      this.countDocuments({ startTime: { $gte: startDate } }),
      this.countDocuments({ 
        isActive: true,
        startTime: { $gte: startDate }
      }),
      this.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      this.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { 
          _id: null, 
          total: { $sum: 1 },
          bounces: { $sum: { $cond: ['$bounceRate', 1, 0] } }
        }},
        { $project: {
          bounceRate: { $divide: ['$bounces', '$total'] }
        }}
      ]),
      this.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { _id: '$landingPage', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    return {
      totalSessions,
      activeSessions,
      avgDuration: avgDuration[0]?.avgDuration || 0,
      bounceRate: bounceRate[0]?.bounceRate || 0,
      topLandingPages
    };
  },
  
  // Get user journey
  async getUserJourney(userId, limit = 10) {
    return this.find({ userId })
      .sort({ startTime: -1 })
      .limit(limit)
      .populate({
        path: 'userId',
        select: 'userId traits'
      })
      .lean();
  },
  
  // Get real-time sessions (last 30 minutes)
  async getRealTimeSessions(limit = 50) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    return this.find({
      $or: [
        { isActive: true },
        { lastActivity: { $gte: thirtyMinutesAgo } }
      ]
    })
      .sort({ lastActivity: -1 })
      .limit(limit)
      .lean();
  },
  
  // End inactive sessions
  async endInactiveSessions(inactivityThreshold = 30) {
    const threshold = new Date(Date.now() - inactivityThreshold * 60 * 1000);
    
    return this.updateMany(
      { 
        isActive: true,
        lastActivity: { $lt: threshold }
      },
      { 
        isActive: false,
        endTime: new Date()
      }
    );
  },
  
  // Get session funnel
  async getSessionFunnel(steps, timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const pipeline = steps.map((step, index) => ({
      $match: {
        startTime: { $gte: startDate },
        landingPage: { $regex: step, $options: 'i' }
      }
    }));
    
    // This is a simplified funnel analysis
    // In practice, you'd want to track page transitions within sessions
    return this.aggregate([
      { $match: { startTime: { $gte: startDate } } },
      { $group: {
        _id: '$landingPage',
        sessions: { $sum: 1 }
      }},
      { $sort: { sessions: -1 } }
    ]);
  }
};

// Instance methods
sessionSchema.methods = {
  // Check if session is active
  isSessionActive() {
    if (!this.isActive) return false;
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return this.lastActivity > thirtyMinutesAgo;
  },
  
  // Update session activity
  updateActivity() {
    this.lastActivity = new Date();
    this.isActive = true;
    
    // Recalculate duration
    if (this.startTime) {
      this.duration = this.lastActivity.getTime() - this.startTime.getTime();
    }
    
    return this.save();
  },
  
  // End session
  endSession() {
    this.isActive = false;
    this.endTime = new Date();
    
    if (this.startTime) {
      this.duration = this.endTime.getTime() - this.startTime.getTime();
    }
    
    this.calculateEngagementScore();
    
    return this.save();
  },
  
  // Calculate engagement score
  calculateEngagementScore() {
    let score = 0;
    
    // Base score from duration (max 40 points)
    const durationMinutes = this.duration / (1000 * 60);
    score += Math.min(durationMinutes / 10 * 40, 40);
    
    // Score from page views (max 30 points)
    score += Math.min(this.pageViews * 5, 30);
    
    // Score from events (max 30 points)
    score += Math.min(this.eventsCount * 2, 30);
    
    // Penalty for bounce
    if (this.bounceRate) {
      score *= 0.3;
    }
    
    this.engagementScore = Math.round(Math.min(score, 100));
  },
  
  // Get session duration in minutes
  getDurationInMinutes() {
    return Math.floor(this.duration / (1000 * 60));
  },
  
  // Get session age in minutes
  getAgeInMinutes() {
    return Math.floor((Date.now() - this.startTime.getTime()) / (1000 * 60));
  },
  
  // Anonymize session data
  anonymize() {
    // Remove or mask sensitive fields
    if (this.geo && this.geo.ip) {
      const ip = this.geo.ip.split('.');
      if (ip.length === 4) {
        this.geo.ip = `${ip[0]}.${ip[1]}.0.0`;
      }
    }
    
    // Remove user ID for privacy
    this.userId = undefined;
    
    return this;
  }
};

// Virtual fields
sessionSchema.virtual('durationMinutes').get(function() {
  return this.getDurationInMinutes();
});

sessionSchema.virtual('ageMinutes').get(function() {
  return this.getAgeInMinutes();
});

sessionSchema.virtual('isRecent').get(function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.lastActivity > oneHourAgo;
});

// Ensure virtuals are included in JSON output
sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);