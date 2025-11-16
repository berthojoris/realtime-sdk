export interface AnalyticsConfig {
  apiKey: string;
  apiEndpoint: string;
  userId?: string;
  sessionId?: string;
  enableAutoTracking?: boolean;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableOfflineMode?: boolean;
  enableWebWorker?: boolean;
  debugMode?: boolean;
  respectDoNotTrack?: boolean;
  domainWhitelist?: string[];
  customProperties?: Record<string, any>;
}

export interface EventData {
  eventType: string;
  eventName: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
  url: string;
  userAgent: string;
  referrer?: string;
  screenResolution?: string;
  viewportSize?: string;
  timezone?: string;
  language?: string;
}

export interface ClickEvent extends EventData {
  eventType: 'click';
  properties: {
    element: string;
    elementId?: string;
    elementClass?: string;
    elementText?: string;
    x: number;
    y: number;
    pageX: number;
    pageY: number;
    target: string;
  };
}

export interface NavigationEvent extends EventData {
  eventType: 'navigation';
  properties: {
    from: string;
    to: string;
    title: string;
  };
}

export interface ScrollEvent extends EventData {
  eventType: 'scroll';
  properties: {
    scrollTop: number;
    scrollLeft: number;
    scrollHeight: number;
    scrollWidth: number;
    viewportHeight: number;
    viewportWidth: number;
    scrollDepth: number;
  };
}

export interface InputEvent extends EventData {
  eventType: 'input';
  properties: {
    element: string;
    elementId?: string;
    elementClass?: string;
    inputType: string;
    value?: string;
    isSensitive: boolean;
  };
}

export interface ErrorEvent extends EventData {
  eventType: 'error';
  properties: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    errorType: string;
  };
}

export interface CustomEvent extends EventData {
  eventType: 'custom';
  properties: Record<string, any>;
}

export type AnalyticsEvent = ClickEvent | NavigationEvent | ScrollEvent | InputEvent | ErrorEvent | CustomEvent;

export interface BatchEvent {
  events: AnalyticsEvent[];
  sentAt: number;
  batchId: string;
}

export interface SessionData {
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  eventsCount: number;
  duration: number;
  isActive: boolean;
  referrer?: string;
  landingPage: string;
  exitPage?: string;
  userAgent: string;
  timezone?: string;
  language?: string;
  screenResolution?: string;
  viewportSize?: string;
}

export interface UserIdentity {
  userId: string;
  anonymousId: string;
  traits?: Record<string, any>;
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  totalEvents: number;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
}

export interface WebWorkerMessage {
  type: 'track' | 'batch' | 'flush' | 'config' | 'response';
  data?: any;
  id?: string;
}

export interface Plugin {
  name: string;
  initialize: (analytics: any) => void;
  track?: (event: AnalyticsEvent) => AnalyticsEvent | null;
  beforeSend?: (events: AnalyticsEvent[]) => AnalyticsEvent[];
  afterSend?: (events: AnalyticsEvent[], response: any) => void;
}

export interface PrivacyConfig {
  respectDoNotTrack: boolean;
  anonymizeIp: boolean;
  maskSensitiveInputs: boolean;
  excludeLocalhost: boolean;
  cookieConsentRequired: boolean;
  dataRetentionDays: number;
}

export interface PerformanceMetrics {
  sdkLoadTime: number;
  firstEventTime: number;
  eventsSent: number;
  eventsFailed: number;
  averageLatency: number;
  batchSize: number;
  queueSize: number;
}