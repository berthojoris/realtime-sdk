import { WebWorkerMessage, AnalyticsEvent } from '../types';
import { Utils } from '../utils';

export class WorkerManager {
  private worker: Worker | null = null;
  private isWorkerSupported: boolean = false;
  private messageQueue: WebWorkerMessage[] = [];
  private isWorkerReady: boolean = false;
  private debugMode: boolean = false;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
    this.isWorkerSupported = this.checkWorkerSupport();
  }

  private checkWorkerSupport(): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL !== 'undefined'
    );
  }

  async initialize(): Promise<void> {
    if (!this.isWorkerSupported) {
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Web Worker not supported, using main thread');
      }
      return;
    }

    try {
      await this.createWorker();
      this.setupWorkerHandlers();
      
      // Process any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.postMessage(message);
        }
      }
    } catch (error) {
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Failed to initialize Web Worker:', error);
      }
      this.isWorkerSupported = false;
    }
  }

  private async createWorker(): Promise<void> {
    const workerCode = this.getWorkerCode();
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    this.worker = new Worker(workerUrl);
    
    // Clean up the object URL after worker is created
    setTimeout(() => {
      URL.revokeObjectURL(workerUrl);
    }, 1000);
  }

  private getWorkerCode(): string {
    return `
      // Web Worker code for Realtime Analytics
      let eventQueue = [];
      let batchConfig = {
        batchSize: 10,
        flushInterval: 5000,
        apiEndpoint: '',
        apiKey: ''
      };
      let flushTimer = null;

      // Handle messages from main thread
      self.onmessage = function(event) {
        const message = event.data;
        
        switch (message.type) {
          case 'config':
            batchConfig = { ...batchConfig, ...message.data };
            startFlushTimer();
            break;
            
          case 'track':
            eventQueue.push(message.data);
            if (eventQueue.length >= batchConfig.batchSize) {
              flushEvents();
            }
            break;
            
          case 'batch':
            eventQueue.push(...message.data);
            break;
            
          case 'flush':
            flushEvents();
            break;
            
          case 'response':
            // Handle response from main thread if needed
            break;
        }
      };

      function startFlushTimer() {
        if (flushTimer) {
          clearInterval(flushTimer);
        }
        
        flushTimer = setInterval(() => {
          if (eventQueue.length > 0) {
            flushEvents();
          }
        }, batchConfig.flushInterval);
      }

      async function flushEvents() {
        if (eventQueue.length === 0) return;
        
        const events = [...eventQueue];
        eventQueue = [];
        
        try {
          const response = await sendBatch(events);
          self.postMessage({
            type: 'response',
            data: { success: true, events: events.length },
            id: message.id
          });
        } catch (error) {
          // Re-add events to queue on failure
          eventQueue.unshift(...events);
          self.postMessage({
            type: 'response',
            data: { success: false, error: error.message },
            id: message.id
          });
        }
      }

      async function sendBatch(events) {
        const batchEvent = {
          events,
          sentAt: Date.now(),
          batchId: generateId()
        };

        const payload = {
          apiKey: batchConfig.apiKey,
          batch: batchEvent
        };

        const response = await fetch(batchConfig.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': batchConfig.apiKey
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }

        return response.json();
      }

      function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      // Cleanup on worker termination
      self.onclose = function() {
        if (flushTimer) {
          clearInterval(flushTimer);
        }
      };
    `;
  }

  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event) => {
      const message = event.data as WebWorkerMessage;
      
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Worker message:', message);
      }

      // Handle worker responses
      if (message.type === 'response') {
        this.handleWorkerResponse(message);
      }
    };

    this.worker.onerror = (error) => {
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Worker error:', error);
      }
      
      // Fallback to main thread on worker error
      this.destroy();
    };

    this.isWorkerReady = true;
  }

  private handleWorkerResponse(message: WebWorkerMessage): void {
    // Handle responses from worker
    // This can be extended to handle specific response types
    if (message.data?.success === false && this.debugMode) {
      console.error('[RealtimeAnalytics] Worker operation failed:', message.data.error);
    }
  }

  postMessage(message: WebWorkerMessage): void {
    if (!this.isWorkerSupported || !this.worker || !this.isWorkerReady) {
      // Queue message for later processing
      this.messageQueue.push(message);
      return;
    }

    try {
      this.worker.postMessage(message);
    } catch (error) {
      if (this.debugMode) {
        console.error('[RealtimeAnalytics] Failed to post message to worker:', error);
      }
      
      // Fallback to main thread
      this.messageQueue.push(message);
    }
  }

  configure(config: {
    apiEndpoint: string;
    apiKey: string;
    batchSize?: number;
    flushInterval?: number;
  }): void {
    const message: WebWorkerMessage = {
      type: 'config',
      data: config
    };

    this.postMessage(message);
  }

  trackEvent(event: AnalyticsEvent): void {
    const message: WebWorkerMessage = {
      type: 'track',
      data: event
    };

    this.postMessage(message);
  }

  trackBatch(events: AnalyticsEvent[]): void {
    const message: WebWorkerMessage = {
      type: 'batch',
      data: events
    };

    this.postMessage(message);
  }

  flush(): void {
    const message: WebWorkerMessage = {
      type: 'flush'
    };

    this.postMessage(message);
  }

  isReady(): boolean {
    return this.isWorkerSupported && this.isWorkerReady;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isWorkerReady = false;
    this.messageQueue = [];
  }

  // Performance monitoring
  getWorkerStats(): {
    isSupported: boolean;
    isReady: boolean;
    queueSize: number;
  } {
    return {
      isSupported: this.isWorkerSupported,
      isReady: this.isWorkerReady,
      queueSize: this.messageQueue.length
    };
  }

  // Fallback methods for when worker is not available
  processInMainThread(events: AnalyticsEvent[]): Promise<any> {
    return new Promise((resolve, reject) => {
      // This would be handled by the main EventBatcher
      // This is just a placeholder for the fallback mechanism
      resolve({ success: true, events: events.length });
    });
  }
}

