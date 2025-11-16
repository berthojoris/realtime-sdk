import type { AnalyticsEvent, CustomEvent } from '../types';
import { Utils } from '../utils';
import { SessionManager } from '../session';

export interface SmartTrackingConfig {
  enabled: boolean;
  attributePrefix: string;
  trackByClass: boolean;
  trackById: boolean;
  trackByAttribute: boolean;
  eventMappings: Record<string, string>;
  defaultEventName: string;
  debounceDelay: number;
  respectDisabled: boolean;
}

export interface ElementEventData {
  eventName: string;
  properties: Record<string, any>;
  eventType: string;
  debounce?: boolean;
  debounceDelay?: number;
  once?: boolean;
  condition?: string;
}

export class SmartTracker {
  private sessionManager: SessionManager;
  private config: SmartTrackingConfig;
  private isTracking: boolean = false;
  private trackedElements: Map<Element, ElementEventData> = new Map();
  private eventListeners: Map<string, EventListener[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private onceElements: Set<Element> = new Set();

  constructor(sessionManager: SessionManager, config: Partial<SmartTrackingConfig> = {}) {
    this.sessionManager = sessionManager;
    this.config = {
      enabled: true,
      attributePrefix: 'data-analytics',
      trackByClass: true,
      trackById: true,
      trackByAttribute: true,
      eventMappings: {
        'click': 'click',
        'submit': 'form_submit',
        'change': 'input_change',
        'focus': 'input_focus',
        'blur': 'input_blur',
        'hover': 'element_hover'
      },
      defaultEventName: 'element_interaction',
      debounceDelay: 300,
      respectDisabled: true,
      ...config
    };
  }

  startTracking(): void {
    if (!this.config.enabled || this.isTracking) return;
    
    this.isTracking = true;
    this.scanAndBindElements();
    this.setupMutationObserver();
    this.setupDynamicContentDetection();
  }

  stopTracking(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    this.removeAllEventListeners();
    this.trackedElements.clear();
    this.onceElements.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  updateConfig(newConfig: Partial<SmartTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isTracking) {
      this.stopTracking();
      this.startTracking();
    }
  }

  private scanAndBindElements(): void {
    // Scan for elements with analytics attributes
    this.scanElementsByAttributes();
    
    // Scan for elements with analytics classes
    if (this.config.trackByClass) {
      this.scanElementsByClass();
    }
    
    // Scan for elements with analytics IDs
    if (this.config.trackById) {
      this.scanElementsById();
    }
  }

  private scanElementsByAttributes(): void {
    const selector = `[${this.config.attributePrefix}*]`;
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(element => {
      const eventData = this.parseElementAttributes(element);
      if (eventData) {
        this.bindElement(element, eventData);
      }
    });
  }

  private scanElementsByClass(): void {
    // Look for elements with classes that match analytics pattern
    const analyticsClassPattern = /analytics-(.+)/;
    const elements = document.querySelectorAll('[class*="analytics-"]');
    
    elements.forEach(element => {
      const classes = element.className.split(' ');
      let eventData: ElementEventData | null = null;
      
      for (const className of classes) {
        const match = className.match(analyticsClassPattern);
        if (match) {
          const eventName = match[1];
          eventData = {
            eventName: this.convertToEventName(eventName),
            properties: this.extractPropertiesFromElement(element),
            eventType: 'click'
          };
          break;
        }
      }
      
      if (eventData) {
        this.bindElement(element, eventData);
      }
    });
  }

  private scanElementsById(): void {
    // Look for elements with IDs that match analytics pattern
    const analyticsIdPattern = /analytics-(.+)/;
    const elements = document.querySelectorAll('[id*="analytics-"]');
    
    elements.forEach(element => {
      const id = element.id;
      const match = id.match(analyticsIdPattern);
      if (match) {
        const eventName = match[1];
        const eventData: ElementEventData = {
          eventName: this.convertToEventName(eventName),
          properties: this.extractPropertiesFromElement(element),
          eventType: 'click'
        };
        this.bindElement(element, eventData);
      }
    });
  }

  private parseElementAttributes(element: Element): ElementEventData | null {
    const prefix = this.config.attributePrefix;
    const eventData: ElementEventData = {
      eventName: '',
      properties: {},
      eventType: 'click'
    };

    // Parse event name
    const eventNameAttr = element.getAttribute(`${prefix}-event`);
    if (eventNameAttr) {
      eventData.eventName = eventNameAttr;
    } else {
      const eventAttr = element.getAttribute(`${prefix}`);
      if (eventAttr) {
        eventData.eventName = eventAttr;
      }
    }

    if (!eventData.eventName) {
      return null;
    }

    // Parse event type
    const eventTypeAttr = element.getAttribute(`${prefix}-type`);
    if (eventTypeAttr) {
      eventData.eventType = eventTypeAttr;
    }

    // Parse properties
    const propertiesAttr = element.getAttribute(`${prefix}-props`);
    if (propertiesAttr) {
      try {
        eventData.properties = JSON.parse(propertiesAttr);
      } catch (error) {
        console.warn(`[SmartTracker] Invalid JSON in ${prefix}-props:`, propertiesAttr);
      }
    }

    // Parse individual property attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith(`${prefix}-prop-`)) {
        const propName = attr.name.substring(`${prefix}-prop-`.length);
        eventData.properties[propName] = attr.value;
      }
    });

    // Parse debounce setting
    const debounceAttr = element.getAttribute(`${prefix}-debounce`);
    if (debounceAttr) {
      eventData.debounce = debounceAttr === 'true';
      const debounceDelayAttr = element.getAttribute(`${prefix}-debounce-delay`);
      if (debounceDelayAttr) {
        eventData.debounceDelay = parseInt(debounceDelayAttr, 10);
      }
    }

    // Parse once setting
    const onceAttr = element.getAttribute(`${prefix}-once`);
    if (onceAttr) {
      eventData.once = onceAttr === 'true';
    }

    // Parse condition
    const conditionAttr = element.getAttribute(`${prefix}-condition`);
    if (conditionAttr) {
      eventData.condition = conditionAttr;
    }

    return eventData;
  }

  private bindElement(element: Element, eventData: ElementEventData): void {
    if (this.config.respectDisabled && element.hasAttribute('disabled')) {
      return;
    }

    // Check if element is already tracked
    if (this.trackedElements.has(element)) {
      return;
    }

    this.trackedElements.set(element, eventData);

    // Bind event listeners based on event type
    const eventTypes = this.getEventTypes(eventData.eventType);
    eventTypes.forEach(eventType => {
      this.bindEventListener(element, eventType, eventData);
    });

    // Handle once tracking
    if (eventData.once) {
      this.onceElements.add(element);
    }
  }

  private getEventTypes(eventType: string): string[] {
    // Handle multiple event types separated by commas
    return eventType.split(',').map(type => type.trim());
  }

  private bindEventListener(element: Element, eventType: string, eventData: ElementEventData): void {
    const listener = (event: Event) => {
      this.handleElementEvent(element, event, eventData);
    };

    element.addEventListener(eventType, listener, true);

    // Store listener for cleanup
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  private handleElementEvent(element: Element, event: Event, eventData: ElementEventData): void {
    // Check condition if specified
    if (eventData.condition && !this.evaluateCondition(eventData.condition, element, event)) {
      return;
    }

    // Handle debounce
    if (eventData.debounce) {
      const elementKey = this.getElementKey(element);
      const delay = eventData.debounceDelay || this.config.debounceDelay;
      
      if (this.debounceTimers.has(elementKey)) {
        clearTimeout(this.debounceTimers.get(elementKey)!);
      }
      
      this.debounceTimers.set(elementKey, setTimeout(() => {
        this.trackElementEvent(element, event, eventData);
        this.debounceTimers.delete(elementKey);
      }, delay));
    } else {
      this.trackElementEvent(element, event, eventData);
    }

    // Handle once
    if (eventData.once) {
      this.onceElements.delete(element);
      this.unbindElement(element);
    }
  }

  private trackElementEvent(element: Element, event: Event, eventData: ElementEventData): void {
    const session = this.sessionManager.getSession();
    if (!session) return;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();

    // Merge dynamic properties with static properties
    const properties = {
      ...eventData.properties,
      ...this.extractDynamicProperties(element, event),
      element: element.tagName.toLowerCase(),
      elementId: element.id || undefined,
      elementClass: element.className || undefined,
      elementText: Utils.sanitizeText(element.textContent || ''),
      eventType: event.type
    };

    const customEvent: CustomEvent = {
      eventType: 'custom',
      eventName: eventData.eventName,
      properties,
      timestamp: Utils.getCurrentTimestamp(),
      userId: session.userId,
      sessionId: session.sessionId,
      url: pageInfo.url,
      userAgent: browserInfo.userAgent,
      referrer: pageInfo.referrer,
      screenResolution: browserInfo.screenResolution,
      viewportSize: browserInfo.viewportSize,
      timezone: browserInfo.timezone,
      language: browserInfo.language
    };

    this.sessionManager.incrementEventsCount();
    
    // Dispatch event for the main tracker to handle
    this.dispatchTrackingEvent(customEvent);
  }

  private extractPropertiesFromElement(element: Element): Record<string, any> {
    const properties: Record<string, any> = {};
    
    // Extract common attributes
    const commonAttrs = ['name', 'value', 'placeholder', 'href', 'src', 'alt', 'title'];
    commonAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        properties[attr] = value;
      }
    });

    // Extract data attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        const propName = attr.name.substring(5);
        properties[propName] = attr.value;
      }
    });

    return properties;
  }

  private extractDynamicProperties(element: Element, event: Event): Record<string, any> {
    const properties: Record<string, any> = {};

    // Add mouse position for click events
    if (event instanceof MouseEvent) {
      properties.clientX = event.clientX;
      properties.clientY = event.clientY;
      properties.pageX = event.pageX;
      properties.pageY = event.pageY;
    }

    // Add key information for keyboard events
    if (event instanceof KeyboardEvent) {
      properties.key = event.key;
      properties.code = event.code;
      properties.ctrlKey = event.ctrlKey;
      properties.shiftKey = event.shiftKey;
      properties.altKey = event.altKey;
    }

    // Add form data for form events
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      properties.inputType = element.type;
      if (!this.isSensitiveInput(element.type, element as HTMLInputElement)) {
        properties.value = element.value;
      }
    }

    return properties;
  }

  private evaluateCondition(condition: string, element: Element, event: Event): boolean {
    try {
      // Simple condition evaluation - can be extended
      const context = {
        element,
        event,
        window,
        document
      };
      
      // Use Function constructor for safe evaluation
      const func = new Function('context', `with(context) { return ${condition}; }`);
      return func(context);
    } catch (error) {
      console.warn('[SmartTracker] Condition evaluation failed:', error);
      return true;
    }
  }

  private isSensitiveInput(inputType: string, element: HTMLInputElement): boolean {
    const sensitiveTypes = [
      'password', 'email', 'tel', 'credit-card', 'ssn', 
      'cc-number', 'cc-exp', 'cc-cvc', 'account-number'
    ];

    return sensitiveTypes.includes(inputType.toLowerCase());
  }

  private convertToEventName(className: string): string {
    // Convert kebab-case to snake_case and add common prefixes
    const converted = className.replace(/-/g, '_');
    
    // Map common patterns to event names
    const mappings = this.config.eventMappings;
    for (const [pattern, eventName] of Object.entries(mappings)) {
      if (converted.includes(pattern)) {
        return eventName;
      }
    }
    
    return converted;
  }

  private getElementKey(element: Element): string {
    return element.id || 
           `${element.tagName.toLowerCase()}.${element.className}` || 
           Utils.generateId();
  }

  private setupMutationObserver(): void {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldRescan = true;
            }
          });
        } else if (mutation.type === 'attributes') {
          const element = mutation.target as Element;
          if (this.isAnalyticsElement(element)) {
            shouldRescan = true;
          }
        }
      });

      if (shouldRescan) {
        // Debounce rescanning
        setTimeout(() => this.scanAndBindElements(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'data-analytics', 'data-analytics-event']
    });
  }

  private setupDynamicContentDetection(): void {
    // Monitor for dynamic content changes
    const events = ['DOMNodeInserted', 'DOMNodeRemoved'];
    events.forEach(eventType => {
      document.addEventListener(eventType, () => {
        setTimeout(() => this.scanAndBindElements(), 100);
      }, true);
    });
  }

  private isAnalyticsElement(element: Element): boolean {
    const prefix = this.config.attributePrefix;
    
    return (
      element.hasAttribute(`${prefix}`) ||
      element.hasAttribute(`${prefix}-event`) ||
      element.className.includes('analytics-') ||
      element.id.includes('analytics-')
    );
  }

  private unbindElement(element: Element): void {
    this.trackedElements.delete(element);
    this.onceElements.delete(element);
    
    // Remove all event listeners for this element
    this.eventListeners.forEach((listeners, eventType) => {
      const filteredListeners = listeners.filter(listener => {
        element.removeEventListener(eventType, listener, true);
        return false;
      });
      this.eventListeners.set(eventType, filteredListeners);
    });
  }

  private removeAllEventListeners(): void {
    this.eventListeners.forEach((listeners, eventType) => {
      listeners.forEach(listener => {
        document.removeEventListener(eventType, listener, true);
      });
    });
    this.eventListeners.clear();
  }

  private dispatchTrackingEvent(event: CustomEvent): void {
    // Create a custom event that the main tracker can listen for
    const customEvent = new CustomEvent('analytics:track', {
      detail: event
    });
    document.dispatchEvent(customEvent);
  }

  // Public API methods
  getTrackedElements(): Element[] {
    return Array.from(this.trackedElements.keys());
  }

  getElementEventData(element: Element): ElementEventData | undefined {
    return this.trackedElements.get(element);
  }

  manuallyTrackElement(element: Element, eventName?: string, properties?: Record<string, any>): void {
    const eventData = this.trackedElements.get(element) || {
      eventName: eventName || this.config.defaultEventName,
      properties: properties || {},
      eventType: 'click'
    };

    this.trackElementEvent(element, new Event('manual'), eventData);
  }

  rescanElements(): void {
    if (this.isTracking) {
      this.scanAndBindElements();
    }
  }
}