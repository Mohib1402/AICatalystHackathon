import https from 'https';
import tracer from 'dd-trace';

const DD_API_KEY = process.env.DD_API_KEY;
const DD_SITE = process.env.DD_SITE || 'us5.datadoghq.com';
const DD_SERVICE = process.env.DD_SERVICE || 'devshield-ai';
const DD_ENV = process.env.DD_ENV || 'development';

export interface LLMMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latency: number;
  model: string;
  riskScore?: number;
  riskLevel?: string;
  threatType?: string;
  blocked?: boolean;
  detectedPatterns?: number;
  attackCategories?: string[];
  confidence?: number;
  vertexAI?: {
    sentimentScore?: number;
    sentimentMagnitude?: number;
    entitiesDetected?: number;
    riskContribution?: number;
  };
  costAttack?: {
    detected?: boolean;
    attackType?: string;
    severity?: string;
    estimatedTokens?: number;
  };
}

interface DatadogMetric {
  metric: string;
  type: number; // 0=count, 1=rate, 2=gauge
  points: Array<{ timestamp: number; value: number }>;
  tags: string[];
}

function sendMetrics(metrics: DatadogMetric[]) {
  if (!DD_API_KEY) {
    console.warn('DD_API_KEY not set, skipping metrics');
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    series: metrics.map(m => ({
      ...m,
      points: m.points.map(p => ({ timestamp: p.timestamp || now, value: p.value })),
    })),
  };

  const postData = JSON.stringify(payload);
  const options = {
    hostname: `api.${DD_SITE}`,
    port: 443,
    path: '/api/v2/series',
    method: 'POST',
    headers: {
      'DD-API-KEY': DD_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 202) {
      console.error(`Datadog metrics failed: ${res.statusCode}`);
    }
  });

  req.on('error', (error) => {
    console.error('Datadog metrics error:', error.message);
  });

  req.write(postData);
  req.end();
}

function sendLog(message: string, level: string, metadata: Record<string, any> = {}) {
  if (!DD_API_KEY) {
    console.warn('DD_API_KEY not set, skipping log');
    return;
  }

  const logData = {
    ddsource: 'nodejs',
    ddtags: `env:${DD_ENV},service:${DD_SERVICE}`,
    hostname: 'devshield-ai',
    message,
    service: DD_SERVICE,
    status: level,
    ...metadata,
  };

  const postData = JSON.stringify(logData);
  const options = {
    hostname: `http-intake.logs.${DD_SITE}`,
    port: 443,
    path: '/api/v2/logs',
    method: 'POST',
    headers: {
      'DD-API-KEY': DD_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 202) {
      console.error(`Datadog log failed: ${res.statusCode}`);
    }
  });

  req.on('error', (error) => {
    console.error('Datadog log error:', error.message);
  });

  req.write(postData);
  req.end();
}

