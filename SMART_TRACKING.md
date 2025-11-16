# Smart Tracking Documentation

## Overview

The Smart Tracking feature allows you to automatically track user interactions by simply adding special attributes or classes to HTML elements. This eliminates the need to write JavaScript code for common tracking scenarios and makes integration much easier.

## 🚀 Quick Start

### 1. Enable Smart Tracking

```javascript
import { RealtimeAnalytics } from '@realtime/analytics-sdk';

const analytics = new RealtimeAnalytics({
  apiKey: 'your-api-key',
  apiEndpoint: 'http://localhost:3001/api/events',
  enableSmartTracking: true, // Enable smart tracking
  smartTracking: {
    enabled: true,
    attributePrefix: 'data-analytics'
  }
});

await analytics.initialize();
```

### 2. Add Tracking Attributes to HTML Elements

```html
<!-- Simple event tracking -->
<button data-analytics="button_clicked">Click Me</button>

<!-- With custom properties -->
<button 
  data-analytics-event="signup_clicked"
  data-analytics-prop-button-type="primary"
  data-analytics-prop-location="header">
  Sign Up
</button>

<!-- Using classes -->
<button class="analytics-purchase">Buy Now</button>

<!-- Using IDs -->
<button id="analytics-download">Download PDF</button>
```

## 📋 Tracking Methods

### 1. Data Attributes (Recommended)

Use `data-analytics` attributes for the most flexible tracking:

```html
<!-- Basic event name -->
<button data-analytics="button_clicked">Click</button>

<!-- Custom event name with type -->
<form data-analytics-event="form_submit" data-analytics-type="submit">
  <input type="email" data-analytics-prop-field="email">
  <button type="submit">Submit</button>
</form>

<!-- With JSON properties -->
<button data-analytics="complex_action" 
        data-analytics-props='{"category": "engagement", "priority": "high"}'>
  Action
</button>

<!-- Individual properties -->
<div data-analytics="content_view" 
     data-analytics-prop-content-type="article"
     data-analytics-prop-content-id="123">
  Article Content
</div>
```

### 2. CSS Classes

Use `analytics-` prefix for class-based tracking:

```html
<!-- Class-based tracking -->
<button class="analytics-signup">Sign Up</button>
<button class="analytics-download">Download</button>
<button class="analytics-share">Share</button>

<!-- Multiple classes -->
<button class="btn analytics-purchase analytics-primary">Buy Now</button>
```

### 3. Element IDs

Use `analytics-` prefix for ID-based tracking:

```html
<!-- ID-based tracking -->
<button id="analytics-contact">Contact Us</button>
<button id="analytics-newsletter">Subscribe</button>
```

## ⚙️ Configuration Options

```javascript
const analytics = new RealtimeAnalytics({
  // ... other config
  enableSmartTracking: true,
  smartTracking: {
    // Enable/disable smart tracking
    enabled: true,
    
    // Attribute prefix for data attributes
    attributePrefix: 'data-analytics',
    
    // Enable tracking by CSS classes
    trackByClass: true,
    
    // Enable tracking by element IDs
    trackById: true,
    
    // Enable tracking by data attributes
    trackByAttribute: true,
    
    // Event type mappings
    eventMappings: {
      'click': 'click',
      'submit': 'form_submit',
      'change': 'input_change',
      'focus': 'input_focus',
      'blur': 'input_blur',
      'hover': 'element_hover'
    },
    
    // Default event name when none specified
    defaultEventName: 'element_interaction',
    
    // Debounce delay for rapid events (ms)
    debounceDelay: 300,
    
    // Respect disabled attribute
    respectDisabled: true
  }
});
```

## 🎯 Advanced Features

### 1. Event Types

Specify different event types:

```html
<!-- Click event (default) -->
<button data-analytics="button_clicked">Click</button>

<!-- Form submit -->
<form data-analytics-event="contact_form" data-analytics-type="submit">
  <button type="submit">Submit</button>
</form>

<!-- Input change -->
<input data-analytics="email_input" data-analytics-type="change" type="email">

<!-- Focus/blur -->
<input data-analytics="name_field" data-analytics-type="focus" type="text">

<!-- Hover -->
<div data-analytics="promo_card" data-analytics-type="hover">Hover me</div>

<!-- Multiple event types -->
<button data-analytics="multi_action" data-analytics-type="click,hover">Multi</button>
```

