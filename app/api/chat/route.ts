import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/gemini';
import { trackLLMCall, createSpan, addSecurityTagsToSpan, trackRateLimitMetrics } from '@/lib/datadog';
import { riskAnalyzer } from '@/lib/risk-analyzer';
import { costDetector } from '@/lib/cost-detector';
import { explainAttack, formatSecurityReport } from '@/lib/attack-explainer';
import { rateLimiter } from '@/lib/rate-limiter';
import { attackStore } from '@/lib/attack-store';

export async function POST(req: NextRequest) {
  return createSpan('llm.chat.request', async (span) => {
    try {
      const { message, history } = await req.json();

      if (!message || typeof message !== 'string') {
        return NextResponse.json(
          { error: 'Message is required' },
          { status: 400 }
        );
      }

      span.setTag('llm.prompt_length', message.length);
      span.setTag('llm.history_length', history?.length || 0);

      // Estimate tokens (rough estimate: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(message.length / 4);
      
      // Get user ID and IP (from session/IP in production, using 'demo' for now)
      const userId = req.headers.get('x-user-id') || 'demo-user';
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

      // Initial rate limit check (before expensive operations)
      const rateLimitCheck = rateLimiter.checkRateLimit(userId, ip, 0);
      
      // Track rate limit metrics
      trackRateLimitMetrics(rateLimitCheck.tier, !rateLimitCheck.allowed);
      
      if (!rateLimitCheck.allowed) {
        return NextResponse.json({
          error: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter,
          tier: rateLimitCheck.tier,
        }, { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitCheck.retryAfter || 60),
            'X-RateLimit-Tier': rateLimitCheck.tier,
          }
        });
      }

      span.setTag('ratelimit.tier', rateLimitCheck.tier);

      // Check for cost-based attacks first (fast check)
      const costAnalysis = costDetector.analyzeCostRisk(message, estimatedTokens, userId);
      
      if (costDetector.isUserBlocked(userId)) {
        return NextResponse.json({
          error: 'User temporarily blocked due to suspicious activity',
          riskAssessment: {
            riskScore: 100,
            riskLevel: 'critical',
            reasoning: ['User exceeded rate limits or exhibited attack behavior'],
            blocked: true,
          }
        }, { status: 429 });
      }

      // Analyze prompt for security risks (with Vertex AI)
      const riskAssessment = await riskAnalyzer.analyzePrompt(message);
      
      // Combine cost analysis with security analysis
      if (costAnalysis.isCostAttack) {
        riskAssessment.riskScore = Math.min(100, riskAssessment.riskScore + costAnalysis.riskScore);
        riskAssessment.reasoning.push('Cost Attack Analysis:');
        riskAssessment.reasoning.push(...costAnalysis.reasoning);
        
        // Update should block if cost attack is severe
        if (costAnalysis.shouldBlock) {
          riskAssessment.shouldBlock = true;
        }
      }
      
      // Add security tags to APM span
      addSecurityTagsToSpan(span, riskAssessment);
      span.setTag('cost.estimated_tokens', estimatedTokens);
      span.setTag('cost.attack_detected', costAnalysis.isCostAttack);
      if (costAnalysis.attackType) {
        span.setTag('cost.attack_type', costAnalysis.attackType);
      }

      // Block request if risk is critical
      if (riskAssessment.shouldBlock) {
        // Record attack for rate limiting
        rateLimiter.recordAttack(userId, ip, true);
        
        // Block user if severe cost attack
        if (costAnalysis.severity === 'critical' && costAnalysis.attackType === 'infinite_loop') {
          costDetector.blockUser(userId, 300000); // 5 min block
        }

        // Generate AI explanation of the attack (async, don't block response)
        let aiExplanation;
        try {
          aiExplanation = await explainAttack(message, riskAssessment);
        } catch (error) {
          console.error('AI explanation failed:', error);
        }

        trackLLMCall({
          latency: 0,
          model: 'gemini-2.5-flash',
          riskScore: riskAssessment.riskScore,
          riskLevel: riskAssessment.riskLevel,
          blocked: true,
          detectedPatterns: riskAssessment.detectedPatterns.length,
          attackCategories: Array.from(riskAssessment.categories),
          confidence: riskAssessment.confidence,
          vertexAI: riskAssessment.vertexAI ? {
            sentimentScore: riskAssessment.vertexAI.sentiment.score,
            sentimentMagnitude: riskAssessment.vertexAI.sentiment.magnitude,
            entitiesDetected: riskAssessment.vertexAI.entities.length,
            riskContribution: riskAssessment.vertexAI.riskContribution,
          } : undefined,
          costAttack: costAnalysis.isCostAttack ? {
            detected: true,
            attackType: costAnalysis.attackType,
            severity: costAnalysis.severity,
            estimatedTokens,
          } : undefined,
        });

        // Record attack in attack store
        attackStore.recordAttack({
          userId,
          ip,
          prompt: message,
          riskScore: riskAssessment.riskScore,
          riskLevel: riskAssessment.riskLevel,
          blocked: true,
          detectedPatterns: riskAssessment.detectedPatterns.length,
          attackCategories: Array.from(riskAssessment.categories),
          reasoning: riskAssessment.reasoning,
          aiAnalysis: aiExplanation ? {
            summary: aiExplanation.summary,
            attackType: aiExplanation.attackType,
            severity: aiExplanation.severity,
            mitigationSteps: aiExplanation.mitigationSteps,
          } : undefined,
          vertexAI: riskAssessment.vertexAI ? {
            sentimentScore: riskAssessment.vertexAI.sentiment.score,
            sentimentMagnitude: riskAssessment.vertexAI.sentiment.magnitude,
            entitiesDetected: riskAssessment.vertexAI.entities.length,
          } : undefined,
          costAttack: costAnalysis.isCostAttack ? {
            attackType: costAnalysis.attackType || 'unknown',
            severity: costAnalysis.severity,
            estimatedTokens,
          } : undefined,
        });

        return NextResponse.json({
          error: 'Request blocked for security reasons',
          riskAssessment: {
            riskScore: riskAssessment.riskScore,
            riskLevel: riskAssessment.riskLevel,
            reasoning: riskAssessment.reasoning,
            blocked: true,
            aiAnalysis: aiExplanation ? {
              summary: aiExplanation.summary,
              attackType: aiExplanation.attackType,
              severity: aiExplanation.severity,
              mitigationSteps: aiExplanation.mitigationSteps,
            } : undefined,
          }
        }, { status: 403 });
      }

      // Record non-critical attack for rate limiting and monitoring
      if (riskAssessment.riskScore >= 40) {
        rateLimiter.recordAttack(userId, ip, false);
        
        // Also record in attack store for monitoring
        attackStore.recordAttack({
          userId,
          ip,
          prompt: message,
          riskScore: riskAssessment.riskScore,
          riskLevel: riskAssessment.riskLevel,
          blocked: false,
          detectedPatterns: riskAssessment.detectedPatterns.length,
          attackCategories: Array.from(riskAssessment.categories),
          reasoning: riskAssessment.reasoning,
          vertexAI: riskAssessment.vertexAI ? {
            sentimentScore: riskAssessment.vertexAI.sentiment.score,
            sentimentMagnitude: riskAssessment.vertexAI.sentiment.magnitude,
            entitiesDetected: riskAssessment.vertexAI.entities.length,
          } : undefined,
        });
      }

      const startTime = Date.now();
      
      const response = await generateResponse(message, history || []);
      
      const latency = Date.now() - startTime;

      // Track LLM metrics in Datadog with security data
      trackLLMCall({
        latency,
        model: 'gemini-2.5-flash',
        promptTokens: Math.ceil(message.length / 4),
        completionTokens: Math.ceil(response.length / 4),
        totalTokens: Math.ceil((message.length + response.length) / 4),
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        blocked: false,
        detectedPatterns: riskAssessment.detectedPatterns.length,
        attackCategories: Array.from(riskAssessment.categories),
        confidence: riskAssessment.confidence,
        vertexAI: riskAssessment.vertexAI ? {
          sentimentScore: riskAssessment.vertexAI.sentiment.score,
          sentimentMagnitude: riskAssessment.vertexAI.sentiment.magnitude,
          entitiesDetected: riskAssessment.vertexAI.entities.length,
          riskContribution: riskAssessment.vertexAI.riskContribution,
        } : undefined,
        costAttack: costAnalysis.isCostAttack ? {
          detected: true,
          attackType: costAnalysis.attackType,
          severity: costAnalysis.severity,
          estimatedTokens,
        } : undefined,
      });

      span.setTag('llm.response_length', response.length);
      span.setTag('llm.latency', latency);

      // For high-risk but allowed requests, provide security guidance
      let securityGuidance;
      if (riskAssessment.riskScore >= 40) {
        try {
          const explanation = await explainAttack(message, riskAssessment);
          securityGuidance = {
            warning: `This prompt triggered security alerts (${riskAssessment.riskScore}/100 risk)`,
            attackType: explanation.attackType,
            educationalNote: explanation.educationalNote,
          };
        } catch (error) {
          console.error('Security guidance failed:', error);
        }
      }

      return NextResponse.json({
        response,
        riskAssessment: {
          riskScore: riskAssessment.riskScore,
          riskLevel: riskAssessment.riskLevel,
          detectedPatterns: riskAssessment.detectedPatterns.length,
          blocked: false,
        },
        securityGuidance,
        metadata: {
          latency,
          timestamp: new Date().toISOString(),
          model: 'gemini-2.5-flash',
        }
      });

    } catch (error: any) {
      console.error('Chat API Error:', error);
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      
      return NextResponse.json(
        { error: 'Failed to generate response', details: error.message },
        { status: 500 }
      );
    }
  });
}
