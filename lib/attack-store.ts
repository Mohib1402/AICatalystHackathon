interface AttackRecord {
  id: string;
  timestamp: string;
  userId: string;
  ip: string;
  prompt: string;
  riskScore: number;
  riskLevel: string;
  blocked: boolean;
  detectedPatterns: number;
  attackCategories: string[];
  reasoning: string[];
  aiAnalysis?: {
    summary: string;
    attackType: string;
    severity: string;
    mitigationSteps: string[];
  };
  vertexAI?: {
    sentimentScore: number;
    sentimentMagnitude: number;
    entitiesDetected: number;
  };
  costAttack?: {
    attackType: string;
    severity: string;
    estimatedTokens: number;
  };
}

interface SecurityStats {
  totalAttacks: number;
  attacksBlocked: number;
  attacksToday: number;
  attacksThisWeek: number;
  attacksThisMonth: number;
  blockRate: number;
  avgRiskScore: number;
  attacksByType: Record<string, number>;
  topPatterns: Array<{ pattern: string; count: number }>;
}

class AttackStore {
  private attacks: AttackRecord[] = [];
  private maxStorageSize = 1000;

  recordAttack(attack: Omit<AttackRecord, 'id' | 'timestamp'>): void {
    const record: AttackRecord = {
      id: `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...attack,
    };

    this.attacks.unshift(record);

    if (this.attacks.length > this.maxStorageSize) {
      this.attacks = this.attacks.slice(0, this.maxStorageSize);
    }
  }

  getAttacks(params?: {
    limit?: number;
    offset?: number;
    blocked?: boolean;
    minRiskScore?: number;
    startDate?: string;
    endDate?: string;
  }): { attacks: AttackRecord[]; total: number } {
    let filtered = [...this.attacks];

    if (params?.blocked !== undefined) {
      filtered = filtered.filter(a => a.blocked === params.blocked);
    }

    if (params?.minRiskScore !== undefined) {
      filtered = filtered.filter(a => a.riskScore >= params.minRiskScore!);
    }

    if (params?.startDate) {
      filtered = filtered.filter(a => a.timestamp >= params.startDate!);
    }

    if (params?.endDate) {
      filtered = filtered.filter(a => a.timestamp <= params.endDate!);
    }

    const total = filtered.length;
    const offset = params?.offset || 0;
    const limit = params?.limit || 20;

    return {
      attacks: filtered.slice(offset, offset + limit),
      total,
    };
  }

  getAttackById(id: string): AttackRecord | null {
    return this.attacks.find(a => a.id === id) || null;
  }

  getStats(): SecurityStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAttacks = this.attacks.length;
    const attacksBlocked = this.attacks.filter(a => a.blocked).length;
    const attacksToday = this.attacks.filter(a => new Date(a.timestamp) >= todayStart).length;
    const attacksThisWeek = this.attacks.filter(a => new Date(a.timestamp) >= weekStart).length;
    const attacksThisMonth = this.attacks.filter(a => new Date(a.timestamp) >= monthStart).length;

    const blockRate = totalAttacks > 0 ? (attacksBlocked / totalAttacks) * 100 : 0;
    
    const totalRiskScore = this.attacks.reduce((sum, a) => sum + a.riskScore, 0);
    const avgRiskScore = totalAttacks > 0 ? totalRiskScore / totalAttacks : 0;

    const attacksByType: Record<string, number> = {};
    this.attacks.forEach(attack => {
      attack.attackCategories.forEach(cat => {
        attacksByType[cat] = (attacksByType[cat] || 0) + 1;
      });
    });

    const patternCounts: Record<string, number> = {};
    this.attacks.forEach(attack => {
      attack.reasoning.forEach(reason => {
        const key = reason.substring(0, 50);
        patternCounts[key] = (patternCounts[key] || 0) + 1;
      });
    });

    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));

    return {
      totalAttacks,
      attacksBlocked,
      attacksToday,
      attacksThisWeek,
      attacksThisMonth,
      blockRate: Math.round(blockRate * 10) / 10,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      attacksByType,
      topPatterns,
    };
  }

  clearOldAttacks(daysToKeep: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const initialLength = this.attacks.length;
    this.attacks = this.attacks.filter(a => new Date(a.timestamp) >= cutoffDate);
    return initialLength - this.attacks.length;
  }
}

export const attackStore = new AttackStore();
export type { AttackRecord, SecurityStats };
