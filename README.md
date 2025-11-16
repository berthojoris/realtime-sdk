# Realtime Analytics SDK

A comprehensive JavaScript SDK for real-time user analytics and event tracking with Node.js backend support.

## 🚀 Features

- **Real-time Event Tracking**: Track clicks, navigation, scroll, inputs, errors, and custom events
- **Automatic Session Management**: Handles user sessions with intelligent timeout and persistence
- **Privacy-First Design**: Built-in GDPR compliance with consent management and data anonymization
- **Offline Support**: Queue events when offline and automatically sync when connection is restored
- **Web Worker Support**: Process events in background threads for better performance
- **Batch Processing**: Efficient event batching with configurable intervals and retry logic
- **Real-time Dashboard**: Live analytics dashboard with charts and metrics
- **Multi-tenant Architecture**: Support for multiple applications and organizations
- **High Performance**: Optimized for minimal impact on application performance

## 📦 Installation

### Frontend SDK

```bash
npm install @realtime/analytics-sdk
```

Or include via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@realtime/analytics-sdk/dist/index.js"></script>
```

### Backend Server

```bash
git clone https://github.com/your-org/realtime-analytics.git
cd realtime-analytics/server
npm install
```

## 🎯 Quick Start

### Frontend Integration

```javascript
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

// Initialize the SDK
const analytics = new RealtimeAnalytics({
  apiKey: 'your-api-key',
  apiEndpoint: 'http://localhost:3001/api/events',
  enableAutoTracking: true,
  batchSize: 10,
  flushInterval: 5000
});

// Initialize and start tracking
await analytics.initialize();

// Track custom events
analytics.track('button_clicked', {
  button_id: 'signup',
  location: 'homepage'
});

