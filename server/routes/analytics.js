const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Session = require('../models/Session');
const User = require('../models/User');

// GET /api/analytics/overview - Get analytics overview
router.get('/overview', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      totalEvents,
      uniqueSessions,
      uniqueUsers,
      avgSessionDuration,
      topPages,
      eventTypes,
      deviceBreakdown,
      geographicData
    ] = await Promise.all([
      Event.countDocuments({ timestamp: { $gte: startDate } }),
      Session.countDocuments({ startTime: { $gte: startDate } }),
      User.countDocuments({ firstSeen: { $gte: startDate } }),
      Session.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      Event.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$url', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Event.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Session.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { _id: '$screenResolution', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Event.aggregate([
        { $match: { timestamp: { $gte: startDate }, 'geo.country': { $exists: true } } },
        { $group: { _id: '$geo.country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      overview: {
        totalEvents,
        uniqueSessions,
        uniqueUsers,
        avgSessionDuration: avgSessionDuration[0]?.avgDuration || 0
      },
      topPages,
      eventTypes,
      deviceBreakdown,
      geographicData
    });
    
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics overview',
      code: 'ANALYTICS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/timeline - Get timeline data
router.get('/timeline', async (req, res) => {
  try {
    const { timeRange = 24, interval = 'hour' } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    // Determine grouping interval
    let groupFormat;
    switch (interval) {
      case 'minute':
        groupFormat = { $dateToString: { format: '%Y-%m-%d %H:%M', date: '$timestamp' } };
        break;
      case 'hour':
        groupFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } };
        break;
      case 'day':
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
        break;
      default:
        groupFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } };
    }
    
    const [eventsTimeline, sessionsTimeline, usersTimeline] = await Promise.all([
      Event.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: groupFormat, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Session.aggregate([
        { $match: { startTime: { $gte: startDate } } },
        { $group: { _id: groupFormat, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { firstSeen: { $gte: startDate } } },
        { $group: { _id: groupFormat, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      interval,
      timeline: {
        events: eventsTimeline,
        sessions: sessionsTimeline,
        users: usersTimeline
      }
    });
    
  } catch (error) {
    console.error('Error getting timeline data:', error);
    res.status(500).json({
      error: 'Failed to retrieve timeline data',
      code: 'TIMELINE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/funnel - Get funnel analysis
router.get('/funnel', async (req, res) => {
  try {
    const { steps, timeRange = 24 } = req.query;
    
    if (!steps) {
      return res.status(400).json({
        error: 'Steps parameter is required',
        code: 'MISSING_STEPS'
      });
    }
    
    const stepArray = Array.isArray(steps) ? steps : steps.split(',');
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const funnelData = await Promise.all(
      stepArray.map(async (step, index) => {
        const stepEvents = await Event.aggregate([
          { $match: { 
            timestamp: { $gte: startDate },
            eventName: step.trim()
          }},
          { $group: { 
            _id: '$sessionId',
            firstEvent: { $min: '$timestamp' }
          }},
          { $sort: { firstEvent: 1 } }
        ]);
        
        return {
          step: step.trim(),
          index,
          uniqueSessions: stepEvents.length,
          conversionRate: index === 0 ? 100 : null
        };
      })
    );
    
    // Calculate conversion rates
    const firstStepCount = funnelData[0]?.uniqueSessions || 1;
    funnelData.forEach(step => {
      step.conversionRate = Math.round((step.uniqueSessions / firstStepCount) * 100);
    });
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      funnel: funnelData
    });
    
  } catch (error) {
    console.error('Error getting funnel analysis:', error);
    res.status(500).json({
      error: 'Failed to retrieve funnel analysis',
      code: 'FUNNEL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/retention - Get retention analysis
router.get('/retention', async (req, res) => {
  try {
    const { timeRange = 24, cohortPeriod = 'day' } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    // Get cohorts based on period
    let groupFormat;
    switch (cohortPeriod) {
      case 'day':
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$firstSeen' } };
        break;
      case 'week':
        groupFormat = { $dateToString: { format: '%Y-%U', date: '$firstSeen' } };
        break;
      case 'month':
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$firstSeen' } };
        break;
      default:
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$firstSeen' } };
    }
    
    const cohorts = await User.aggregate([
      { $match: { firstSeen: { $gte: startDate } } },
      { $group: {
        _id: groupFormat,
        users: { $push: '$userId' },
        cohortSize: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Calculate retention for each cohort
    const retentionData = await Promise.all(
      cohorts.map(async (cohort) => {
        const retentionPeriods = [1, 7, 30]; // days
        const retention = [];
        
        for (const period of retentionPeriods) {
          const periodStart = new Date(cohort._id + 'T00:00:00.000Z');
          const periodEnd = new Date(periodStart.getTime() + period * 24 * 60 * 60 * 1000);
          
          const retainedUsers = await User.countDocuments({
            userId: { $in: cohort.users },
            lastSeen: { $gte: periodStart, $lt: periodEnd }
          });
          
          retention.push({
            period: `${period}d`,
            count: retainedUsers,
            percentage: Math.round((retainedUsers / cohort.cohortSize) * 100)
          });
        }
        
        return {
          cohort: cohort._id,
          cohortSize: cohort.cohortSize,
          retention
        };
      })
    );
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      cohortPeriod,
      retention: retentionData
    });
    
  } catch (error) {
    console.error('Error getting retention analysis:', error);
    res.status(500).json({
      error: 'Failed to retrieve retention analysis',
      code: 'RETENTION_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/segments - Get user segments
router.get('/segments', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      newUsers,
      returningUsers,
      highEngagementUsers,
      lowEngagementUsers,
      mobileUsers,
      desktopUsers
    ] = await Promise.all([
      User.countDocuments({ firstSeen: { $gte: startDate } }),
      User.countDocuments({ 
        firstSeen: { $lt: startDate },
        lastSeen: { $gte: startDate }
      }),
      User.countDocuments({ 
        'behavior.engagementScore': { $gte: 70 },
        lastSeen: { $gte: startDate }
      }),
      User.countDocuments({ 
        'behavior.engagementScore': { $lt: 30 },
        lastSeen: { $gte: startDate }
      }),
      User.countDocuments({ 
        'devices.userAgent': { $regex: /mobile|android|iphone/i },
        lastSeen: { $gte: startDate }
      }),
      User.countDocuments({ 
        'devices.userAgent': { $not: /mobile|android|iphone/i },
        lastSeen: { $gte: startDate }
      })
    ]);
    
    const segments = [
      { name: 'New Users', count: newUsers, percentage: 0 },
      { name: 'Returning Users', count: returningUsers, percentage: 0 },
      { name: 'High Engagement', count: highEngagementUsers, percentage: 0 },
      { name: 'Low Engagement', count: lowEngagementUsers, percentage: 0 },
      { name: 'Mobile Users', count: mobileUsers, percentage: 0 },
      { name: 'Desktop Users', count: desktopUsers, percentage: 0 }
    ];
    
    const total = segments.reduce((sum, segment) => sum + segment.count, 0);
    segments.forEach(segment => {
      segment.percentage = total > 0 ? Math.round((segment.count / total) * 100) : 0;
    });
    
    res.json({
      success: true,
      timeRange: parseInt(timeRange),
      segments
    });
    
  } catch (error) {
    console.error('Error getting user segments:', error);
    res.status(500).json({
      error: 'Failed to retrieve user segments',
      code: 'SEGMENTS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/events/:eventName - Get specific event analytics
router.get('/events/:eventName', async (req, res) => {
  try {
    const { eventName } = req.params;
    const { timeRange = 24 } = req.query;
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const [
      totalEvents,
      uniqueSessions,
      timeline,
      properties,
      topPages
    ] = await Promise.all([
      Event.countDocuments({ 
        eventName,
        timestamp: { $gte: startDate }
      }),
      Event.distinct('sessionId', { 
        eventName,
        timestamp: { $gte: startDate }
      }).then(sessions => sessions.length),
      Event.aggregate([
        { $match: { 
          eventName,
          timestamp: { $gte: startDate }
        }},
        { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      Event.aggregate([
        { $match: { 
          eventName,
          timestamp: { $gte: startDate }
        }},
        { $project: { properties: 1 } }
      ]),
      Event.aggregate([
        { $match: { 
          eventName,
          timestamp: { $gte: startDate }
        }},
        { $group: { _id: '$url', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    // Analyze common properties
    const propertyAnalysis = {};
    properties.forEach(event => {
      if (event.properties) {
        Object.keys(event.properties).forEach(key => {
          if (!propertyAnalysis[key]) {
            propertyAnalysis[key] = {};
          }
          const value = event.properties[key];
          const valueKey = typeof value === 'object' ? JSON.stringify(value) : String(value);
          propertyAnalysis[key][valueKey] = (propertyAnalysis[key][valueKey] || 0) + 1;
        });
      }
    });
    
    res.json({
      success: true,
      eventName,
      timeRange: parseInt(timeRange),
      analytics: {
        totalEvents,
        uniqueSessions,
        timeline,
        topPages,
        properties: propertyAnalysis
      }
    });
    
  } catch (error) {
    console.error('Error getting event analytics:', error);
    res.status(500).json({
      error: 'Failed to retrieve event analytics',
      code: 'EVENT_ANALYTICS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/analytics/sessions/:sessionId - Get session analytics
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [session, events, user] = await Promise.all([
      Session.findOne({ sessionId }).lean(),
      Event.find({ sessionId }).sort({ timestamp: 1 }).lean(),
      Session.findOne({ sessionId }).populate('userId').lean()
    ]);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // Calculate session metrics
    const sessionMetrics = {
      duration: session.duration,
      pageViews: session.pageViews,
      eventsCount: events.length,
      uniqueEvents: [...new Set(events.map(e => e.eventName))].length,
      avgTimeBetweenEvents: events.length > 1 ? 
        (events[events.length - 1].timestamp - events[0].timestamp) / (events.length - 1) : 0
    };
    
    // Event breakdown
    const eventBreakdown = events.reduce((acc, event) => {
      if (!acc[event.eventType]) {
        acc[event.eventType] = [];
      }
      acc[event.eventType].push(event);
      return acc;
    }, {});
    
    res.json({
      success: true,
      session,
      user: user?.userId,
      metrics: sessionMetrics,
      events,
      eventBreakdown
    });
    
  } catch (error) {
    console.error('Error getting session analytics:', error);
    res.status(500).json({
      error: 'Failed to retrieve session analytics',
      code: 'SESSION_ANALYTICS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

module.exports = router;