export function trackLLMCall(metrics: LLMMetrics) {
  const now = Math.floor(Date.now() / 1000);
  const baseTags = [
    `env:${DD_ENV}`,
    `service:${DD_SERVICE}`,
    `model:${metrics.model}`,
  ];

  const metricsToSend: DatadogMetric[] = [
    {
      metric: 'llm.request.latency',
      type: 0,
      points: [{ timestamp: now, value: metrics.latency }],
      tags: baseTags,
    },
    {
      metric: 'llm.requests.total',
      type: 0,
      points: [{ timestamp: now, value: 1 }],
      tags: [...baseTags, `blocked:${metrics.blocked ? 'true' : 'false'}`],
    },
  ];

  if (metrics.totalTokens) {
    metricsToSend.push({
      metric: 'llm.tokens.total',
      type: 0,
      points: [{ timestamp: now, value: metrics.totalTokens }],
      tags: baseTags,
    });
  }

  if (metrics.promptTokens) {
    metricsToSend.push({
      metric: 'llm.tokens.prompt',
      type: 0,
      points: [{ timestamp: now, value: metrics.promptTokens }],
      tags: baseTags,
    });
  }

  if (metrics.completionTokens) {
    metricsToSend.push({
      metric: 'llm.tokens.completion',
      type: 0,
      points: [{ timestamp: now, value: metrics.completionTokens }],
      tags: baseTags,
    });
  }

  if (metrics.riskScore !== undefined) {
    const securityTags = [
      ...baseTags,
      `risk_level:${metrics.riskLevel || 'unknown'}`,
      ...(metrics.attackCategories || []).map(cat => `category:${cat}`),
    ];

    metricsToSend.push({
      metric: 'security.risk_score.distribution',
      type: 2,
      points: [{ timestamp: now, value: metrics.riskScore }],
      tags: securityTags,
    });

    metricsToSend.push({
      metric: 'security.prompt.analyzed.total',
      type: 0,
      points: [{ timestamp: now, value: 1 }],
      tags: securityTags,
    });

    if (metrics.riskScore >= 76) {
      metricsToSend.push({
        metric: 'security.attack.detected.total',
        type: 0,
        points: [{ timestamp: now, value: 1 }],
        tags: securityTags,
      });
    }

    if (metrics.detectedPatterns) {
      metricsToSend.push({
        metric: 'security.patterns.detected',
        type: 2,
        points: [{ timestamp: now, value: metrics.detectedPatterns }],
        tags: securityTags,
      });
    }

    if (metrics.attackCategories && metrics.attackCategories.length > 0) {
      metrics.attackCategories.forEach(category => {
        metricsToSend.push({
          metric: 'security.attack_type.count',
          type: 0,
          points: [{ timestamp: now, value: 1 }],
          tags: [...baseTags, `attack_category:${category}`],
        });
      });
    }

    if (metrics.confidence !== undefined) {
      metricsToSend.push({
        metric: 'security.confidence',
        type: 2,
        points: [{ timestamp: now, value: metrics.confidence * 100 }],
        tags: securityTags,
      });
    }
  }

  if (metrics.blocked) {
    metricsToSend.push({
      metric: 'security.attack.blocked.total',
      type: 0,
      points: [{ timestamp: now, value: 1 }],
      tags: [
        ...baseTags,
        `risk_level:${metrics.riskLevel || 'critical'}`,
        ...(metrics.attackCategories || []).map(cat => `category:${cat}`),
      ],
    });
  }

  // Vertex AI metrics
  if (metrics.vertexAI) {
    const vertexTags = [...baseTags, 'source:vertex_ai'];
    
    if (metrics.vertexAI.sentimentScore !== undefined) {
      metricsToSend.push({
        metric: 'vertex_ai.sentiment.score',
        type: 2,
        points: [{ timestamp: now, value: metrics.vertexAI.sentimentScore }],
        tags: vertexTags,
      });
    }
    
    if (metrics.vertexAI.sentimentMagnitude !== undefined) {
      metricsToSend.push({
        metric: 'vertex_ai.sentiment.magnitude',
        type: 2,
        points: [{ timestamp: now, value: metrics.vertexAI.sentimentMagnitude }],
        tags: vertexTags,
      });
    }
    
    if (metrics.vertexAI.entitiesDetected !== undefined) {
      metricsToSend.push({
        metric: 'vertex_ai.entities.detected',
        type: 0,
        points: [{ timestamp: now, value: metrics.vertexAI.entitiesDetected }],
        tags: vertexTags,
      });
    }
    
    if (metrics.vertexAI.riskContribution !== undefined) {
      metricsToSend.push({
        metric: 'vertex_ai.risk.contribution',
        type: 2,
        points: [{ timestamp: now, value: metrics.vertexAI.riskContribution }],
        tags: vertexTags,
      });
    }
  }

  // Cost attack metrics
  if (metrics.costAttack) {
    const costTags = [...baseTags, 'source:cost_detector'];
    
    if (metrics.costAttack.detected) {
      metricsToSend.push({
        metric: 'cost.attack.detected',
        type: 0,
        points: [{ timestamp: now, value: 1 }],
        tags: [
          ...costTags,
          `attack_type:${metrics.costAttack.attackType || 'unknown'}`,
          `severity:${metrics.costAttack.severity || 'unknown'}`,
        ],
      });
    }
    
    if (metrics.costAttack.estimatedTokens !== undefined) {
      metricsToSend.push({
        metric: 'cost.tokens.estimated',
        type: 0,
        points: [{ timestamp: now, value: metrics.costAttack.estimatedTokens }],
        tags: costTags,
      });
    }
  }

  sendMetrics(metricsToSend);

  // Also send structured log
  sendLog('LLM request processed', 'info', {
    llm: {
      model: metrics.model,
      latency: metrics.latency,
      tokens: metrics.totalTokens,
      risk_score: metrics.riskScore,
      blocked: metrics.blocked,
      threat_type: metrics.threatType,
    },
  });
}