// Identify users
analytics.identify('user-123', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Track page views
analytics.page('/pricing', 'Pricing Page');
```

### Backend Server Setup

```bash
# Start MongoDB
mongod

# Start Redis (optional)
redis-server

# Start the analytics server
npm start
```

The server will be available at `http://localhost:3001` and the dashboard at `http://localhost:3001/dashboard`.

## 📊 Dashboard

Access the real-time analytics dashboard at `http://localhost:3001/dashboard` to view:

- **Overview**: Key metrics and trends
- **Events**: Real-time event stream and breakdown
- **Sessions**: Active user sessions and behavior
- **Users**: User segments and analytics
- **Performance**: System health and response times

## 🔧 Configuration

### SDK Configuration Options

```javascript
const analytics = new RealtimeAnalytics({
  // Required
  apiKey: 'your-api-key',
  apiEndpoint: 'http://localhost:3001/api/events',
  
  // Optional
  userId: 'user-123',              // User ID
  sessionId: 'session-456',        // Custom session ID
  enableAutoTracking: true,        // Enable automatic event tracking
  batchSize: 10,                   // Events per batch
  flushInterval: 5000,             // Flush interval (ms)
  maxRetries: 3,                   // Max retry attempts
  retryDelay: 1000,                // Retry delay (ms)
  enableOfflineMode: true,         // Enable offline queuing
  enableWebWorker: false,          // Use Web Worker for processing
  debugMode: false,                // Enable debug logging
  respectDoNotTrack: true,         // Respect browser DNT
  domainWhitelist: [],             // Allowed domains
  customProperties: {}             // Custom properties for all events
});
```

### Server Configuration

Environment variables:

```bash
PORT=3001
MONGO_URI=mongodb://localhost:27017/realtime_analytics
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

## 📈 Event Types

### Automatic Events

The SDK automatically tracks:

- **Click Events**: User clicks on elements
- **Navigation Events**: Page views and route changes
- **Scroll Events**: Scroll depth and behavior
- **Input Events**: Form interactions
- **Error Events**: JavaScript errors and exceptions

### Custom Events

```javascript
// Track custom events with properties
analytics.track('purchase_completed', {
  order_id: 'ORD-123',
  amount: 99.99,
  currency: 'USD',
  product: 'Premium Plan'
});

// Track user interactions
analytics.track('feature_used', {
  feature: 'export_data',
  method: 'csv'
});
```

## 👤 User Identification

```javascript
// Identify users with traits
analytics.identify('user-123', {
  name: 'John Doe',
  email: 'john@example.com',
  plan: 'premium',
  signup_date: '2023-01-15'
});

// Update user traits
analytics.identify('user-123', {
  last_login: new Date().toISOString()
});
```

## 🔒 Privacy & Compliance

### GDPR Compliance

```javascript
// Opt-out users
analytics.optOut();

// Opt-in users
analytics.optIn();

// Export user data (GDPR Article 20)
const userData = await analytics.exportUserData();

// Delete user data (GDPR Article 17)
await analytics.deleteUserData();
```

### Privacy Settings

```javascript
const analytics = new RealtimeAnalytics({
  // Privacy options
  respectDoNotTrack: true,
  anonymizeIp: true,
  maskSensitiveInputs: true,
  excludeLocalhost: true,
  cookieConsentRequired: true,
  dataRetentionDays: 365
});
```

## 🌐 Advanced Usage

### Custom Plugins

```javascript
// Create a custom plugin
const customPlugin = {
  name: 'custom-plugin',
  initialize: (analytics) => {
    console.log('Plugin initialized');
  },
  track: (event) => {
    // Modify events before sending
    event.properties.custom_field = 'added_by_plugin';
    return event;
  },
  beforeSend: (events) => {
    // Modify batch before sending
    return events;
  }
};

// Add plugin
analytics.addPlugin(customPlugin);
```

### Web Worker Usage

```javascript
const analytics = new RealtimeAnalytics({
  enableWebWorker: true,
  // ... other config
});

// Check if worker is being used
const stats = analytics.getStats();
console.log('Using Web Worker:', stats.worker.isUsingWorker);
```

### Offline Mode

```javascript
const analytics = new RealtimeAnalytics({
  enableOfflineMode: true,
  // Events will be queued when offline
  // and automatically sent when connection is restored
});

// Check offline queue size
const stats = analytics.getStats();
console.log('Offline events:', stats.batching.offlineQueueSize);
```

## 🔧 API Reference

### Main SDK Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize()` | Initialize the SDK | None |
| `track(eventName, properties)` | Track custom event | eventName: string, properties: object |
| `identify(userId, traits)` | Identify user | userId: string, traits: object |
| `page(url, title)` | Track page view | url: string, title: string |
| `reset()` | Reset session | None |
| `optOut()` | Opt-out tracking | None |
| `optIn()` | Opt-in tracking | None |
| `flush()` | Force send events | None |

### Utility Methods

| Method | Description |
|--------|-------------|
| `getSession()` | Get current session data |
| `getUserIdentity()` | Get user identity data |
| `getPrivacyStatus()` | Get privacy settings status |
| `getPerformanceMetrics()` | Get SDK performance metrics |
| `getStats()` | Get comprehensive statistics |

## 🚀 Server API

### Event Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | POST | Submit single event |
| `/api/events/batch` | POST | Submit batch of events |
| `/api/events` | GET | Retrieve events with filters |
| `/api/events/:id` | GET | Get specific event |
| `/api/events/types` | GET | Get event types |
| `/api/events/names` | GET | Get event names |

### Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/overview` | GET | Analytics overview |
| `/api/analytics/timeline` | GET | Timeline data |
| `/api/analytics/funnel` | GET | Funnel analysis |
| `/api/analytics/retention` | GET | Retention analysis |
| `/api/analytics/segments` | GET | User segments |

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard` | GET | Dashboard data |
| `/api/dashboard/realtime` | GET | Real-time data |
| `/api/dashboard/performance` | GET | Performance metrics |
| `/api/dashboard/alerts` | GET | System alerts |
| `/api/dashboard/export` | GET | Export data |

## 🧪 Testing

### Frontend Tests

```bash
npm test
npm run test:watch
```

### Backend Tests

```bash
cd server
npm test
npm run test:watch
```

### Integration Tests

```bash
npm run test:integration
```

## 📝 Examples

### React Integration

```jsx
import { useEffect } from 'react';
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

let analytics = null;

export function useAnalytics() {
  useEffect(() => {
    if (!analytics) {
      analytics = new RealtimeAnalytics({
        apiKey: process.env.REACT_APP_ANALYTICS_KEY,
        apiEndpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
        enableAutoTracking: true
      });
      
      analytics.initialize();
    }
  }, []);

  const track = (eventName, properties) => {
    analytics?.track(eventName, properties);
  };

  const identify = (userId, traits) => {
    analytics?.identify(userId, traits);
  };

  return { track, identify };
}
```

### Vue.js Integration

```javascript
// plugins/analytics.js
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

const analytics = new RealtimeAnalytics({
  apiKey: process.env.VUE_APP_ANALYTICS_KEY,
  apiEndpoint: process.env.VUE_APP_ANALYTICS_ENDPOINT,
  enableAutoTracking: true
});

export default async ({ app }) => {
  await analytics.initialize();
  app.config.globalProperties.$analytics = analytics;
};
```

### Next.js Integration

```javascript
// lib/analytics.js
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

const analytics = new RealtimeAnalytics({
  apiKey: process.env.NEXT_PUBLIC_ANALYTICS_KEY,
  apiEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
  enableAutoTracking: true
});

export { analytics };

// pages/_app.js
import { analytics } from '../lib/analytics';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    analytics.initialize();
  }, []);

  return <Component {...pageProps} />;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://docs.realtime-analytics.com)
- 🐛 [Issue Tracker](https://github.com/your-org/realtime-analytics/issues)
- 💬 [Discord Community](https://discord.gg/realtime-analytics)
- 📧 [Email Support](mailto:support@realtime-analytics.com)

## 🗺️ Roadmap

- [ ] Mobile SDK (React Native, Flutter)
- [ ] Advanced funnel analysis
- [ ] A/B testing integration
- [ ] Heatmap visualization
- [ ] Session replay
- [ ] Custom alerting
- [ ] Advanced user segmentation
- [ ] Export to BI tools
- [ ] Multi-region deployment
- [ ] Edge computing support

---

Made with ❤️ by the Realtime Analytics Team