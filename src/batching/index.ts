import { AnalyticsEvent, BatchEvent, RetryConfig, ApiResponse } from '../types';
import { Utils } from '../utils';

export class EventBatcher {
  private eventQueue: AnalyticsEvent[] = [];
  private batchSize: number;
  private flushInterval: number;
  private apiEndpoint: string;
  private apiKey: string;
  private retryConfig: RetryConfig;
  private isOnline: boolean = true;
  private flushTimer: NodeJS.Timeout | null = null;
  private offlineQueue: AnalyticsEvent[] = [];
  private maxOfflineQueueSize: number = 1000;
  private enableOfflineMode: boolean;
  private debugMode: boolean;

  constructor(config: {
    apiEndpoint: string;
    apiKey: string;
    batchSize?: number;
    flushInterval?: number;
    retryConfig?: Partial<RetryConfig>;
    enableOfflineMode?: boolean;
    debugMode?: boolean;
  }) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;
    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000; // 5 seconds
    this.enableOfflineMode = config.enableOfflineMode !== false;
    this.debugMode = config.debugMode || false;

    this.retryConfig = {
      maxRetries: config.retryConfig?.maxRetries || 3,
      retryDelay: config.retryConfig?.retryDelay || 1000,
      backoffMultiplier: config.retryConfig?.backoffMultiplier || 2,
      maxRetryDelay: config.retryConfig?.maxRetryDelay || 30000
    };

    this.setupNetworkMonitoring();
    this.startFlushTimer();
  }

  addEvent(event: AnalyticsEvent): void {
    if (this.isOnline) {
      this.eventQueue.push(event);
      
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Event added to queue:', event.eventName);
      }

      // Auto-flush if batch size reached
      if (this.eventQueue.length >= this.batchSize) {
        this.flush();
      }
    } else if (this.enableOfflineMode) {
      this.addToOfflineQueue(event);
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.debugMode) {
      console.log(`[RealtimeAnalytics] Flushing ${events.length} events`);
    }

    try {
      await this.sendBatch(events);
    } catch (error) {
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events);
      
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Failed to send batch:', error);
      }
    }
  }

  async sendBatch(events: AnalyticsEvent[], retryCount: number = 0): Promise<ApiResponse> {
    const batchEvent: BatchEvent = {
      events,
      sentAt: Utils.getCurrentTimestamp(),
      batchId: Utils.generateId()
    };

    const payload = {
      apiKey: this.apiKey,
      batch: batchEvent
    };

    try {
      const response = await this.makeRequest(payload);
      
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Batch sent successfully:', response);
      }

      // Process offline queue if online and this batch succeeded
      if (this.isOnline && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }

      return response;
    } catch (error) {
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        
        if (this.debugMode) {
          console.log(`[RealtimeAnalytics] Retry ${retryCount + 1}/${this.retryConfig.maxRetries} in ${delay}ms`);
        }

        await this.delay(delay);
        return this.sendBatch(events, retryCount + 1);
      } else {
        // Max retries reached, add to offline queue if enabled
        if (this.enableOfflineMode) {
          events.forEach(event => this.addToOfflineQueue(event));
        }
        
        throw error;
      }
    }
  }

  private async makeRequest(payload: any): Promise<ApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        keepalive: true // Use keepalive for better reliability
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxRetryDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupNetworkMonitoring(): void {
    this.isOnline = navigator.onLine;

    const onlineHandler = () => {
      this.isOnline = true;
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Network online');
      }
      this.processOfflineQueue();
    };

    const offlineHandler = () => {
      this.isOnline = false;
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Network offline');
      }
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
  }

  private addToOfflineQueue(event: AnalyticsEvent): void {
    if (this.offlineQueue.length >= this.maxOfflineQueueSize) {
      // Remove oldest events if queue is full
      this.offlineQueue = this.offlineQueue.slice(-this.maxOfflineQueueSize + 1);
    }
    
    this.offlineQueue.push(event);
    this.saveOfflineQueue();
    
    if (this.debugMode) {
      console.log('[RealtimeAnalytics] Event added to offline queue');
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    const offlineEvents = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    if (this.debugMode) {
      console.log(`[RealtimeAnalytics] Processing ${offlineEvents.length} offline events`);
    }

    // Process offline events in batches
    for (let i = 0; i < offlineEvents.length; i += this.batchSize) {
      const batch = offlineEvents.slice(i, i + this.batchSize);
      
      try {
        await this.sendBatch(batch);
      } catch (error) {
        // Re-add failed events to offline queue
        this.offlineQueue.unshift(...batch);
        this.saveOfflineQueue();
        
        if (this.debugMode) {
          console.error('[RealtimeAnalytics] Failed to process offline batch:', error);
        }
        break;
      }
    }
  }

  private saveOfflineQueue(): void {
    if (!this.enableOfflineMode) return;
    
    try {
      Utils.setLocalStorage('rt_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Failed to save offline queue:', error);
      }
    }
  }

  private loadOfflineQueue(): void {
    if (!this.enableOfflineMode) return;
    
    try {
      const stored = Utils.getLocalStorage('rt_offline_queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        
        if (this.debugMode) {
          console.log(`[RealtimeAnalytics] Loaded ${this.offlineQueue.length} offline events`);
        }
      }
    } catch (error) {
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Failed to load offline queue:', error);
      }
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  // Public methods
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  clearQueue(): void {
    this.eventQueue = [];
  }

  clearOfflineQueue(): void {
    this.offlineQueue = [];
    Utils.removeLocalStorage('rt_offline_queue');
  }

  updateConfig(config: {
    batchSize?: number;
    flushInterval?: number;
    retryConfig?: Partial<RetryConfig>;
    debugMode?: boolean;
  }): void {
    if (config.batchSize) {
      this.batchSize = config.batchSize;
    }
    
    if (config.flushInterval) {
      this.flushInterval = config.flushInterval;
      this.startFlushTimer();
    }
    
    if (config.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...config.retryConfig };
    }
    
    if (config.debugMode !== undefined) {
      this.debugMode = config.debugMode;
    }
  }

  // Force send all queued events immediately
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  // Get statistics about the batching system
  getStats(): {
    queueSize: number;
    offlineQueueSize: number;
    isOnline: boolean;
    batchSize: number;
    flushInterval: number;
    maxRetries: number;
  } {
    return {
      queueSize: this.eventQueue.length,
      offlineQueueSize: this.offlineQueue.length,
      isOnline: this.isOnline,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      maxRetries: this.retryConfig.maxRetries
    };
  }

  // Initialize the batcher (load offline queue, start timers)
  initialize(): void {
    this.loadOfflineQueue();
    this.startFlushTimer();
    
    if (this.debugMode) {
      console.log('[RealtimeAnalytics] Event batcher initialized');
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Save any remaining events
    if (this.eventQueue.length > 0) {
      this.eventQueue.forEach(event => this.addToOfflineQueue(event));
    }
    
    if (this.debugMode) {
      console.log('[RealtimeAnalytics] Event batcher destroyed');
    }
  }
}