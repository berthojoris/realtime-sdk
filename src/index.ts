import {
  AnalyticsConfig,
  AnalyticsEvent,
  CustomEvent,
  Plugin,
  PerformanceMetrics
} from './types';
import { SessionManager } from './session';
import { EventTracker } from './tracking';
import { EventBatcher } from './batching';
import { PrivacyManager } from './privacy';
import { WorkerBridge } from './worker';
import { Utils } from './utils';
import { SmartTracker } from './smart-tracking';

export class RealtimeAnalytics {
  private static instance: RealtimeAnalytics | null = null;
  private config!: AnalyticsConfig;
  private sessionManager!: SessionManager;
  private eventTracker!: EventTracker;
  private eventBatcher!: EventBatcher;
  private privacyManager!: PrivacyManager;
  private workerBridge: WorkerBridge | null = null;
  private smartTracker: SmartTracker | null = null;
  private plugins: Map<string, Plugin> = new Map();
  private isInitialized: boolean = false;
  private startTime: number = 0;
  private firstEventTime: number = 0;
  private eventsSent: number = 0;
  private eventsFailed: number = 0;

  constructor(config: AnalyticsConfig) {
    if (RealtimeAnalytics.instance) {
      return RealtimeAnalytics.instance;
    }

    this.config = this.validateConfig(config);
    this.sessionManager = SessionManager.getInstance();
    this.privacyManager = new PrivacyManager();
    this.eventTracker = new EventTracker(this.sessionManager);
    this.eventBatcher = new EventBatcher({
      apiEndpoint: this.config.apiEndpoint,
      apiKey: this.config.apiKey,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval,
      enableOfflineMode: this.config.enableOfflineMode,
      debugMode: this.config.debugMode
    });

    // Initialize smart tracker if enabled
    if (this.config.enableSmartTracking) {
      this.smartTracker = new SmartTracker(this.sessionManager, this.config.smartTracking);
    }

    RealtimeAnalytics.instance = this;
  }

