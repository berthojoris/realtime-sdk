import React, { useEffect, useState } from 'react';
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

// Initialize analytics
const analytics = new RealtimeAnalytics({
  apiKey: process.env.REACT_APP_ANALYTICS_KEY || 'demo-api-key',
  apiEndpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT || 'http://localhost:3001/api/events',
  enableAutoTracking: true,
  batchSize: 10,
  flushInterval: 5000,
  debugMode: process.env.NODE_ENV === 'development'
});

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Initialize analytics when component mounts
    analytics.initialize().then(() => {
      setIsInitialized(true);
      console.log('Analytics initialized');
    }).catch(error => {
      console.error('Analytics initialization failed:', error);
    });

    // Cleanup on unmount
    return () => {
      analytics.destroy();
    };
  }, []);

  const handleIdentify = () => {
    const newUserId = `user-${Date.now()}`;
    setUserId(newUserId);
    
    analytics.identify(newUserId, {
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'premium',
      signupDate: new Date().toISOString()
    });
  };

  const handleTrackEvent = (eventName, properties = {}) => {
    analytics.track(eventName, {
      timestamp: new Date().toISOString(),
      ...properties
    });
  };

  const handlePageView = (path, title) => {
    analytics.page(path, title);
  };

  const handleOptOut = () => {
    analytics.optOut();
    setUserId(null);
  };

  const handleOptIn = () => {
    analytics.optIn();
  };

  const getAnalyticsStats = () => {
    const stats = analytics.getStats();
    console.log('Analytics Stats:', stats);
    alert(JSON.stringify(stats, null, 2));
  };

  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1>Realtime Analytics React Example</h1>
        <p>
          Status: {isInitialized ? '✅ Initialized' : '⏳ Initializing...'}
        </p>
        {userId && (
          <p>
            Current User: <strong>{userId}</strong>
          </p>
        )}
      </header>

      <main>
        <section style={{ marginBottom: '30px' }}>
          <h2>🎯 Smart Tracking Example</h2>
          <p>
            Check out the new Smart Tracking feature that automatically tracks elements with special attributes - no JavaScript required!
          </p>
          <a
            href="/smart-tracking"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              marginBottom: '20px'
            }}
          >
            View Smart Tracking Example →
          </a>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>User Identification</h2>
          <button 
            onClick={handleIdentify}
            style={{ 
              marginRight: '10px', 
              padding: '10px 15px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Identify User
          </button>
          <button 
            onClick={handleOptOut}
            style={{ 
              marginRight: '10px', 
              padding: '10px 15px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Opt Out
          </button>
          <button 
            onClick={handleOptIn}
            style={{ 
              padding: '10px 15px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Opt In
          </button>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>Custom Events</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => handleTrackEvent('button_clicked', { button_id: 'signup', location: 'header' })}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Button Click
            </button>
            
            <button 
              onClick={() => handleTrackEvent('form_submitted', { form_type: 'contact', fields: 3 })}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6f42c1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Form Submit
            </button>
            
            <button 
              onClick={() => handleTrackEvent('purchase_completed', { 
                amount: 99.99, 
                currency: 'USD', 
                product: 'Premium Plan' 
              })}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#fd7e14', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Purchase
            </button>
            
            <button 
              onClick={() => handleTrackEvent('feature_used', { 
                feature: 'export_data', 
                method: 'csv',
                file_size: '2.5MB'
              })}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#20c997', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Feature Usage
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>Page Views</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => handlePageView('/home', 'Home Page')}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Home Page View
            </button>
            
            <button 
              onClick={() => handlePageView('/pricing', 'Pricing Page')}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Pricing Page View
            </button>
            
            <button 
              onClick={() => handlePageView('/dashboard', 'Dashboard')}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                width: '200px'
              }}
            >
              Track Dashboard View
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>Analytics Debug</h2>
          <button 
            onClick={getAnalyticsStats}
            style={{ 
              padding: '10px 15px', 
              backgroundColor: '#343a40', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Get Analytics Stats
          </button>
        </section>

        <section>
          <h2>Test Elements (Auto-Tracked)</h2>
          <p>Click on these elements to test automatic tracking:</p>
          
          <div style={{ marginTop: '20px' }}>
            <button 
              id="test-button-1"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Test Button 1
            </button>
            
            <button 
              id="test-button-2"
              className="test-button"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Test Button 2
            </button>
            
            <a 
              href="#test-link"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                textDecoration: 'none',
                borderRadius: '4px',
                marginRight: '10px'
              }}
            >
              Test Link
            </a>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <label htmlFor="test-input" style={{ display: 'block', marginBottom: '5px' }}>
              Test Input:
            </label>
            <input 
              id="test-input"
              type="text" 
              placeholder="Type something..."
              style={{ 
                padding: '8px', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                marginRight: '10px'
              }}
            />
            
            <input 
              type="email" 
              placeholder="Email (sensitive)"
              style={{ 
                padding: '8px', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                marginRight: '10px'
              }}
            />
            
            <input 
              type="password" 
              placeholder="Password (sensitive)"
              style={{ 
                padding: '8px', 
                border: '1px solid #ccc', 
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ marginTop: '20px', height: '200px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            <p>Scroll in this area to test scroll tracking...</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
            <p>Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;