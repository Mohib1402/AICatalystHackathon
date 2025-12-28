/**
 * Cost Attack Detection Module
 * 
 * Detects attacks aimed at exhausting resources and inflating costs:
 * - Token exhaustion (extremely long requests)
 * - Infinite loop attempts (repeated similar prompts)
 * - Context window attacks (overly long prompts)
 */

interface RequestRecord {
  prompt: string;
  timestamp: number;
  tokens: number;
  userId?: string;
}

interface CostAnalysis {
  isCostAttack: boolean;
  attackType?: 'token_exhaustion' | 'infinite_loop' | 'context_window';
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  reasoning: string[];
  shouldBlock: boolean;
}

class CostDetector {
  private requestHistory: Map<string, RequestRecord[]> = new Map();
  private readonly TOKEN_THRESHOLD = 10000; // Max tokens per request
  private readonly CONTEXT_WINDOW_THRESHOLD = 8000; // Suspiciously long prompts
  private readonly REPETITION_THRESHOLD = 5; // Max similar requests
  private readonly REPETITION_WINDOW = 60000; // 1 minute in ms
  private readonly SIMILARITY_THRESHOLD = 0.8; // 80% similarity
  
  /**
   * Analyze a request for cost-based attacks
   */
  analyzeCostRisk(
    prompt: string,
    estimatedTokens: number,
    userId: string = 'anonymous'
  ): CostAnalysis {
    const reasoning: string[] = [];
    let riskScore = 0;
    let attackType: CostAnalysis['attackType'];
    let severity: CostAnalysis['severity'] = 'low';

    // 1. Token Exhaustion Detection (40 points)
    if (estimatedTokens > this.TOKEN_THRESHOLD) {
      riskScore += 40;
      severity = 'critical';
      attackType = 'token_exhaustion';
      reasoning.push(
        `Extremely high token count: ${estimatedTokens} tokens (threshold: ${this.TOKEN_THRESHOLD})`
      );
      reasoning.push('Potential token exhaustion attack detected');
    } else if (estimatedTokens > this.CONTEXT_WINDOW_THRESHOLD) {
      riskScore += 25;
      severity = 'high';
      attackType = 'context_window';
      reasoning.push(
        `Unusually long prompt: ${estimatedTokens} tokens (threshold: ${this.CONTEXT_WINDOW_THRESHOLD})`
      );
      reasoning.push('Possible context window attack');
    }

    // 2. Infinite Loop Detection (35 points)
    const loopDetection = this.detectInfiniteLoop(prompt, userId);
    if (loopDetection.isLoop) {
      riskScore += 35;
      severity = loopDetection.count >= this.REPETITION_THRESHOLD ? 'critical' : 'high';
      attackType = 'infinite_loop';
      reasoning.push(
        `Repeated similar prompts detected: ${loopDetection.count} times in ${this.REPETITION_WINDOW / 1000}s`
      );
      reasoning.push(`Similarity: ${Math.round(loopDetection.maxSimilarity * 100)}%`);
    }

    // 3. Rapid Fire Requests (25 points)
    const rapidFire = this.detectRapidFire(userId);
    if (rapidFire.isRapidFire) {
      riskScore += 25;
      if (severity === 'low') severity = 'medium';
      reasoning.push(
        `Rapid fire detected: ${rapidFire.count} requests in last ${rapidFire.window / 1000}s`
      );
    }

    // Record this request for future analysis
    this.recordRequest(prompt, estimatedTokens, userId);

    // Determine if we should block
    const shouldBlock = riskScore >= 60 || severity === 'critical';

    if (reasoning.length === 0) {
      reasoning.push('No cost-based attack patterns detected');
    }

    return {
      isCostAttack: riskScore > 0,
      attackType,
      severity,
      riskScore: Math.min(100, riskScore),
      reasoning,
      shouldBlock,
    };
  }