export async function createSpan<T>(operationName: string, callback: (span: any) => Promise<T>): Promise<T> {
  return tracer.trace(operationName, async (span) => {
    span.setTag('service.name', DD_SERVICE);
    span.setTag('env', DD_ENV);
    
    try {
      const result = await callback(span);
      return result;
    } catch (error) {
      span.setTag('error', true);
      span.setTag('error.type', error instanceof Error ? error.constructor.name : 'Error');
      span.setTag('error.message', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        span.setTag('error.stack', error.stack);
      }
      throw error;
    }
  });
}

export function addSecurityTagsToSpan(span: any, assessment: {
  riskScore: number;
  riskLevel: string;
  categories: Set<string>;
  shouldBlock: boolean;
  detectedPatterns: any[];
  confidence: number;
}) {
  span.setTag('security.risk_score', assessment.riskScore);
  span.setTag('security.risk_level', assessment.riskLevel);
  span.setTag('security.blocked', assessment.shouldBlock);
  span.setTag('security.patterns_detected', assessment.detectedPatterns.length);
  span.setTag('security.confidence', Math.round(assessment.confidence * 100));
  
  if (assessment.categories.size > 0) {
    span.setTag('security.categories', Array.from(assessment.categories).join(','));
  }
  
  if (assessment.detectedPatterns.length > 0) {
    const patternIds = assessment.detectedPatterns.map(p => p.pattern.id).join(',');
    span.setTag('security.pattern_ids', patternIds);
  }
}

/**
 * Track rate limiting metrics
 */
export function trackRateLimitMetrics(
  tier: 'normal' | 'suspicious' | 'malicious',
  blocked: boolean
): void {
  const metrics = [
    {
      metric: 'ratelimit.checks.total',
      type: 0,
      points: [{ timestamp: Math.floor(Date.now() / 1000), value: 1 }],
      tags: [`tier:${tier}`, `blocked:${blocked}`, `env:${DD_ENV}`, `service:${DD_SERVICE}`],
    }
  ];

  if (blocked) {
    metrics.push({
      metric: 'ratelimit.blocked.total',
      type: 0,
      points: [{ timestamp: Math.floor(Date.now() / 1000), value: 1 }],
      tags: [`tier:${tier}`, `env:${DD_ENV}`, `service:${DD_SERVICE}`],
    });
  }

  sendMetrics(metrics);
}

/**
 * Track rate limiter stats periodically
 */
export function trackRateLimiterStats(stats: {
  totalUsers: number;
  blockedUsers: number;
  blockedIPs: number;
  avgRequestsPerUser: number;
}): void {
  const now = Math.floor(Date.now() / 1000);
  const tags = [`env:${DD_ENV}`, `service:${DD_SERVICE}`];

  sendMetrics([
    {
      metric: 'ratelimit.users.total',
      type: 1,
      points: [{ timestamp: now, value: stats.totalUsers }],
      tags,
    },
    {
      metric: 'ratelimit.users.blocked',
      type: 1,
      points: [{ timestamp: now, value: stats.blockedUsers }],
      tags,
    },
    {
      metric: 'ratelimit.ips.blocked',
      type: 1,
      points: [{ timestamp: now, value: stats.blockedIPs }],
      tags,
    },
    {
      metric: 'ratelimit.requests.avg_per_user',
      type: 1,
      points: [{ timestamp: now, value: stats.avgRequestsPerUser }],
      tags,
    },
  ]);
}
