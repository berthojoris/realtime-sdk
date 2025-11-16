import type {
  AnalyticsEvent,
  ClickEvent,
  NavigationEvent,
  ScrollEvent,
  InputEvent,
  ErrorEvent,
  CustomEvent
} from '../types';
import { Utils } from '../utils';
import { SessionManager } from '../session';

export class EventTracker {
  private sessionManager: SessionManager;
  private isTracking: boolean = false;
  private eventListeners: Map<string, EventListener> = new Map();
  private scrollDepthTracker: { lastDepth: number; maxDepth: number } = { lastDepth: 0, maxDepth: 0 };
  private scrollThrottleDelay: number = 1000; // 1 second

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.setupClickTracking();
    this.setupNavigationTracking();
    this.setupScrollTracking();
    this.setupInputTracking();
    this.setupErrorTracking();
    this.setupPageVisibilityTracking();
  }

  stopTracking(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    this.eventListeners.forEach((listener, event) => {
      if (event === 'scroll') {
        window.removeEventListener(event, listener);
      } else {
        document.removeEventListener(event, listener);
      }
    });
    this.eventListeners.clear();
  }

  trackClick(event: MouseEvent): ClickEvent | null {
    if (!this.isTracking) return null;

    const target = event.target as Element;
    if (!target) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();

    const clickEvent: ClickEvent = {
      eventType: 'click',
      eventName: 'element_click',
      properties: {
        element: target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementClass: target.className || undefined,
        elementText: Utils.sanitizeText(target.textContent || ''),
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        target: Utils.getElementSelector(target)
      },
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
    return clickEvent;
  }

  trackNavigation(from: string, to: string): NavigationEvent | null {
    if (!this.isTracking) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();

    const navigationEvent: NavigationEvent = {
      eventType: 'navigation',
      eventName: 'page_view',
      properties: {
        from,
        to,
        title: document.title
      },
      timestamp: Utils.getCurrentTimestamp(),
      userId: session.userId,
      sessionId: session.sessionId,
      url: to,
      userAgent: browserInfo.userAgent,
      referrer: from,
      screenResolution: browserInfo.screenResolution,
      viewportSize: browserInfo.viewportSize,
      timezone: browserInfo.timezone,
      language: browserInfo.language
    };

    this.sessionManager.incrementPageViews();
    this.sessionManager.incrementEventsCount();
    return navigationEvent;
  }

  trackScroll(): ScrollEvent | null {
    if (!this.isTracking) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();
    const scrollDepth = Utils.getScrollDepth();

    // Only track if scroll depth has changed significantly
    if (scrollDepth <= this.scrollDepthTracker.lastDepth + 5) {
      return null;
    }

    this.scrollDepthTracker.lastDepth = scrollDepth;
    this.scrollDepthTracker.maxDepth = Math.max(this.scrollDepthTracker.maxDepth, scrollDepth);

    const scrollEvent: ScrollEvent = {
      eventType: 'scroll',
      eventName: 'page_scroll',
      properties: {
        scrollTop: window.pageYOffset || document.documentElement.scrollTop,
        scrollLeft: window.pageXOffset || document.documentElement.scrollLeft,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        scrollDepth
      },
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
    return scrollEvent;
  }

  trackInput(event: Event): InputEvent | null {
    if (!this.isTracking) return null;

    const target = event.target as HTMLInputElement;
    if (!target) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();
    const inputType = target.type || target.tagName.toLowerCase();
    const isSensitive = this.isSensitiveInput(inputType, target);

    const inputEvent: InputEvent = {
      eventType: 'input',
      eventName: 'form_input',
      properties: {
        element: target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementClass: target.className || undefined,
        inputType,
        value: isSensitive ? undefined : Utils.maskSensitiveInput(target.value, inputType),
        isSensitive
      },
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
    return inputEvent;
  }

  trackError(error: globalThis.ErrorEvent | Error): ErrorEvent | null {
    if (!this.isTracking) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();

    let errorData: {
      message: string;
      filename?: string;
      lineno?: number;
      colno?: number;
      stack?: string;
    };

    if (error instanceof globalThis.ErrorEvent) {
      errorData = {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        stack: error.error?.stack
      };
    } else {
      errorData = {
        message: error.message,
        stack: error.stack
      };
    }

    const errorEvent: ErrorEvent = {
      eventType: 'error',
      eventName: 'javascript_error',
      properties: {
        ...errorData,
        errorType: error.constructor.name
      },
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
    return errorEvent;
  }

  trackCustom(eventName: string, properties: Record<string, any>): CustomEvent | null {
    if (!this.isTracking) return null;

    const session = this.sessionManager.getSession();
    if (!session) return null;

    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();

    const customEvent: CustomEvent = {
      eventType: 'custom',
      eventName,
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
    return customEvent;
  }

  private setupClickTracking(): void {
    const clickHandler = (event: Event) => {
      this.trackClick(event as MouseEvent);
    };

    document.addEventListener('click', clickHandler, true);
    this.eventListeners.set('click', clickHandler);
  }

  private setupNavigationTracking(): void {
    // Track initial page load
    const currentUrl = Utils.getPageInfo().url;
    this.trackNavigation(document.referrer || '', currentUrl);

    // Track hash changes
    const hashChangeHandler = () => {
      const newUrl = Utils.getPageInfo().url;
      this.trackNavigation(currentUrl, newUrl);
    };

    window.addEventListener('hashchange', hashChangeHandler);
    this.eventListeners.set('hashchange', hashChangeHandler);

    // Track history changes (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event('pushstate'));
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event('replacestate'));
      return result;
    };

    const popStateHandler = () => {
      const newUrl = Utils.getPageInfo().url;
      this.trackNavigation(currentUrl, newUrl);
    };

    window.addEventListener('popstate', popStateHandler);
    this.eventListeners.set('popstate', popStateHandler);

    const pushStateHandler = () => {
      const newUrl = Utils.getPageInfo().url;
      this.trackNavigation(currentUrl, newUrl);
    };

    window.addEventListener('pushstate', pushStateHandler);
    this.eventListeners.set('pushstate', pushStateHandler);

    const replaceStateHandler = () => {
      const newUrl = Utils.getPageInfo().url;
      this.trackNavigation(currentUrl, newUrl);
    };

    window.addEventListener('replacestate', replaceStateHandler);
    this.eventListeners.set('replacestate', replaceStateHandler);
  }

  private setupScrollTracking(): void {
    const throttledScrollHandler = Utils.throttle(() => {
      this.trackScroll();
    }, this.scrollThrottleDelay);

    window.addEventListener('scroll', throttledScrollHandler, { passive: true });
    this.eventListeners.set('scroll', throttledScrollHandler);
  }

  private setupInputTracking(): void {
    const inputHandler = (event: Event) => {
      // Only track input events on form elements
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        this.trackInput(event);
      }
    };

    document.addEventListener('input', inputHandler, true);
    this.eventListeners.set('input', inputHandler);

    // Also track focus events for form fields
    const focusHandler = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        this.trackCustom('form_focus', {
          element: target.tagName.toLowerCase(),
          elementId: target.id || undefined,
          elementClass: target.className || undefined,
          inputType: (target as HTMLInputElement).type || target.tagName.toLowerCase()
        });
      }
    };

    document.addEventListener('focus', focusHandler, true);
    this.eventListeners.set('focus', focusHandler);
  }

  private setupErrorTracking(): void {
    const errorHandler = (event: globalThis.ErrorEvent) => {
      this.trackError(event);
    };

    window.addEventListener('error', errorHandler, true);
    this.eventListeners.set('error', errorHandler as EventListener);

    // Also track unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      this.trackCustom('unhandled_promise_rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    };

    window.addEventListener('unhandledrejection', rejectionHandler, true);
    this.eventListeners.set('unhandledrejection', rejectionHandler as EventListener);
  }

  private setupPageVisibilityTracking(): void {
    const visibilityHandler = () => {
      if (document.hidden) {
        this.trackCustom('page_hidden', {
          timestamp: Utils.getCurrentTimestamp()
        });
      } else {
        this.trackCustom('page_visible', {
          timestamp: Utils.getCurrentTimestamp()
        });
        this.sessionManager.updateSession();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    this.eventListeners.set('visibilitychange', visibilityHandler);
  }

  private isSensitiveInput(inputType: string, element: HTMLInputElement): boolean {
    const sensitiveTypes = [
      'password', 'email', 'tel', 'credit-card', 'ssn', 
      'cc-number', 'cc-exp', 'cc-cvc', 'account-number'
    ];

    const sensitiveAttributes = [
      'password', 'secret', 'token', 'key', 'auth'
    ];

    // Check input type
    if (sensitiveTypes.includes(inputType.toLowerCase())) {
      return true;
    }

    // Check element attributes
    for (const attr of sensitiveAttributes) {
      if (element.id?.toLowerCase().includes(attr) ||
          element.name?.toLowerCase().includes(attr) ||
          element.className?.toLowerCase().includes(attr)) {
        return true;
      }
    }

    // Check autocomplete attribute
    if (element.autocomplete && sensitiveTypes.some(type => element.autocomplete.includes(type))) {
      return true;
    }

    return false;
  }

  // Get current scroll depth statistics
  getScrollStats(): { maxDepth: number; currentDepth: number } {
    return {
      maxDepth: this.scrollDepthTracker.maxDepth,
      currentDepth: this.scrollDepthTracker.lastDepth
    };
  }

  // Reset scroll tracking (useful for single-page applications)
  resetScrollTracking(): void {
    this.scrollDepthTracker = { lastDepth: 0, maxDepth: 0 };
  }
}