### 2. Debouncing

Prevent duplicate events from rapid interactions:

```html
<!-- Debounced with default delay -->
<button data-analytics="search" data-analytics-debounce="true">Search</button>

<!-- Custom debounce delay -->
<input data-analytics="typeahead" 
       data-analytics-debounce="true" 
       data-analytics-debounce-delay="500" 
       type="text">
```

### 3. Once-Only Tracking

Track an event only once per session:

```html
<button data-analytics="first_click" data-analytics-once="true">Click Once</button>
```

### 4. Conditional Tracking

Track events only when certain conditions are met:

```html
<!-- Track only if user is logged in -->
<button data-analytics="premium_feature" 
        data-analytics-condition="window.user.isLoggedIn">
  Premium Feature
</button>

<!-- Track only if form is valid -->
<button data-analytics="submit_form" 
        data-analytics-condition="this.form.checkValidity()">
  Submit
</button>
```

### 5. Dynamic Properties

Automatically capture element properties:

```html
<!-- Captures element attributes automatically -->
<a href="/download.pdf" 
   data-analytics="download_link"
   data-analytics-prop-file-type="pdf">
  Download PDF
</a>

<!-- Captures form input values (non-sensitive) -->
<input type="text" 
       name="search_query"
       data-analytics="search_input"
       data-analytics-type="change">
```

## 🔧 API Methods

### Manual Element Tracking

```javascript
// Track an element manually
const button = document.getElementById('my-button');
analytics.trackElement(button, 'custom_event', { custom_prop: 'value' });

// Get smart tracker instance
const smartTracker = analytics.getSmartTracker();
if (smartTracker) {
  // Get tracked elements
  const elements = smartTracker.getTrackedElements();
  
  // Get element event data
  const eventData = smartTracker.getElementEventData(button);
  
  // Rescan for new elements
  smartTracker.rescanElements();
}
```

### Configuration Updates

```javascript
// Update smart tracking config
analytics.updateConfig({
  smartTracking: {
    debounceDelay: 500,
    attributePrefix: 'data-track'
  }
});
```

## 📊 Event Data Structure

Events tracked via smart tracking include:

```javascript
{
  eventType: 'custom',
  eventName: 'button_clicked',
  properties: {
    // Your custom properties
    button_type: 'primary',
    location: 'header',
    
    // Auto-captured properties
    element: 'button',
    elementId: 'signup-btn',
    elementClass: 'btn btn-primary',
    elementText: 'Sign Up',
    eventType: 'click',
    clientX: 150,
    clientY: 45,
    pageX: 150,
    pageY: 245
  },
  timestamp: 1634567890123,
  userId: 'user-123',
  sessionId: 'session-456',
  url: 'https://example.com/page',
  userAgent: 'Mozilla/5.0...',
  // ... other standard properties
}
```

## 🎨 Best Practices

### 1. Naming Conventions

```html
<!-- Use descriptive event names -->
<button data-analytics="signup_button_clicked">Sign Up</button>
<button data-analytics="download_pdf_started">Download PDF</button>

<!-- Use consistent property names -->
<div data-analytics="product_card" 
     data-analytics-prop-product-id="123"
     data-analytics-prop-product-category="electronics"
     data-analytics-prop-product-price="99.99">
  Product Info
</div>
```

### 2. Property Organization

```html
<!-- Group related properties -->
<form data-analytics-event="contact_form_submit"
      data-analytics-prop-form-type="contact"
      data-analytics-prop-form-version="v2"
      data-analytics-prop-source="footer">
  <!-- Form fields -->
</form>
```

### 3. Performance Considerations

```html
<!-- Use debouncing for high-frequency events -->
<input data-analytics="search_input" 
       data-analytics-debounce="true" 
       type="search">

<!-- Use once for one-time events -->
<button data-analytics="tutorial_completed" 
        data-analytics-once="true">
  Got it!
</button>
```

### 4. Sensitive Data

The SDK automatically masks sensitive input types:

