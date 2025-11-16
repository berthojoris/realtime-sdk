import React, { useEffect, useState } from 'react';
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

// Initialize analytics with smart tracking enabled
const analytics = new RealtimeAnalytics({
  apiKey: process.env.REACT_APP_ANALYTICS_KEY || 'demo-api-key',
  apiEndpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT || 'http://localhost:3001/api/events',
  enableAutoTracking: true,
  enableSmartTracking: true, // Enable smart tracking
  smartTracking: {
    enabled: true,
    attributePrefix: 'data-analytics',
    trackByClass: true,
    trackById: true,
    debugMode: process.env.NODE_ENV === 'development'
  },
  debugMode: process.env.NODE_ENV === 'development'
});

function SmartTrackingExample() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [trackedElements, setTrackedElements] = useState(0);

  useEffect(() => {
    // Initialize analytics when component mounts
    analytics.initialize().then(() => {
      setIsInitialized(true);
      console.log('Analytics with Smart Tracking initialized');
      
      // Get initial tracked elements count
      const smartTracker = analytics.getSmartTracker();
      if (smartTracker) {
        setTrackedElements(smartTracker.getTrackedElements().length);
      }
    }).catch(error => {
      console.error('Analytics initialization failed:', error);
    });

    // Cleanup on unmount
    return () => {
      analytics.destroy();
    };
  }, []);

  const handleRescanElements = () => {
    analytics.rescanSmartElements();
    const smartTracker = analytics.getSmartTracker();
    if (smartTracker) {
      setTrackedElements(smartTracker.getTrackedElements().length);
    }
  };

  const handleGetStats = () => {
    const stats = analytics.getStats();
    console.log('Analytics Stats:', stats);
    alert(JSON.stringify(stats, null, 2));
  };

  return (
    <div className="smart-tracking-example" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1>🎯 Smart Tracking Example</h1>
        <p>
          Status: {isInitialized ? '✅ Initialized with Smart Tracking' : '⏳ Initializing...'}
        </p>
        <p>
          Tracked Elements: <strong>{trackedElements}</strong>
        </p>
      </header>

      <main>
        <section style={{ marginBottom: '30px' }}>
          <h2>🚀 Smart Tracking Features</h2>
          <p>
            These elements are tracked automatically using data attributes - no JavaScript event handlers needed!
          </p>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={handleRescanElements}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Rescan Elements
            </button>
            
            <button 
              onClick={handleGetStats}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#343a40', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Get Stats
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>📋 Data Attribute Examples</h2>
          
          {/* Basic tracking */}
          <button 
            data-analytics="basic_button_clicked"
            style={{ 
              marginRight: '10px', 
              padding: '10px 15px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Basic Button
          </button>

          {/* With custom properties */}
          <button 
            data-analytics-event="signup_attempt"
            data-analytics-prop-button-type="primary"
            data-analytics-prop-location="header"
            data-analytics-prop-user-type="new"
            style={{ 
              marginRight: '10px', 
              padding: '10px 15px', 
              backgroundColor: '#17a2b8', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Sign Up with Props
          </button>

          {/* With JSON properties */}
          <button 
            data-analytics="complex_action"
            data-analytics-props='{"category": "engagement", "priority": "high", "feature": "cta"}'
            style={{ 
              padding: '10px 15px', 
              backgroundColor: '#6f42c1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Complex Action
          </button>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>🎨 CSS Class Examples</h2>
          <p>Elements with "analytics-" prefix classes are automatically tracked:</p>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              className="analytics-purchase"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#fd7e14', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Purchase (Class)
            </button>
            
            <button 
              className="analytics-download analytics-secondary"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Download (Class)
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>🆔 ID-based Examples</h2>
          <p>Elements with "analytics-" prefix IDs are automatically tracked:</p>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              id="analytics-contact-form"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#20c997', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Contact (ID)
            </button>
            
            <button 
              id="analytics-newsletter-subscribe"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Subscribe (ID)
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>📝 Form Examples</h2>
          
          <form 
            data-analytics-event="contact_form_submit"
            data-analytics-type="submit"
            data-analytics-prop-form-type="contact"
            data-analytics-prop-form-version="v2"
            style={{ 
              border: '1px solid #ccc', 
              padding: '20px', 
              borderRadius: '4px',
              marginBottom: '20px'
            }}
          >
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
              <input 
                type="text"
                data-analytics="name_input"
                data-analytics-type="focus"
                data-analytics-prop-field="name"
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input 
                type="email"
                data-analytics="email_input"
                data-analytics-type="change"
                data-analytics-debounce="true"
                data-analytics-prop-field="email"
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Message:</label>
              <textarea 
                data-analytics="message_input"
                data-analytics-type="change"
                data-analytics-debounce="true"
                data-analytics-prop-field="message"
                rows={4}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <button 
              type="submit"
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Submit Form
            </button>
          </form>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>⚡ Advanced Features</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Debounced button */}
            <button 
              data-analytics="debounced_action"
              data-analytics-debounce="true"
              data-analytics-debounce-delay="1000"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#ffc107', 
                color: 'black', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Debounced Action (1s delay)
            </button>
            
            {/* Once-only button */}
            <button 
              data-analytics="once_only_action"
              data-analytics-once="true"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#e83e8c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Track Once Only
            </button>
            
            {/* Conditional tracking */}
            <button 
              data-analytics="conditional_action"
              data-analytics-condition="confirm('Are you sure you want to track this?')"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6610f2', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Conditional Action (Will ask first)
            </button>
            
            {/* Multiple event types */}
            <button 
              data-analytics="multi_event"
              data-analytics-type="click,mouseenter"
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6f42c1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Multiple Events (Click + Hover)
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>🛒 E-commerce Example</h2>
          
          <div style={{ 
            border: '1px solid #ccc', 
            padding: '20px', 
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <h3 data-analytics-prop-product-name="Premium Widget">Premium Widget</h3>
            <p data-analytics-prop-product-category="electronics">High-quality electronic widget</p>
            <p data-analytics-prop-product-price="99.99">$99.99</p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button 
                data-analytics="add_to_cart"
                data-analytics-prop-product-id="123"
                data-analytics-prop-product-price="99.99"
                data-analytics-prop-product-category="widgets"
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add to Cart
              </button>
              
              <button 
                className="analytics-add_to_wishlist"
                data-analytics-prop-product-id="123"
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#dc3545', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ♥ Wishlist
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2>🔍 Dynamic Content Example</h2>
          <p>Click the button to add dynamically tracked elements:</p>
          
          <button 
            onClick={() => {
              const newButton = document.createElement('button');
              newButton.setAttribute('data-analytics', 'dynamic_button');
              newButton.setAttribute('data-analytics-prop-source', 'dynamic');
              newButton.textContent = 'Dynamic Button';
              newButton.style.cssText = 'padding: 10px 15px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px;';
              document.getElementById('dynamic-container')?.appendChild(newButton);
              
              // Update tracked elements count
              setTimeout(() => {
                const smartTracker = analytics.getSmartTracker();
                if (smartTracker) {
                  setTrackedElements(smartTracker.getTrackedElements().length);
                }
              }, 100);
            }}
            style={{ 
              padding: '10px 15px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Add Dynamic Button
          </button>
          
          <div id="dynamic-container" style={{ marginTop: '10px' }}></div>
        </section>
      </main>
    </div>
  );
}

export default SmartTrackingExample;