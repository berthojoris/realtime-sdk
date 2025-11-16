import { SessionData, UserIdentity } from '../types';
import { Utils } from '../utils';

export class SessionManager {
  private static instance: SessionManager;
  private sessionData: SessionData | null = null;
  private userIdentity: UserIdentity | null = null;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private activityTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  initialize(userId?: string): SessionData {
    const now = Utils.getCurrentTimestamp();
    const browserInfo = Utils.getBrowserInfo();
    const pageInfo = Utils.getPageInfo();

    // Check if we have an existing session
    const existingSessionId = Utils.getSessionStorage('rt_session_id');
    const existingSessionData = Utils.getSessionStorage('rt_session_data');

    if (existingSessionId && existingSessionData) {
      try {
        const parsedSession = JSON.parse(existingSessionData) as SessionData;
        const sessionAge = now - parsedSession.lastActivity;
        
        // If session is still valid (within timeout), reuse it
        if (sessionAge < this.sessionTimeout) {
          this.sessionData = {
            ...parsedSession,
            lastActivity: now,
            isActive: true
          };
          this.updateActivityTimer();
          this.saveSession();
          return this.sessionData;
        }
      } catch {
        // Invalid session data, create new one
      }
    }

    // Create new session
    const sessionId = Utils.generateId();
    this.sessionData = {
      sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      pageViews: 1,
      eventsCount: 0,
      duration: 0,
      isActive: true,
      referrer: pageInfo.referrer,
      landingPage: pageInfo.url,
      userAgent: browserInfo.userAgent,
      timezone: browserInfo.timezone,
      language: browserInfo.language,
      screenResolution: browserInfo.screenResolution,
      viewportSize: browserInfo.viewportSize
    };

    this.saveSession();
    this.updateActivityTimer();
    return this.sessionData;
  }

  getSession(): SessionData | null {
    return this.sessionData;
  }

  updateSession(): void {
    if (!this.sessionData) return;

    const now = Utils.getCurrentTimestamp();
    this.sessionData.lastActivity = now;
    this.sessionData.duration = now - this.sessionData.startTime;
    this.sessionData.isActive = true;

    this.updateActivityTimer();
    this.saveSession();
  }

  incrementPageViews(): void {
    if (!this.sessionData) return;
    
    this.sessionData.pageViews++;
    this.updateSession();
  }

  incrementEventsCount(): void {
    if (!this.sessionData) return;
    
    this.sessionData.eventsCount++;
    this.updateSession();
  }

  setExitPage(): void {
    if (!this.sessionData) return;
    
    const pageInfo = Utils.getPageInfo();
    this.sessionData.exitPage = pageInfo.url;
    this.sessionData.isActive = false;
    this.saveSession();
  }

  getUserIdentity(): UserIdentity | null {
    return this.userIdentity;
  }

  setUserIdentity(userId: string, traits?: Record<string, any>): void {
    const now = Utils.getCurrentTimestamp();
    const anonymousId = this.getOrCreateAnonymousId();

    // Check if we have existing user data
    const existingUserData = Utils.getLocalStorage('rt_user_identity');
    let sessionCount = 1;
    let totalEvents = 0;

    if (existingUserData) {
      try {
        const parsedUser = JSON.parse(existingUserData) as UserIdentity;
        if (parsedUser.userId === userId) {
          sessionCount = parsedUser.sessionCount + 1;
          totalEvents = parsedUser.totalEvents;
        }
      } catch {
        // Invalid user data, use defaults
      }
    }

    this.userIdentity = {
      userId,
      anonymousId,
      traits,
      firstSeen: now,
      lastSeen: now,
      sessionCount,
      totalEvents
    };

    // Update session with user ID
    if (this.sessionData) {
      this.sessionData.userId = userId;
      this.saveSession();
    }

    this.saveUserIdentity();
  }

  private getOrCreateAnonymousId(): string {
    let anonymousId = Utils.getCookie('rt_anonymous_id');
    
    if (!anonymousId) {
      anonymousId = Utils.generateId();
      Utils.setCookie('rt_anonymous_id', anonymousId, 365 * 2); // 2 years
    }
    
    return anonymousId;
  }

  private updateActivityTimer(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    this.activityTimer = setTimeout(() => {
      this.endSession();
    }, this.sessionTimeout);
  }

  private endSession(): void {
    if (!this.sessionData) return;

    this.sessionData.isActive = false;
    this.sessionData.duration = Utils.getCurrentTimestamp() - this.sessionData.startTime;
    this.saveSession();

    // Clear activity timer
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
  }

  private saveSession(): void {
    if (!this.sessionData) return;
    
    Utils.setSessionStorage('rt_session_id', this.sessionData.sessionId);
    Utils.setSessionStorage('rt_session_data', JSON.stringify(this.sessionData));
  }

  private saveUserIdentity(): void {
    if (!this.userIdentity) return;
    
    Utils.setLocalStorage('rt_user_identity', JSON.stringify(this.userIdentity));
  }

  clearSession(): void {
    this.sessionData = null;
    Utils.removeSessionStorage('rt_session_id');
    Utils.removeSessionStorage('rt_session_data');
    
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
  }

  clearUserIdentity(): void {
    this.userIdentity = null;
    Utils.removeLocalStorage('rt_user_identity');
    Utils.deleteCookie('rt_anonymous_id');
  }

  // Public method to manually end session
  endCurrentSession(): void {
    this.endSession();
  }

  // Get session duration in seconds
  getSessionDuration(): number {
    if (!this.sessionData) return 0;
    
    const endTime = this.sessionData.isActive ? 
      Utils.getCurrentTimestamp() : 
      this.sessionData.startTime + this.sessionData.duration;
    
    return Math.floor((endTime - this.sessionData.startTime) / 1000);
  }

  // Check if session is expired
  isSessionExpired(): boolean {
    if (!this.sessionData) return true;
    
    const now = Utils.getCurrentTimestamp();
    const timeSinceLastActivity = now - this.sessionData.lastActivity;
    
    return timeSinceLastActivity >= this.sessionTimeout;
  }

  // Refresh session if expired
  refreshSessionIfNeeded(): SessionData | null {
    if (this.isSessionExpired()) {
      this.clearSession();
      return this.initialize(this.userIdentity?.userId);
    }
    
    return this.sessionData;
  }

  // Export session data for analytics
  exportSessionData(): Partial<SessionData> {
    if (!this.sessionData) return {};
    
    return {
      sessionId: this.sessionData.sessionId,
      userId: this.sessionData.userId,
      startTime: this.sessionData.startTime,
      duration: this.sessionData.duration,
      pageViews: this.sessionData.pageViews,
      eventsCount: this.sessionData.eventsCount,
      referrer: this.sessionData.referrer,
      landingPage: this.sessionData.landingPage,
      exitPage: this.sessionData.exitPage,
      userAgent: this.sessionData.userAgent,
      timezone: this.sessionData.timezone,
      language: this.sessionData.language,
      screenResolution: this.sessionData.screenResolution,
      viewportSize: this.sessionData.viewportSize
    };
  }
}