  static getInstance(config?: AnalyticsConfig): RealtimeAnalytics {
    if (!RealtimeAnalytics.instance && config) {
      RealtimeAnalytics.instance = new RealtimeAnalytics(config);
    }
    return RealtimeAnalytics.instance!;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.startTime = Utils.getCurrentTimestamp();

    // Check if tracking is allowed
    if (!this.privacyManager.isTrackingAllowed()) {
      if (this.config.debugMode) {
        console.log('[RealtimeAnalytics] Tracking not allowed due to privacy settings');
      }
      return;
    }

    // Show consent banner if required
    if (this.privacyManager.shouldShowConsentBanner()) {
      this.privacyManager.showConsentBanner();
    }

    // Initialize session
    this.sessionManager.initialize(this.config.userId);

    // Initialize Web Worker if enabled
    if (this.config.enableWebWorker) {
      this.workerBridge = new WorkerBridge(this.eventBatcher, this.config.debugMode);
      await this.workerBridge.initialize({
        apiEndpoint: this.config.apiEndpoint,
        apiKey: this.config.apiKey,
        batchSize: this.config.batchSize,
        flushInterval: this.config.flushInterval
      });
    }

    // Initialize event batcher
    this.eventBatcher.initialize();

    // Start auto-tracking if enabled
    if (this.config.enableAutoTracking) {
      this.eventTracker.startTracking();
    }

    // Start smart tracking if enabled
    if (this.smartTracker) {
      this.smartTracker.startTracking();
      // Set up event listener for smart tracking events
      document.addEventListener('analytics:track', this.handleSmartTrackingEvent.bind(this));
    }

    // Initialize plugins
    this.plugins.forEach(plugin => {
      plugin.initialize(this);
    });

    this.isInitialized = true;

    if (this.config.debugMode) {
      console.log('[RealtimeAnalytics] SDK initialized successfully');
    }

    // Track initialization event
    this.track('sdk_initialized', {
      version: '1.0.0',
      features: {
        autoTracking: this.config.enableAutoTracking,
        webWorker: this.config.enableWebWorker,
        offlineMode: this.config.enableOfflineMode,
        smartTracking: this.config.enableSmartTracking
      }
    });
  }

  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized || !this.privacyManager.isTrackingAllowed()) {
      return;
    }

    // Record first event time
    if (this.firstEventTime === 0) {
      this.firstEventTime = Utils.getCurrentTimestamp();
    }

    // Apply privacy filters
    const filteredProperties = this.privacyManager.filterProperties(properties || {});
    
    // Merge with custom properties
    const mergedProperties = Utils.deepMerge(
      this.config.customProperties || {},
      filteredProperties
    );

    const event = this.eventTracker.trackCustom(eventName, mergedProperties);
    
    if (event) {
      this.processEvent(event);
    }
  }

  identify(userId: string, traits?: Record<string, any>): void {
    if (!this.isInitialized || !this.privacyManager.isTrackingAllowed()) {
      return;
    }

    this.sessionManager.setUserIdentity(userId, traits);
    
    this.track('user_identified', {
      userId,
      traits: traits || {}
    });
  }

  page(url?: string, title?: string): void {
    if (!this.isInitialized || !this.privacyManager.isTrackingAllowed()) {
      return;
    }

    const currentUrl = url || Utils.getPageInfo().url;
    const currentTitle = title || document.title;

    this.track('page_view', {
      url: currentUrl,
      title: currentTitle
    });
  }

  reset(): void {
    if (!this.isInitialized) {
      return;
    }

    this.sessionManager.clearSession();
    this.sessionManager.clearUserIdentity();
    
    if (this.config.debugMode) {
      console.log('[RealtimeAnalytics] Session reset');
    }
  }

  optOut(): void {
    this.privacyManager.optOut();
    this.stopTracking();
  }

  optIn(): void {
    this.privacyManager.optIn();
    if (this.isInitialized && this.config.enableAutoTracking) {
      this.eventTracker.startTracking();
    }
  }

  addPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      if (this.config.debugMode) {
        console.warn(`[RealtimeAnalytics] Plugin ${plugin.name} already exists`);
      }
      return;
    }

    this.plugins.set(plugin.name, plugin);
    
    if (this.isInitialized) {
      plugin.initialize(this);
    }
  }

  removePlugin(pluginName: string): void {
    this.plugins.delete(pluginName);
  }

  async flush(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    if (this.workerBridge) {
      this.workerBridge.flush();
    } else {
      await this.eventBatcher.forceFlush();
    }
  }

  stopTracking(): void {
    this.eventTracker.stopTracking();
    if (this.smartTracker) {
      this.smartTracker.stopTracking();
    }
  }

  startTracking(): void {
    if (this.isInitialized && this.privacyManager.isTrackingAllowed()) {
      this.eventTracker.startTracking();
      if (this.smartTracker) {
        this.smartTracker.startTracking();
      }
    }
  }

  private processEvent(event: AnalyticsEvent): void {
    // Apply privacy anonymization
    const anonymizedEvent = this.privacyManager.anonymizeData(event);

    // Run through plugins
    let processedEvent = anonymizedEvent;
    this.plugins.forEach(plugin => {
      if (plugin.track) {
        const result = plugin.track(processedEvent);
        if (result) {
          processedEvent = result;
        }
      }
    });

    // Send to batcher or worker
    if (this.workerBridge) {
      this.workerBridge.trackEvent(processedEvent);
    } else {
      this.eventBatcher.addEvent(processedEvent);
    }

    this.eventsSent++;
  }

  private handleSmartTrackingEvent(event: Event): void {
    const customEvent = event as any; // Use any to access detail property
    const analyticsEvent = customEvent.detail as AnalyticsEvent;
    this.processEvent(analyticsEvent);
  }

  private validateConfig(config: AnalyticsConfig): AnalyticsConfig {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    if (!config.apiEndpoint) {
      throw new Error('API endpoint is required');
    }

    if (!Utils.isValidUrl(config.apiEndpoint)) {
      throw new Error('Invalid API endpoint URL');
    }

    return {
      enableAutoTracking: true,
      batchSize: 10,
      flushInterval: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableOfflineMode: true,
      enableWebWorker: false,
      debugMode: false,
      respectDoNotTrack: true,
      enableSmartTracking: false,
      smartTracking: {
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
        ...config.smartTracking
      },
      ...config
    };
  }

  // Public API methods
  getSession(): any {
    return this.sessionManager.getSession();
  }

  getUserIdentity(): any {
    return this.sessionManager.getUserIdentity();
  }

  getPrivacyStatus(): any {
    return this.privacyManager.getPrivacyStatus();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      sdkLoadTime: this.startTime,
      firstEventTime: this.firstEventTime,
      eventsSent: this.eventsSent,
      eventsFailed: this.eventsFailed,
      averageLatency: 0, // Would need to track this in batcher
      batchSize: this.config.batchSize || 10,
      queueSize: this.eventBatcher.getQueueSize()
    };
  }

  getStats(): any {
    const stats: any = {
      isInitialized: this.isInitialized,
      session: this.sessionManager.getSession(),
      privacy: this.privacyManager.getPrivacyStatus(),
      performance: this.getPerformanceMetrics(),
      batching: this.eventBatcher.getStats(),
      plugins: Array.from(this.plugins.keys())
    };

    if (this.workerBridge) {
      stats.worker = this.workerBridge.getStats();
    }

    if (this.smartTracker) {
      stats.smartTracking = {
        trackedElements: this.smartTracker.getTrackedElements().length,
        isEnabled: this.smartTracker ? true : false
      };
    }

    return stats;
  }

  // Smart tracking API methods
  getSmartTracker(): SmartTracker | null {
    return this.smartTracker;
  }

  trackElement(element: Element, eventName?: string, properties?: Record<string, any>): void {
    if (this.smartTracker) {
      this.smartTracker.manuallyTrackElement(element, eventName, properties);
    }
  }

  rescanSmartElements(): void {
    if (this.smartTracker) {
      this.smartTracker.rescanElements();
    }
  }

  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update dependent components
    this.eventBatcher.updateConfig({
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval,
      debugMode: this.config.debugMode
    });

    this.privacyManager.updateConfig({
      respectDoNotTrack: this.config.respectDoNotTrack,
      anonymizeIp: true,
      maskSensitiveInputs: true,
      excludeLocalhost: true,
      cookieConsentRequired: false,
      dataRetentionDays: 365
    });
  }

  // GDPR compliance methods
  async exportUserData(): Promise<any> {
    return this.privacyManager.exportUserData();
  }

  async deleteUserData(): Promise<void> {
    await this.privacyManager.deleteUserData();
    this.reset();
  }

  // Cleanup method
  destroy(): void {
    this.stopTracking();
    
    if (this.workerBridge) {
      this.workerBridge.destroy();
    }
    
    if (this.smartTracker) {
      document.removeEventListener('analytics:track', this.handleSmartTrackingEvent.bind(this));
    }
    
    this.eventBatcher.destroy();
    this.sessionManager.clearSession();
    this.sessionManager.clearUserIdentity();
    
    this.plugins.clear();
    this.isInitialized = false;
    
    RealtimeAnalytics.instance = null;
  }
}

// Export types and utilities
export * from './types';
export { Utils } from './utils';
export { SessionManager } from './session';
export { EventTracker } from './tracking';
export { EventBatcher } from './batching';
export { PrivacyManager } from './privacy';
export { WorkerBridge } from './worker';
export { SmartTracker } from './smart-tracking';

// Global initialization helper
export function initialize(config: AnalyticsConfig): RealtimeAnalytics {
  const analytics = new RealtimeAnalytics(config);
  analytics.initialize().catch(error => {
    if (config.debugMode) {
      console.error('[RealtimeAnalytics] Initialization failed:', error);
    }
  });
  return analytics;
}

// Auto-initialization for script tag usage
if (typeof window !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement;
  if (script && script.dataset.config) {
    try {
      const config = JSON.parse(script.dataset.config);
      initialize(config);
    } catch (error) {
      console.error('[RealtimeAnalytics] Invalid configuration in script tag:', error);
    }
  }
}