// Utility class for managing worker communication
export class WorkerBridge {
  private workerManager: WorkerManager;
  private eventBatcher: any; // Reference to EventBatcher
  private debugMode: boolean;

  constructor(eventBatcher: any, debugMode: boolean = false) {
    this.eventBatcher = eventBatcher;
    this.debugMode = debugMode;
    this.workerManager = new WorkerManager(debugMode);
  }

  async initialize(config: {
    apiEndpoint: string;
    apiKey: string;
    batchSize?: number;
    flushInterval?: number;
  }): Promise<void> {
    await this.workerManager.initialize();
    
    if (this.workerManager.isReady()) {
      this.workerManager.configure(config);
      
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Using Web Worker for event processing');
      }
    } else {
      if (this.debugMode) {
        console.log('[RealtimeAnalytics] Using main thread for event processing');
      }
    }
  }

  trackEvent(event: AnalyticsEvent): void {
    if (this.workerManager.isReady()) {
      this.workerManager.trackEvent(event);
    } else {
      // Fallback to main thread batcher
      this.eventBatcher.addEvent(event);
    }
  }

  trackBatch(events: AnalyticsEvent[]): void {
    if (this.workerManager.isReady()) {
      this.workerManager.trackBatch(events);
    } else {
      // Fallback to main thread batcher
      events.forEach(event => this.eventBatcher.addEvent(event));
    }
  }

  flush(): void {
    if (this.workerManager.isReady()) {
      this.workerManager.flush();
    } else {
      // Fallback to main thread batcher
      this.eventBatcher.flush();
    }
  }

  getStats(): {
    workerStats: any;
    isUsingWorker: boolean;
  } {
    return {
      workerStats: this.workerManager.getWorkerStats(),
      isUsingWorker: this.workerManager.isReady()
    };
  }

  destroy(): void {
    this.workerManager.destroy();
  }
}