import { PrivacyConfig } from '../types';
import { Utils } from '../utils';

export class PrivacyManager {
  private config: PrivacyConfig;
  private isOptedOut: boolean = false;
  private consentRequired: boolean = false;
  private hasConsent: boolean = false;

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = {
      respectDoNotTrack: config.respectDoNotTrack !== false,
      anonymizeIp: config.anonymizeIp !== false,
      maskSensitiveInputs: config.maskSensitiveInputs !== false,
      excludeLocalhost: config.excludeLocalhost !== false,
      cookieConsentRequired: config.cookieConsentRequired || false,
      dataRetentionDays: config.dataRetentionDays || 365
    };

    this.initializePrivacy();
  }

  private initializePrivacy(): void {
    // Check Do Not Track
    if (this.config.respectDoNotTrack && Utils.isDoNotTrackEnabled()) {
      this.isOptedOut = true;
    }

    // Check localhost exclusion
    if (this.config.excludeLocalhost && Utils.isLocalhost()) {
      this.isOptedOut = true;
    }

    // Check consent requirements
    if (this.config.cookieConsentRequired) {
      this.consentRequired = true;
      this.hasConsent = this.checkConsent();
    }

    // Load opt-out preference
    const optOutPreference = Utils.getCookie('rt_opt_out');
    if (optOutPreference === 'true') {
      this.isOptedOut = true;
    }
  }

  isTrackingAllowed(): boolean {
    return !this.isOptedOut && (!this.consentRequired || this.hasConsent);
  }

  optOut(): void {
    this.isOptedOut = true;
    Utils.setCookie('rt_opt_out', 'true', 365 * 2); // 2 years
  }

  optIn(): void {
    this.isOptedOut = false;
    Utils.deleteCookie('rt_opt_out');
  }

  grantConsent(): void {
    this.hasConsent = true;
    Utils.setCookie('rt_consent', 'true', 365);
  }

  revokeConsent(): void {
    this.hasConsent = false;
    Utils.deleteCookie('rt_consent');
  }

  private checkConsent(): boolean {
    return Utils.getCookie('rt_consent') === 'true';
  }

  anonymizeData(data: any): any {
    if (!this.config.anonymizeIp) {
      return data;
    }

    const anonymized = { ...data };

    // Anonymize IP addresses in properties
    if (anonymized.properties && anonymized.properties.ip) {
      anonymized.properties.ip = Utils.anonymizeIp(anonymized.properties.ip);
    }

    // Anonymize user ID if present
    if (anonymized.userId) {
      anonymized.userId = this.hashUserId(anonymized.userId);
    }

    return anonymized;
  }

  private hashUserId(userId: string): string {
    return Utils.hashData(userId);
  }

  shouldMaskInput(inputType: string, elementId?: string, elementClass?: string): boolean {
    if (!this.config.maskSensitiveInputs) {
      return false;
    }

    const sensitiveTypes = [
      'password', 'email', 'tel', 'credit-card', 'ssn',
      'cc-number', 'cc-exp', 'cc-cvc', 'account-number'
    ];

    const sensitiveIdentifiers = [
      'password', 'secret', 'token', 'key', 'auth',
      'credit', 'card', 'ssn', 'social', 'account'
    ];

    // Check input type
    if (sensitiveTypes.includes(inputType.toLowerCase())) {
      return true;
    }

    // Check element ID and class
    const checkString = (str?: string) => {
      if (!str) return false;
      const lowerStr = str.toLowerCase();
      return sensitiveIdentifiers.some(identifier => lowerStr.includes(identifier));
    };

    if (checkString(elementId) || checkString(elementClass)) {
      return true;
    }

    return false;
  }

  maskValue(value: string, inputType: string, elementId?: string, elementClass?: string): string {
    if (!this.shouldMaskInput(inputType, elementId, elementClass)) {
      return value;
    }

    return '*'.repeat(Math.min(value.length, 8));
  }

  filterProperties(properties: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = {};

    const sensitiveKeys = [
      'password', 'secret', 'token', 'key', 'auth',
      'credit', 'card', 'ssn', 'social', 'account',
      'email', 'phone', 'address', 'name'
    ];

    Object.keys(properties).forEach(key => {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

      if (isSensitive) {
        filtered[key] = this.maskValue(String(properties[key]), key, key, key);
      } else {
        filtered[key] = properties[key];
      }
    });

    return filtered;
  }

  getDataRetentionTimestamp(): number {
    const now = Utils.getCurrentTimestamp();
    const retentionMs = this.config.dataRetentionDays * 24 * 60 * 60 * 1000;
    return now - retentionMs;
  }

  shouldExcludeUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Exclude localhost if configured
      if (this.config.excludeLocalhost && 
          (parsedUrl.hostname === 'localhost' || 
           parsedUrl.hostname === '127.0.0.1' ||
           parsedUrl.hostname === '')) {
        return true;
      }

      // Exclude common development URLs
      const devPatterns = [
        /localhost:\d+/,
        /127\.0\.0\.1:\d+/,
        /\.dev$/,
        /\.local$/,
        /\.test$/
      ];

      if (devPatterns.some(pattern => pattern.test(parsedUrl.hostname))) {
        return true;
      }

      return false;
    } catch {
      return true; // Exclude invalid URLs
    }
  }

  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializePrivacy();
  }

  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  getPrivacyStatus(): {
    isOptedOut: boolean;
    hasConsent: boolean;
    consentRequired: boolean;
    trackingAllowed: boolean;
  } {
    return {
      isOptedOut: this.isOptedOut,
      hasConsent: this.hasConsent,
      consentRequired: this.consentRequired,
      trackingAllowed: this.isTrackingAllowed()
    };
  }

  // GDPR compliance methods
  exportUserData(): Promise<any> {
    return new Promise((resolve) => {
      // Collect all user-related data from storage
      const userData = {
        userIdentity: Utils.getLocalStorage('rt_user_identity'),
        sessionId: Utils.getSessionStorage('rt_session_id'),
        sessionData: Utils.getSessionStorage('rt_session_data'),
        consent: Utils.getCookie('rt_consent'),
        optOut: Utils.getCookie('rt_opt_out'),
        anonymousId: Utils.getCookie('rt_anonymous_id')
      };

      resolve(userData);
    });
  }

  deleteUserData(): Promise<void> {
    return new Promise((resolve) => {
      // Clear all user-related data
      Utils.removeLocalStorage('rt_user_identity');
      Utils.removeSessionStorage('rt_session_id');
      Utils.removeSessionStorage('rt_session_data');
      Utils.deleteCookie('rt_consent');
      Utils.deleteCookie('rt_opt_out');
      Utils.deleteCookie('rt_anonymous_id');
      Utils.removeLocalStorage('rt_offline_queue');

      resolve();
    });
  }

  // Cookie consent management
  showConsentBanner(): void {
    if (!this.consentRequired || this.hasConsent) {
      return;
    }

    // Create consent banner HTML
    const banner = document.createElement('div');
    banner.id = 'rt-consent-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #333;
      color: white;
      padding: 16px;
      z-index: 999999;
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;

    banner.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <p style="margin: 0 0 12px 0;">
          This website uses analytics to improve your experience. By continuing to use this site, you agree to our use of analytics cookies.
        </p>
        <div style="margin-top: 12px;">
          <button id="rt-consent-accept" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-right: 8px;
            cursor: pointer;
            border-radius: 4px;
          ">Accept</button>
          <button id="rt-consent-decline" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-right: 8px;
            cursor: pointer;
            border-radius: 4px;
          ">Decline</button>
          <button id="rt-consent-learn" style="
            background: transparent;
            color: white;
            border: 1px solid white;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
          ">Learn More</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Add event listeners
    const acceptBtn = document.getElementById('rt-consent-accept');
    const declineBtn = document.getElementById('rt-consent-decline');
    const learnBtn = document.getElementById('rt-consent-learn');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        this.grantConsent();
        this.hideConsentBanner();
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', () => {
        this.revokeConsent();
        this.hideConsentBanner();
      });
    }

    if (learnBtn) {
      learnBtn.addEventListener('click', () => {
        // Open privacy policy or learn more page
        window.open('/privacy-policy', '_blank');
      });
    }
  }

  hideConsentBanner(): void {
    const banner = document.getElementById('rt-consent-banner');
    if (banner) {
      banner.remove();
    }
  }

  // Check if consent banner should be shown
  shouldShowConsentBanner(): boolean {
    return this.consentRequired && !this.hasConsent && !this.isOptedOut;
  }
}