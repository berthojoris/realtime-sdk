const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Session = require('../models/Session');
const User = require('../models/User');

// GET /api/dashboard - Get dashboard data
router.get('/', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      overview,
      realtimeEvents,
      topPages,
      recentSessions,
      systemHealth
    ] = await Promise.all([
      getOverviewData(startDate),
      getRealtimeEvents(),
      getTopPages(startDate),
      getRecentSessions(startDate),
      getSystemHealth()
    ]);
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      data: {
        overview,
        realtime: {
          events: realtimeEvents
        },
        topPages,
        recentSessions,
        systemHealth
      }
    });
    
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard data',
      code: 'DASHBOARD_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/dashboard/realtime - Get real-time data
router.get('/realtime', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const [events, activeSessions, metrics] = await Promise.all([
      Event.find({ timestamp: { $gte: fiveMinutesAgo } })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean(),
      Session.find({ 
        isActive: true,
        lastActivity: { $gte: fiveMinutesAgo }
      })
        .sort({ lastActivity: -1 })
        .limit(20)
        .lean(),
      getRealtimeMetrics(fiveMinutesAgo)
    ]);
    
    res.json({
      success: true,
      events,
      activeSessions,
      metrics
    });
    
  } catch (error) {
    console.error('Error getting real-time data:', error);
    res.status(500).json({
      error: 'Failed to retrieve real-time data',
      code: 'REALTIME_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/dashboard/performance - Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      eventMetrics,
      sessionMetrics,
      userMetrics,
      systemMetrics
    ] = await Promise.all([
      getEventPerformanceMetrics(startDate),
      getSessionPerformanceMetrics(startDate),
      getUserPerformanceMetrics(startDate),
      getSystemPerformanceMetrics()
    ]);
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      performance: {
        events: eventMetrics,
        sessions: sessionMetrics,
        users: userMetrics,
        system: systemMetrics
      }
    });
    
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      code: 'PERFORMANCE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/dashboard/alerts - Get system alerts
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await generateAlerts();
    
    res.json({
      success: true,
      alerts
    });
    
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      code: 'ALERTS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/dashboard/export - Export data
router.get('/export', async (req, res) => {
  try {
    const { type, timeRange = 24, format = 'json' } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    let data;
    
    switch (type) {
      case 'events':
        data = await Event.find({ timestamp: { $gte: startDate } })
          .sort({ timestamp: -1 })
          .lean();
        break;
      case 'sessions':
        data = await Session.find({ startTime: { $gte: startDate } })
          .sort({ startTime: -1 })
          .lean();
        break;
      case 'users':
        data = await User.find({ firstSeen: { $gte: startDate } })
          .sort({ firstSeen: -1 })
          .lean();
        break;
      default:
        return res.status(400).json({
          error: 'Invalid export type. Must be events, sessions, or users',
          code: 'INVALID_EXPORT_TYPE'
        });
    }
    
    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_export.json`);
      res.json(data);
    }
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      error: 'Failed to export data',
      code: 'EXPORT_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Helper functions
async function getOverviewData(startDate) {
  const [
    totalEvents,
    totalSessions,
    totalUsers,
    avgSessionDuration,
    bounceRate,
    topEvents
  ] = await Promise.all([
    Event.countDocuments({ timestamp: { $gte: startDate } }),
    Session.countDocuments({ startTime: { $gte: startDate } }),
    User.countDocuments({ firstSeen: { $gte: startDate } }),
    Session.aggregate([
      { $match: { startTime: { $gte: startDate } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]),
    Session.aggregate([
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
    Event.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);
  
  return {
    totalEvents,
    totalSessions,
    totalUsers,
    avgSessionDuration: avgSessionDuration[0]?.avgDuration || 0,
    bounceRate: bounceRate[0]?.bounceRate || 0,
    topEvents
  };
}

async function getRealtimeEvents() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  return Event.find({ timestamp: { $gte: fiveMinutesAgo } })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();
}

async function getTopPages(startDate) {
  return Event.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    { $group: { _id: '$url', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
}

async function getRecentSessions(startDate) {
  return Session.find({ startTime: { $gte: startDate } })
    .sort({ startTime: -1 })
    .limit(10)
    .populate('userId', 'userId traits')
    .lean();
}

async function getSystemHealth() {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      external: memUsage.external
    },
    uptime,
    nodeVersion: process.version,
    platform: process.platform
  };
}

async function getRealtimeMetrics(startDate) {
  const [
    eventsPerMinute,
    activeUsers,
    errorRate,
    avgResponseTime
  ] = await Promise.all([
    Event.countDocuments({ timestamp: { $gte: startDate } }),
    Session.countDocuments({ 
      isActive: true,
      lastActivity: { $gte: startDate }
    }),
    Event.countDocuments({ 
      timestamp: { $gte: startDate },
      eventType: 'error'
    }),
    // This would typically come from your monitoring system
    Promise.resolve(150) // Mock response time in ms
  ]);
  
  return {
    eventsPerMinute,
    activeUsers,
    errorRate: eventsPerMinute > 0 ? (errorRate / eventsPerMinute) * 100 : 0,
    avgResponseTime
  };
}

async function getEventPerformanceMetrics(startDate) {
  const [
    eventTypeBreakdown,
    eventTimeline,
    topEventProperties
  ] = await Promise.all([
    Event.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Event.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]),
    Event.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $project: { properties: 1 } }
    ]).then(events => {
      const propertyCounts = {};
      events.forEach(event => {
        if (event.properties) {
          Object.keys(event.properties).forEach(key => {
            propertyCounts[key] = (propertyCounts[key] || 0) + 1;
          });
        }
      });
      return propertyCounts;
    })
  ]);
  
  return {
    eventTypeBreakdown,
    eventTimeline,
    topEventProperties
  };
}

async function getSessionPerformanceMetrics(startDate) {
  const [
    sessionDuration,
    sessionTimeline,
    deviceBreakdown
  ] = await Promise.all([
    Session.aggregate([
      { $match: { startTime: { $gte: startDate } } },
      { $group: { 
        _id: null,
        avgDuration: { $avg: '$duration' },
        minDuration: { $min: '$duration' },
        maxDuration: { $max: '$duration' }
      }}
    ]),
    Session.aggregate([
      { $match: { startTime: { $gte: startDate } } },
      { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$startTime' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]),
    Session.aggregate([
      { $match: { startTime: { $gte: startDate } } },
      { $group: { _id: '$screenResolution', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);
  
  return {
    sessionDuration: sessionDuration[0] || {},
    sessionTimeline,
    deviceBreakdown
  };
}

async function getUserPerformanceMetrics(startDate) {
  const [
    userGrowth,
    userEngagement,
    topCountries
  ] = await Promise.all([
    User.aggregate([
      { $match: { firstSeen: { $gte: startDate } } },
      { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$firstSeen' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]),
    User.aggregate([
      { $match: { lastSeen: { $gte: startDate } } },
      { $group: { 
        _id: null,
        avgEngagement: { $avg: '$behavior.engagementScore' },
        totalUsers: { $sum: 1 }
      }}
    ]),
    User.aggregate([
      { $unwind: '$locations' },
      { $group: { _id: '$locations.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  return {
    userGrowth,
    userEngagement: userEngagement[0] || {},
    topCountries
  };
}

async function getSystemPerformanceMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    uptime: process.uptime()
  };
}

async function generateAlerts() {
  const alerts = [];
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Check for high error rate
  const recentErrors = await Event.countDocuments({
    timestamp: { $gte: fiveMinutesAgo },
    eventType: 'error'
  });
  
  const recentEvents = await Event.countDocuments({
    timestamp: { $gte: fiveMinutesAgo }
  });
  
  if (recentEvents > 0 && (recentErrors / recentEvents) > 0.1) {
    alerts.push({
      type: 'error',
      severity: 'high',
      message: 'High error rate detected',
      value: `${Math.round((recentErrors / recentEvents) * 100)}%`,
      timestamp: now
    });
  }
  
  // Check for low activity
  if (recentEvents < 10) {
    alerts.push({
      type: 'activity',
      severity: 'medium',
      message: 'Low activity detected',
      value: `${recentEvents} events in last 5 minutes`,
      timestamp: now
    });
  }
  
  // Check for memory usage
  const memUsage = process.memoryUsage();
  const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (memoryUsagePercent > 80) {
    alerts.push({
      type: 'system',
      severity: 'high',
      message: 'High memory usage',
      value: `${Math.round(memoryUsagePercent)}%`,
      timestamp: now
    });
  }
  
  // Check for database connection issues
  try {
    await Event.findOne().limit(1);
  } catch (error) {
    alerts.push({
      type: 'database',
      severity: 'critical',
      message: 'Database connection issue',
      value: error.message,
      timestamp: now
    });
  }
  
  return alerts;
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(item => {
    return headers.map(header => {
      const value = item[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;