  /**
   * Detect if user is sending repeated similar prompts (infinite loop attempt)
   */
  private detectInfiniteLoop(
    prompt: string,
    userId: string
  ): { isLoop: boolean; count: number; maxSimilarity: number } {
    const userHistory = this.requestHistory.get(userId) || [];
    const now = Date.now();
    
    // Filter to recent requests within time window
    const recentRequests = userHistory.filter(
      record => now - record.timestamp < this.REPETITION_WINDOW
    );

    if (recentRequests.length < 2) {
      return { isLoop: false, count: 0, maxSimilarity: 0 };
    }

    // Check similarity with recent prompts
    let similarCount = 0;
    let maxSimilarity = 0;

    for (const record of recentRequests) {
      const similarity = this.calculateSimilarity(prompt, record.prompt);
      maxSimilarity = Math.max(maxSimilarity, similarity);
      
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        similarCount++;
      }
    }

    return {
      isLoop: similarCount >= 3, // 3+ similar prompts = loop
      count: similarCount,
      maxSimilarity,
    };
  }

  /**
   * Detect rapid fire requests (potential DDoS or cost attack)
   */
  private detectRapidFire(
    userId: string
  ): { isRapidFire: boolean; count: number; window: number } {
    const userHistory = this.requestHistory.get(userId) || [];
    const now = Date.now();
    const window = 10000; // 10 seconds
    
    const recentCount = userHistory.filter(
      record => now - record.timestamp < window
    ).length;

    return {
      isRapidFire: recentCount >= 10, // 10+ requests in 10 seconds
      count: recentCount,
      window,
    };
  }

  /**
   * Calculate similarity between two strings (simple approach)
   * Returns 0.0 to 1.0
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings
    const norm1 = str1.toLowerCase().trim();
    const norm2 = str2.toLowerCase().trim();

    // Exact match
    if (norm1 === norm2) return 1.0;

    // Levenshtein distance approach (simplified)
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;

    if (longer.length === 0) return 1.0;

    // Count matching characters
    let matches = 0;
    const shorterChars = shorter.split('');
    const longerChars = longer.split('');

    for (let i = 0; i < shorterChars.length; i++) {
      if (longerChars[i] === shorterChars[i]) {
        matches++;
      }
    }

    // Simple similarity score
    return matches / longer.length;
  }

  /**
   * Record a request for historical tracking
   */
  private recordRequest(prompt: string, tokens: number, userId: string): void {
    const record: RequestRecord = {
      prompt,
      timestamp: Date.now(),
      tokens,
      userId,
    };

    const userHistory = this.requestHistory.get(userId) || [];
    userHistory.push(record);

    // Keep only last 100 requests per user
    if (userHistory.length > 100) {
      userHistory.shift();
    }

    this.requestHistory.set(userId, userHistory);

    // Clean up old records periodically
    this.cleanupOldRecords();
  }

  /**
   * Clean up records older than 1 hour
   */
  private cleanupOldRecords(): void {
    const oneHourAgo = Date.now() - 3600000;

    for (const [userId, records] of this.requestHistory.entries()) {
      const filtered = records.filter(r => r.timestamp > oneHourAgo);
      
      if (filtered.length === 0) {
        this.requestHistory.delete(userId);
      } else {
        this.requestHistory.set(userId, filtered);
      }
    }
  }

  /**
   * Get request statistics for a user
   */
  getUserStats(userId: string): {
    totalRequests: number;
    totalTokens: number;
    avgTokensPerRequest: number;
    requestsLast10Min: number;
  } {
    const userHistory = this.requestHistory.get(userId) || [];
    const now = Date.now();
    const tenMinutesAgo = now - 600000;

    const recentRequests = userHistory.filter(r => r.timestamp > tenMinutesAgo);
    const totalTokens = userHistory.reduce((sum, r) => sum + r.tokens, 0);

    return {
      totalRequests: userHistory.length,
      totalTokens,
      avgTokensPerRequest: userHistory.length > 0 ? totalTokens / userHistory.length : 0,
      requestsLast10Min: recentRequests.length,
    };
  }

  /**
   * Block a user temporarily (for demo purposes, in production use Redis/DB)
   */
  private blockedUsers: Set<string> = new Set();

  blockUser(userId: string, durationMs: number = 300000): void {
    this.blockedUsers.add(userId);
    setTimeout(() => this.blockedUsers.delete(userId), durationMs);
  }

  isUserBlocked(userId: string): boolean {
    return this.blockedUsers.has(userId);
  }

  /**
   * Reset detector state (for testing)
   */
  reset(): void {
    this.requestHistory.clear();
    this.blockedUsers.clear();
  }
}

// Export singleton instance
export const costDetector = new CostDetector();
export type { CostAnalysis };
