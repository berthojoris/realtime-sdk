const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  anonymousId: {
    type: String,
    index: true
  },
  
  // User traits and properties
  traits: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamps
  firstSeen: {
    type: Date,
    required: true,
    index: true
  },
  lastSeen: {
    type: Date,
    required: true,
    index: true
  },
  
  // Activity metrics
  sessionCount: {
    type: Number,
    default: 1,
    min: 0
  },
  totalEvents: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPageViews: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTimeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // User status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isIdentified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Device and browser information
  devices: [{
    userAgent: String,
    screenResolution: String,
    viewportSize: String,
    timezone: String,
    language: String,
    firstUsed: Date,
    lastUsed: Date,
    usageCount: Number
  }],
  
  // Geolocation data
  locations: [{
    country: String,
    region: String,
    city: String,
    ip: String,
    latitude: Number,
    longitude: Number,
    firstSeen: Date,
    lastSeen: Date,
    visitCount: Number
  }],
  
  // Behavioral data
  behavior: {
    avgSessionDuration: Number,
    avgPageViewsPerSession: Number,
    bounceRate: Number,
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    conversionEvents: [String],
    lastConversionDate: Date
  },
  
  // Preferences and settings
  preferences: {
    timezone: String,
    language: String,
    notifications: {
      email: Boolean,
      push: Boolean,
      inApp: Boolean
    },
    privacy: {
      trackingConsent: Boolean,
      marketingConsent: Boolean,
      analyticsConsent: Boolean
    }
  },
  
  // Segmentation
  segments: [{
    name: String,
    addedAt: Date,
    properties: mongoose.Schema.Types.Mixed
  }],
  
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
  collection: 'users'
});

// Compound indexes for common queries
userSchema.index({ isActive: 1, lastSeen: -1 });
userSchema.index({ isIdentified: 1, lastSeen: -1 });
userSchema.index({ firstSeen: -1 });
userSchema.index({ 'behavior.engagementScore': -1 });
userSchema.index({ 'segments.name': 1 });

// TTL index for inactive users (default 2 years)
userSchema.index({ lastSeen: 1 }, { 
  expireAfterSeconds: 2 * 365 * 24 * 60 * 60,
  partialFilterExpression: { 
    isActive: false,
    isIdentified: false
  }
});

// Pre-save middleware for data processing
userSchema.pre('save', function(next) {
  // Ensure timestamps are Date objects
  if (this.firstSeen && typeof this.firstSeen === 'number') {
    this.firstSeen = new Date(this.firstSeen);
  }
  
  if (this.lastSeen && typeof this.lastSeen === 'number') {
    this.lastSeen = new Date(this.lastSeen);
  }
  
  // Update identified status
  this.isIdentified = !this.userId.startsWith('anon_');
  
  // Calculate engagement score
  this.calculateEngagementScore();
  
  next();
});

