/**
 * Rate Limiter & Auto-Response Module
 * 
 * Implements intelligent rate limiting with different tiers based on user behavior
 * and automated response actions for common attack patterns.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export interface UserActivity {
  requestCount: number;
  firstRequest: number;
  lastRequest: number;
  attackCount: number;
  blockCount: number;
  riskScoreSum: number;
  blocked: boolean;
  blockedUntil: number;
}

export class RateLimiter {
  private userActivity: Map<string, UserActivity> = new Map();
  private ipActivity: Map<string, UserActivity> = new Map();
  
  // Rate limit tiers
  private readonly NORMAL_LIMIT: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 30,
    blockDurationMs: 60000, // 1 minute
  };
  
  private readonly SUSPICIOUS_LIMIT: RateLimitConfig = {
    windowMs: 60000,
    maxRequests: 10,
    blockDurationMs: 300000, // 5 minutes
  };
  
  private readonly MALICIOUS_LIMIT: RateLimitConfig = {
    windowMs: 60000,
    maxRequests: 3,
    blockDurationMs: 600000, // 10 minutes (more reasonable for demo)
  };
  
  /**
   * Check if request should be rate limited
   */
  checkRateLimit(userId: string, ip: string, riskScore: number): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    tier: 'normal' | 'suspicious' | 'malicious';
  } {
    const now = Date.now();
    
    // Check if user is currently blocked
    const userBlocked = this.isBlocked(userId, this.userActivity, now);
    if (userBlocked.blocked) {
      return {
        allowed: false,
        reason: 'User temporarily blocked due to suspicious activity',
        retryAfter: userBlocked.retryAfter,
        tier: 'malicious',
      };
    }
    
    // Check if IP is currently blocked
    const ipBlocked = this.isBlocked(ip, this.ipActivity, now);
    if (ipBlocked.blocked) {
      return {
        allowed: false,
        reason: 'IP temporarily blocked due to suspicious activity',
        retryAfter: ipBlocked.retryAfter,
        tier: 'malicious',
      };
    }
    
    // Determine rate limit tier based on behavior
    const userBehavior = this.getUserBehavior(userId);
    const tier = this.determineTier(userBehavior, riskScore);
    const limit = this.getLimitForTier(tier);
    
    // Get or create activity record
    const activity = this.getOrCreateActivity(userId, this.userActivity, now);
    
    // Clean old requests outside window
    if (now - activity.firstRequest > limit.windowMs) {
      // Reset window
      activity.requestCount = 0;
      activity.firstRequest = now;
      activity.riskScoreSum = 0;
    }
    
    // Check if limit exceeded
    if (activity.requestCount >= limit.maxRequests) {
      // Block user
      activity.blocked = true;
      activity.blockedUntil = now + limit.blockDurationMs;
      
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${limit.maxRequests} requests per ${limit.windowMs / 1000}s (${tier} tier)`,
        retryAfter: Math.ceil(limit.blockDurationMs / 1000),
        tier,
      };
    }
    
    // Update activity
    activity.requestCount++;
    activity.lastRequest = now;
    activity.riskScoreSum += riskScore;
    
    return {
      allowed: true,
      tier,
    };
  }
  
  /**
   * Record an attack for a user/IP
   */
  recordAttack(userId: string, ip: string, blocked: boolean): void {
    const now = Date.now();
    
    const userActivity = this.getOrCreateActivity(userId, this.userActivity, now);
    userActivity.attackCount++;
    if (blocked) userActivity.blockCount++;
    
    const ipActivity = this.getOrCreateActivity(ip, this.ipActivity, now);
    ipActivity.attackCount++;
    if (blocked) ipActivity.blockCount++;
    
    // Auto-block if too many attacks
    if (userActivity.attackCount >= 5 && userActivity.blockCount >= 3) {
      userActivity.blocked = true;
      userActivity.blockedUntil = now + this.MALICIOUS_LIMIT.blockDurationMs;
    }
    
    if (ipActivity.attackCount >= 10) {
      ipActivity.blocked = true;
      ipActivity.blockedUntil = now + this.MALICIOUS_LIMIT.blockDurationMs;
    }
  }
  
  /**
   * Get user behavior metrics
   */
  private getUserBehavior(userId: string): {
    avgRiskScore: number;
    attackRate: number;
    blockRate: number;
  } {
    const activity = this.userActivity.get(userId);
    
    if (!activity || activity.requestCount === 0) {
      return { avgRiskScore: 0, attackRate: 0, blockRate: 0 };
    }
    
    return {
      avgRiskScore: activity.riskScoreSum / activity.requestCount,
      attackRate: activity.attackCount / activity.requestCount,
      blockRate: activity.blockCount / activity.requestCount,
    };
  }
  
  /**
   * Determine rate limit tier based on user behavior
   */
  private determineTier(
    behavior: { avgRiskScore: number; attackRate: number; blockRate: number },
    currentRiskScore: number
  ): 'normal' | 'suspicious' | 'malicious' {
    // Malicious: High attack rate or high block rate
    if (behavior.attackRate > 0.5 || behavior.blockRate > 0.3) {
      return 'malicious';
    }
    
    // Suspicious: Medium-high average risk or current high risk
    if (behavior.avgRiskScore > 40 || currentRiskScore > 60) {
      return 'suspicious';
    }
    
    // Normal: Low risk behavior
    return 'normal';
  }
  
  /**
   * Get rate limit config for tier
   */
  private getLimitForTier(tier: 'normal' | 'suspicious' | 'malicious'): RateLimitConfig {
    switch (tier) {
      case 'malicious':
        return this.MALICIOUS_LIMIT;
      case 'suspicious':
        return this.SUSPICIOUS_LIMIT;
      default:
        return this.NORMAL_LIMIT;
    }
  }
  
  /**
   * Check if user/IP is blocked
   */
  private isBlocked(
    key: string,
    activityMap: Map<string, UserActivity>,
    now: number
  ): { blocked: boolean; retryAfter?: number } {
    const activity = activityMap.get(key);
    
    if (!activity || !activity.blocked) {
      return { blocked: false };
    }
    
    // Check if block has expired
    if (now >= activity.blockedUntil) {
      activity.blocked = false;
      return { blocked: false };
    }
    
    return {
      blocked: true,
      retryAfter: Math.ceil((activity.blockedUntil - now) / 1000),
    };
  }
  
  /**
   * Get or create activity record
   */
  private getOrCreateActivity(
    key: string,
    activityMap: Map<string, UserActivity>,
    now: number
  ): UserActivity {
    let activity = activityMap.get(key);
    
    if (!activity) {
      activity = {
        requestCount: 0,
        firstRequest: now,
        lastRequest: now,
        attackCount: 0,
        blockCount: 0,
        riskScoreSum: 0,
        blocked: false,
        blockedUntil: 0,
      };
      activityMap.set(key, activity);
    }
    
    return activity;
  }
  
  /**
   * Get stats for monitoring
   */
  getStats(): {
    totalUsers: number;
    blockedUsers: number;
    blockedIPs: number;
    avgRequestsPerUser: number;
  } {
    let blockedUsers = 0;
    let totalRequests = 0;
    
    for (const activity of this.userActivity.values()) {
      if (activity.blocked) blockedUsers++;
      totalRequests += activity.requestCount;
    }
    
    let blockedIPs = 0;
    for (const activity of this.ipActivity.values()) {
      if (activity.blocked) blockedIPs++;
    }
    
    return {
      totalUsers: this.userActivity.size,
      blockedUsers,
      blockedIPs,
      avgRequestsPerUser: this.userActivity.size > 0 
        ? totalRequests / this.userActivity.size 
        : 0,
    };
  }
  
  /**
   * Cleanup old activity records (run periodically)
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    
    // Cleanup user activity
    for (const [key, activity] of this.userActivity.entries()) {
      if (now - activity.lastRequest > maxAgeMs && !activity.blocked) {
        this.userActivity.delete(key);
      }
    }
    
    // Cleanup IP activity
    for (const [key, activity] of this.ipActivity.entries()) {
      if (now - activity.lastRequest > maxAgeMs && !activity.blocked) {
        this.ipActivity.delete(key);
      }
    }
  }

  /**
   * Get list of blocked users and IPs
   */
  getBlockedList(): {
    blockedUsers: Array<{ userId: string; blockedUntil: number; attackCount: number }>;
    blockedIPs: Array<{ ip: string; blockedUntil: number; attackCount: number }>;
  } {
    const now = Date.now();
    const blockedUsers: Array<{ userId: string; blockedUntil: number; attackCount: number }> = [];
    const blockedIPs: Array<{ ip: string; blockedUntil: number; attackCount: number }> = [];

    for (const [userId, activity] of this.userActivity.entries()) {
      if (activity.blocked && activity.blockedUntil > now) {
        blockedUsers.push({
          userId,
          blockedUntil: activity.blockedUntil,
          attackCount: activity.attackCount,
        });
      }
    }

    for (const [ip, activity] of this.ipActivity.entries()) {
      if (activity.blocked && activity.blockedUntil > now) {
        blockedIPs.push({
          ip,
          blockedUntil: activity.blockedUntil,
          attackCount: activity.attackCount,
        });
      }
    }

    return { blockedUsers, blockedIPs };
  }

  /**
   * Manually unblock a user
   */
  unblockUser(userId: string): void {
    const activity = this.userActivity.get(userId);
    if (activity) {
      activity.blocked = false;
      activity.blockedUntil = 0;
    }
  }

  /**
   * Manually unblock an IP
   */
  unblockIP(ip: string): void {
    const activity = this.ipActivity.get(ip);
    if (activity) {
      activity.blocked = false;
      activity.blockedUntil = 0;
    }
  }

  /**
   * Manually block a user
   */
  blockUser(userId: string, durationMs: number): void {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, this.userActivity, now);
    activity.blocked = true;
    activity.blockedUntil = now + durationMs;
    activity.blockCount++;
  }

  /**
   * Manually block an IP
   */
  blockIP(ip: string, durationMs: number): void {
    const now = Date.now();
    const activity = this.getOrCreateActivity(ip, this.ipActivity, now);
    activity.blocked = true;
    activity.blockedUntil = now + durationMs;
    activity.blockCount++;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Auto cleanup every 10 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 600000);