```html
<!-- These will be automatically masked -->
<input type="password" data-analytics="password_input">
<input type="email" data-analytics="email_input">
<input type="tel" data-analytics="phone_input">

<!-- Explicitly mark as sensitive -->
<input data-analytics="secret_field" 
       data-analytics-prop-sensitive="true">
```

## 🔄 Dynamic Content

Smart tracking automatically detects and tracks dynamically added elements:

```javascript
// Elements added via JavaScript will be automatically tracked
const newButton = document.createElement('button');
newButton.setAttribute('data-analytics', 'dynamic_button');
newButton.textContent = 'Click Me';
document.body.appendChild(newButton);

// Or manually trigger rescan
analytics.rescanSmartElements();
```

## 🐛 Debugging

Enable debug mode to see smart tracking activity:

```javascript
const analytics = new RealtimeAnalytics({
  // ... other config
  debugMode: true,
  enableSmartTracking: true
});

// Check tracked elements
console.log(analytics.getStats().smartTracking);
```

## 📝 Examples

### E-commerce Product Page

```html
<div class="product">
  <h1 data-analytics-prop-product-name="Premium Widget">Premium Widget</h1>
  
  <button data-analytics="add_to_cart"
          data-analytics-prop-product-id="123"
          data-analytics-prop-product-price="99.99"
          data-analytics-prop-product-category="widgets">
    Add to Cart
  </button>
  
  <button data-analytics="add_to_wishlist"
          data-analytics-prop-product-id="123"
          class="analytics-wishlist">
    ♥ Wishlist
  </button>
  
  <a href="/products/123/reviews" 
     data-analytics="view_reviews"
     data-analytics-prop-product-id="123">
    View Reviews
  </a>
</div>
```

### Contact Form

```html
<form data-analytics-event="contact_form_submit"
      data-analytics-type="submit"
      data-analytics-prop-form-type="contact">
  
  <input type="text" 
         name="name"
         data-analytics="name_input"
         data-analytics-type="focus"
         data-analytics-prop-field="name">
  
  <input type="email" 
         name="email"
         data-analytics="email_input"
         data-analytics-type="change"
         data-analytics-debounce="true">
  
  <textarea name="message"
            data-analytics="message_input"
            data-analytics-type="change"
            data-analytics-debounce="true"></textarea>
  
  <button type="submit">Send Message</button>
</form>
```

### Navigation Menu

```html
<nav>
  <a href="/home" class="analytics-nav_home">Home</a>
  <a href="/products" class="analytics-nav_products">Products</a>
  <a href="/about" class="analytics-nav_about">About</a>
  <a href="/contact" id="analytics-nav_contact">Contact</a>
</nav>
```

## 🔍 Migration from Manual Tracking

### Before (Manual Tracking)

```javascript
// Old way - manual tracking
document.getElementById('signup-btn').addEventListener('click', () => {
  analytics.track('signup_clicked', {
    button_type: 'primary',
    location: 'header'
  });
});
```

### After (Smart Tracking)

```html
<!-- New way - smart tracking -->
<button id="signup-btn"
        data-analytics="signup_clicked"
        data-analytics-prop-button-type="primary"
        data-analytics-prop-location="header">
  Sign Up
</button>
```

## 🚨 Limitations

1. **Browser Support**: Requires modern browsers with MutationObserver support
2. **Performance**: Very large pages with many tracked elements may impact performance
3. **Complex Conditions**: Conditional tracking uses eval() - use with caution
4. **Dynamic Frameworks**: Some frameworks may require manual rescan triggers

## 🆘 Troubleshooting

### Events Not Tracking

1. Ensure `enableSmartTracking: true` is set
2. Check that elements have correct attributes/classes
3. Verify SDK is initialized: `await analytics.initialize()`
4. Check debug console for errors

### Too Many Events

1. Add debouncing: `data-analytics-debounce="true"`
2. Use once-only: `data-analytics-once="true"`
3. Add conditions: `data-analytics-condition="..."`

### Dynamic Elements Not Tracking

1. Call `analytics.rescanSmartElements()` after adding elements
2. Wait for DOM to be ready before initializing SDK

---

For more information, see the [main documentation](README.md) or [API reference](docs/api.md).