// Static methods for common queries
userSchema.statics = {
  // Get active users
  async getActiveUsers(limit = 100) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return this.find({ 
      isActive: true,
      lastSeen: { $gte: thirtyDaysAgo }
    })
      .sort({ lastSeen: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get user by ID
  async findByUserId(userId) {
    return this.findOne({ userId })
      .lean();
  },
  
  // Get users by time range
  async findByTimeRange(startDate, endDate) {
    return this.find({
      firstSeen: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .sort({ firstSeen: -1 })
      .lean();
  },
  
  // Get user statistics
  async getUserStats(timeRange = 24) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      totalUsers,
      activeUsers,
      newUsers,
      identifiedUsers,
      topCountries,
      avgEngagement
    ] = await Promise.all([
      this.countDocuments(),
      this.countDocuments({ 
        isActive: true,
        lastSeen: { $gte: startDate }
      }),
      this.countDocuments({ firstSeen: { $gte: startDate } }),
      this.countDocuments({ isIdentified: true }),
      this.aggregate([
        { $unwind: '$locations' },
        { $group: { _id: '$locations.country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, avgEngagement: { $avg: '$behavior.engagementScore' } } }
      ])
    ]);
    
    return {
      totalUsers,
      activeUsers,
      newUsers,
      identifiedUsers,
      topCountries,
      avgEngagement: avgEngagement[0]?.avgEngagement || 0
    };
  },
  
  // Get user cohorts
  async getUserCohorts() {
    const now = new Date();
    const cohorts = [];
    
    // Define cohort periods (last 12 months)
    for (let i = 0; i < 12; i++) {
      const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const cohortUsers = await this.find({
        firstSeen: { $gte: cohortStart, $lte: cohortEnd }
      }).lean();
      
      // Calculate retention rates for this cohort
      const retentionData = await this.calculateRetention(cohortUsers, cohortStart);
      
      cohorts.push({
        period: cohortStart.toISOString().substring(0, 7),
        cohortSize: cohortUsers.length,
        retention: retentionData
      });
    }
    
    return cohorts.reverse();
  },
  
  // Calculate retention for a cohort
  async calculateRetention(cohortUsers, cohortStart) {
    const retention = [];
    const periods = [1, 7, 30, 90]; // days
    
    for (const period of periods) {
      const periodDate = new Date(cohortStart.getTime() + period * 24 * 60 * 60 * 1000);
      const nextPeriodDate = new Date(cohortStart.getTime() + (period + 1) * 24 * 60 * 60 * 1000);
      
      const retainedUsers = await this.countDocuments({
        userId: { $in: cohortUsers.map(u => u.userId) },
        lastSeen: { $gte: periodDate, $lt: nextPeriodDate }
      });
      
      retention.push({
        period: `${period}d`,
        count: retainedUsers,
        percentage: cohortUsers.length > 0 ? (retainedUsers / cohortUsers.length) * 100 : 0
      });
    }
    
    return retention;
  },
  
  // Get user segments
  async getUserSegments() {
    return this.aggregate([
      { $unwind: '$segments' },
      { $group: { _id: '$segments.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  },
  
  // Search users
  async searchUsers(query, limit = 20) {
    const searchRegex = new RegExp(query, 'i');
    
    return this.find({
      $or: [
        { userId: searchRegex },
        { 'traits.email': searchRegex },
        { 'traits.name': searchRegex },
        { 'traits.firstName': searchRegex },
        { 'traits.lastName': searchRegex }
      ]
    })
      .sort({ lastSeen: -1 })
      .limit(limit)
      .lean();
  },
  
  // Get top users by engagement
  async getTopUsersByEngagement(limit = 10) {
    return this.find({ isActive: true })
      .sort({ 'behavior.engagementScore': -1 })
      .limit(limit)
      .lean();
  }
};

// Instance methods
userSchema.methods = {
  // Update user activity
  updateActivity(sessionData) {
    this.lastSeen = new Date();
    this.totalEvents += sessionData.eventsCount || 0;
    this.totalPageViews += sessionData.pageViews || 0;
    this.totalTimeSpent += sessionData.duration || 0;
    
    // Update device information
    this.updateDeviceInfo(sessionData);
    
    // Update location information
    this.updateLocationInfo(sessionData);
    
    return this.save();
  },
  
  // Update device information
  updateDeviceInfo(sessionData) {
    const deviceInfo = {
      userAgent: sessionData.userAgent,
      screenResolution: sessionData.screenResolution,
      viewportSize: sessionData.viewportSize,
      timezone: sessionData.timezone,
      language: sessionData.language,
      firstUsed: new Date(),
      lastUsed: new Date(),
      usageCount: 1
    };
    
    // Check if device already exists
    const existingDevice = this.devices.find(device => 
      device.userAgent === sessionData.userAgent
    );
    
    if (existingDevice) {
      existingDevice.lastUsed = new Date();
      existingDevice.usageCount += 1;
    } else {
      this.devices.push(deviceInfo);
    }
  },
  
  // Update location information
  updateLocationInfo(sessionData) {
    if (!sessionData.geo) return;
    
    const locationInfo = {
      country: sessionData.geo.country,
      region: sessionData.geo.region,
      city: sessionData.geo.city,
      ip: sessionData.geo.ip,
      latitude: sessionData.geo.latitude,
      longitude: sessionData.geo.longitude,
      firstSeen: new Date(),
      lastSeen: new Date(),
      visitCount: 1
    };
    
    // Check if location already exists
    const existingLocation = this.locations.find(location => 
      location.city === sessionData.geo.city && 
      location.country === sessionData.geo.country
    );
    
    if (existingLocation) {
      existingLocation.lastSeen = new Date();
      existingLocation.visitCount += 1;
    } else {
      this.locations.push(locationInfo);
    }
  },
  
  // Calculate engagement score
  calculateEngagementScore() {
    let score = 0;
    
    // Score from session frequency (max 25 points)
    const avgSessionsPerMonth = this.sessionCount / Math.max(1, this.getAgeInDays() / 30);
    score += Math.min(avgSessionsPerMonth * 5, 25);
    
    // Score from total events (max 25 points)
    score += Math.min(this.totalEvents / 100 * 25, 25);
    
    // Score from time spent (max 25 points)
    const totalHours = this.totalTimeSpent / (1000 * 60 * 60);
    score += Math.min(totalHours * 5, 25);
    
    // Score from identification (max 25 points)
    if (this.isIdentified) {
      score += 25;
    }
    
    this.behavior.engagementScore = Math.round(Math.min(score, 100));
  },
  
  // Get user age in days
  getAgeInDays() {
    return Math.floor((Date.now() - this.firstSeen.getTime()) / (1000 * 60 * 60 * 24));
  },
  
  // Get days since last activity
  getDaysSinceLastActivity() {
    return Math.floor((Date.now() - this.lastSeen.getTime()) / (1000 * 60 * 60 * 24));
  },
  
  // Check if user is recently active
  isRecentlyActive(days = 7) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.lastSeen > threshold;
  },
  
  // Add user to segment
  addToSegment(segmentName, properties = {}) {
    const existingSegment = this.segments.find(seg => seg.name === segmentName);
    
    if (!existingSegment) {
      this.segments.push({
        name: segmentName,
        addedAt: new Date(),
        properties
      });
    }
    
    return this.save();
  },
  
  // Remove user from segment
  removeFromSegment(segmentName) {
    this.segments = this.segments.filter(seg => seg.name !== segmentName);
    return this.save();
  },
  
  // Update user traits
  updateTraits(newTraits) {
    this.traits = { ...this.traits, ...newTraits };
    return this.save();
  },
  
  // Anonymize user data
  anonymize() {
    // Remove or mask sensitive traits
    if (this.traits) {
      const sensitiveKeys = ['email', 'phone', 'name', 'firstName', 'lastName'];
      sensitiveKeys.forEach(key => {
        if (this.traits[key]) {
          this.traits[key] = '***';
        }
      });
    }
    
    // Anonymize location data
    this.locations.forEach(location => {
      if (location.ip) {
        const ip = location.ip.split('.');
        if (ip.length === 4) {
          location.ip = `${ip[0]}.${ip[1]}.0.0`;
        }
      }
    });
    
    return this;
  }
};

// Virtual fields
userSchema.virtual('ageDays').get(function() {
  return this.getAgeInDays();
});

userSchema.virtual('daysSinceLastActivity').get(function() {
  return this.getDaysSinceLastActivity();
});

userSchema.virtual('isRecent').get(function() {
  return this.isRecentlyActive();
});

userSchema.virtual('avgSessionDurationMinutes').get(function() {
  return this.behavior.avgSessionDuration ? 
    Math.floor(this.behavior.avgSessionDuration / (1000 * 60)) : 0;
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);