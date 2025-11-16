const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Session = require('../models/Session');
const User = require('../models/User');
const geoip = require('geoip-lite');
const rateLimit = require('express-rate-limit');

// Rate limiting for event endpoints
const eventLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many events sent, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all event routes
router.use(eventLimiter);

// Middleware to validate API key
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.body.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key is required',
      code: 'MISSING_API_KEY'
    });
  }
  
  // In a real implementation, you would validate against a database
  // For now, we'll accept any non-empty key
  if (apiKey.length < 10) {
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  req.apiKey = apiKey;
  next();
};

// Middleware to extract client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip;
};

// Middleware to add geolocation data
const addGeoData = (req, res, next) => {
  const ip = getClientIp(req);
  const geo = geoip.lookup(ip);
  
  req.geo = geo ? {
    country: geo.country,
    region: geo.region,
    city: geo.city,
    ip: ip,
    latitude: geo.ll[0],
    longitude: geo.ll[1]
  } : {
    ip: ip
  };
  
  next();
};

// POST /api/events - Single event ingestion
router.post('/', validateApiKey, addGeoData, async (req, res) => {
  try {
    const event = req.body;
    
    // Validate required fields
    if (!event.eventType || !event.eventName || !event.timestamp || !event.sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: eventType, eventName, timestamp, sessionId',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Add server-side data
    event.receivedAt = new Date();
    event.geo = req.geo;
    
    // Create and save event
    const newEvent = new Event(event);
    await newEvent.save();
    
    // Update session if needed
    await updateSession(event, req.geo);
    
    // Update user if userId is present
    if (event.userId) {
      await updateUser(event, req.geo);
    }
    
    res.status(201).json({
      success: true,
      eventId: newEvent._id,
      message: 'Event recorded successfully'
    });
    
  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).json({
      error: 'Failed to save event',
      code: 'SAVE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// POST /api/events/batch - Batch event ingestion
router.post('/batch', validateApiKey, addGeoData, async (req, res) => {
  try {
    const { batch } = req.body;
    
    if (!batch || !batch.events || !Array.isArray(batch.events)) {
      return res.status(400).json({
        error: 'Invalid batch format. Expected { batch: { events: [...] } }',
        code: 'INVALID_BATCH_FORMAT'
      });
    }
    
    if (batch.events.length === 0) {
      return res.status(400).json({
        error: 'Batch cannot be empty',
        code: 'EMPTY_BATCH'
      });
    }
    
    if (batch.events.length > 100) {
      return res.status(400).json({
        error: 'Batch size cannot exceed 100 events',
        code: 'BATCH_TOO_LARGE'
      });
    }
    
    // Process events
    const processedEvents = [];
    const errors = [];
    
    for (let i = 0; i < batch.events.length; i++) {
      const eventData = batch.events[i];
      
      try {
        // Validate required fields
        if (!eventData.eventType || !eventData.eventName || !eventData.timestamp || !eventData.sessionId) {
          errors.push({
            index: i,
            error: 'Missing required fields',
            event: eventData
          });
          continue;
        }
        
        // Add server-side data
        eventData.receivedAt = new Date();
        eventData.batchId = batch.batchId;
        eventData.sentAt = batch.sentAt ? new Date(batch.sentAt) : new Date();
        eventData.geo = req.geo;
        
        const newEvent = new Event(eventData);
        await newEvent.save();
        processedEvents.push(newEvent._id);
        
        // Update session
        await updateSession(eventData, req.geo);
        
        // Update user if userId is present
        if (eventData.userId) {
          await updateUser(eventData, req.geo);
        }
        
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          event: eventData
        });
      }
    }
    
    res.status(201).json({
      success: true,
      processed: processedEvents.length,
      errors: errors.length,
      eventIds: processedEvents,
      ...(errors.length > 0 && { errors })
    });
    
  } catch (error) {
    console.error('Error processing batch:', error);
    res.status(500).json({
      error: 'Failed to process batch',
      code: 'BATCH_PROCESSING_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/events - Retrieve events with filtering
router.get('/', async (req, res) => {
  try {
    const {
      eventType,
      eventName,
      sessionId,
      userId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      sort = 'timestamp',
      order = 'desc'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (eventName) query.eventName = eventName;
    if (sessionId) query.sessionId = sessionId;
    if (userId) query.userId = userId;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;
    
    // Execute query
    const events = await Event.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get total count
    const total = await Event.countDocuments(query);
    
    res.json({
      success: true,
      events,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
    
  } catch (error) {
    console.error('Error retrieving events:', error);
    res.status(500).json({
      error: 'Failed to retrieve events',
      code: 'RETRIEVAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/events/:eventId - Get specific event
router.get('/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      event
    });
    
  } catch (error) {
    console.error('Error retrieving event:', error);
    res.status(500).json({
      error: 'Failed to retrieve event',
      code: 'RETRIEVAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// DELETE /api/events/:eventId - Delete specific event
router.delete('/:eventId', validateApiKey, async (req, res) => {
  try {
    const result = await Event.findByIdAndDelete(req.params.eventId);
    
    if (!result) {
      return res.status(404).json({
        error: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      error: 'Failed to delete event',
      code: 'DELETE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/events/types - Get available event types
router.get('/types', async (req, res) => {
  try {
    const types = await Event.distinct('eventType');
    
    res.json({
      success: true,
      types
    });
    
  } catch (error) {
    console.error('Error retrieving event types:', error);
    res.status(500).json({
      error: 'Failed to retrieve event types',
      code: 'RETRIEVAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// GET /api/events/names - Get available event names
router.get('/names', async (req, res) => {
  try {
    const { eventType } = req.query;
    const query = eventType ? { eventType } : {};
    
    const names = await Event.distinct('eventName', query);
    
    res.json({
      success: true,
      names
    });
    
  } catch (error) {
    console.error('Error retrieving event names:', error);
    res.status(500).json({
      error: 'Failed to retrieve event names',
      code: 'RETRIEVAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Helper function to update session
async function updateSession(event, geo) {
  try {
    const session = await Session.findOne({ sessionId: event.sessionId });
    
    if (session) {
      // Update existing session
      session.lastActivity = new Date(event.timestamp);
      session.eventsCount += 1;
      session.isActive = true;
      
      // Update exit page for navigation events
      if (event.eventType === 'navigation' && event.properties.to) {
        session.exitPage = event.properties.to;
      }
      
      await session.save();
    } else {
      // Create new session
      const sessionData = {
        sessionId: event.sessionId,
        userId: event.userId,
        startTime: new Date(event.timestamp),
        lastActivity: new Date(event.timestamp),
        pageViews: event.eventType === 'navigation' ? 1 : 0,
        eventsCount: 1,
        landingPage: event.url,
        userAgent: event.userAgent,
        referrer: event.referrer,
        screenResolution: event.screenResolution,
        viewportSize: event.viewportSize,
        timezone: event.timezone,
        language: event.language,
        geo: geo
      };
      
      const newSession = new Session(sessionData);
      await newSession.save();
    }
  } catch (error) {
    console.error('Error updating session:', error);
  }
}

// Helper function to update user
async function updateUser(event, geo) {
  try {
    const user = await User.findOne({ userId: event.userId });
    
    if (user) {
      // Update existing user
      user.lastSeen = new Date(event.timestamp);
      user.totalEvents += 1;
      
      if (event.eventType === 'navigation') {
        user.totalPageViews += 1;
      }
      
      await user.updateActivity({
        eventsCount: 1,
        pageViews: event.eventType === 'navigation' ? 1 : 0,
        duration: 0,
        userAgent: event.userAgent,
        screenResolution: event.screenResolution,
        viewportSize: event.viewportSize,
        timezone: event.timezone,
        language: event.language,
        geo: geo
      });
    } else {
      // Create new user
      const userData = {
        userId: event.userId,
        firstSeen: new Date(event.timestamp),
        lastSeen: new Date(event.timestamp),
        sessionCount: 1,
        totalEvents: 1,
        totalPageViews: event.eventType === 'navigation' ? 1 : 0,
        devices: [{
          userAgent: event.userAgent,
          screenResolution: event.screenResolution,
          viewportSize: event.viewportSize,
          timezone: event.timezone,
          language: event.language,
          firstUsed: new Date(event.timestamp),
          lastUsed: new Date(event.timestamp),
          usageCount: 1
        }],
        locations: geo ? [{
          ...geo,
          firstSeen: new Date(event.timestamp),
          lastSeen: new Date(event.timestamp),
          visitCount: 1
        }] : []
      };
      
      const newUser = new User(userData);
      await newUser.save();
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

module.exports = router;