import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';

export class Utils {
  static generateId(): string {
    return uuidv4();
  }

  static getCurrentTimestamp(): number {
    return Date.now();
  }

  static getBrowserInfo(): {
    userAgent: string;
    language: string;
    timezone: string;
    screenResolution: string;
    viewportSize: string;
  } {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  static getPageInfo(): {
    url: string;
    title: string;
    referrer: string;
  } {
    return {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    };
  }

  static sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  static sanitizeText(text: string): string {
    return text.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }

  static isDoNotTrackEnabled(): boolean {
    return (
      navigator.doNotTrack === '1' ||
      (window as any).doNotTrack === '1' ||
      (navigator as any).msDoNotTrack === '1'
    );
  }

  static isLocalhost(): boolean {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === ''
    );
  }

  static isSecureContext(): boolean {
    return window.isSecureContext || window.location.protocol === 'https:';
  }

  static getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  static setCookie(name: string, value: string, days: number = 365): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  static deleteCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
  }

  static getLocalStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  static setLocalStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  }

  static removeLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail if localStorage is not available
    }
  }

  static getSessionStorage(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  static setSessionStorage(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Silently fail if sessionStorage is not available
    }
  }

  static removeSessionStorage(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Silently fail if sessionStorage is not available
    }
  }

  static anonymizeIp(ip: string): string {
    if (!ip) return '';
    
    const parts = ip.split('.');
    if (parts.length === 4) {
      // IPv4
      return `${parts[0]}.${parts[1]}.0.0`;
    }
    
    // IPv6 - simple anonymization
    return ip.replace(/:[a-fA-F0-9]{1,4}(:[a-fA-F0-9]{1,4}){2}$/, ':0:0');
  }

  static hashData(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  static maskSensitiveInput(value: string, inputType: string): string {
    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card', 'ssn'];
    
    if (sensitiveTypes.includes(inputType) || 
        inputType.includes('password') || 
        inputType.includes('email')) {
      return '*'.repeat(Math.min(value.length, 8));
    }
    
    return value;
  }

  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  static deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }

  static isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static getScrollDepth(): number {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    
    return Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
  }

  static getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const path = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      if (current.className) {
        selector += '.' + current.className.split(' ').join('.');
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static getPerformanceMetrics(): {
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
  } {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    const metrics: {
      loadTime: number;
      domContentLoaded: number;
      firstContentfulPaint?: number;
      largestContentfulPaint?: number;
    } = {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
    };
    
    // Get paint metrics if available
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      metrics.firstContentfulPaint = fcp.startTime;
    }
    
    // Get LCP if available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.largestContentfulPaint = lastEntry.startTime;
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch {
        // LCP not supported
      }
    }
    
    return metrics;
  }
}