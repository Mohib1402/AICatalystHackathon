/**
 * AI-Powered Attack Explanation Module
 * 
 * Uses Gemini to generate human-readable explanations of detected attacks,
 * including severity assessment, attack vectors, and mitigation strategies.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RiskAssessment } from './risk-analyzer';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export interface AttackExplanation {
  summary: string;
  attackType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  technicalDetails: string;
  potentialImpact: string;
  mitigationSteps: string[];
  educationalNote: string;
  confidence: number;
}

/**
 * Generate AI-powered explanation of a detected attack
 */
export async function explainAttack(
  prompt: string,
  riskAssessment: RiskAssessment
): Promise<AttackExplanation> {
  try {
    // Build context for Gemini
    const attackCategories = Array.from(riskAssessment.categories);
    const detectedPatterns = riskAssessment.detectedPatterns.map(p => p.pattern.id);
    
    const analysisPrompt = `You are a cybersecurity expert analyzing a potentially malicious prompt sent to an AI system.

**Prompt to Analyze:**
"${prompt}"

**Security Analysis Results:**
- Risk Score: ${riskAssessment.riskScore}/100
- Risk Level: ${riskAssessment.riskLevel}
- Detected Attack Categories: ${attackCategories.join(', ') || 'None'}
- Pattern IDs: ${detectedPatterns.join(', ') || 'None'}
- Should Block: ${riskAssessment.shouldBlock ? 'YES' : 'NO'}

**Additional Context:**
${riskAssessment.reasoning.join('\n')}

Please provide a comprehensive security analysis in the following JSON format:
{
  "summary": "One sentence summary of the attack attempt",
  "attackType": "Primary attack type (e.g., Prompt Injection, Data Exfiltration, Jailbreak)",
  "severity": "low/medium/high/critical",
  "technicalDetails": "2-3 sentences explaining HOW this attack works technically",
  "potentialImpact": "What damage could this attack cause if successful?",
  "mitigationSteps": ["Step 1", "Step 2", "Step 3"],
  "educationalNote": "Brief explanation to help developers understand this attack class",
  "confidence": 0.95
}

Important:
- Be concise but thorough
- Use security professional language
- Focus on actionable insights
- If risk score is low, acknowledge it's likely benign
- Confidence should reflect how certain you are this is an attack (0.0-1.0)

Return ONLY valid JSON, no markdown formatting.`;

    const result = await model.generateContent(analysisPrompt);
    const response = result.response.text();
    
    // Parse JSON response (handle potential markdown code blocks)
    let jsonText = response.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const explanation: AttackExplanation = JSON.parse(jsonText);
    
    // Validate and return
    return {
      summary: explanation.summary || 'Security analysis completed',
      attackType: explanation.attackType || 'Unknown',
      severity: explanation.severity || riskAssessment.riskLevel as any,
      technicalDetails: explanation.technicalDetails || 'No additional technical details available',
      potentialImpact: explanation.potentialImpact || 'Impact assessment pending',
      mitigationSteps: explanation.mitigationSteps || ['Review security policies', 'Monitor for similar patterns'],
      educationalNote: explanation.educationalNote || 'This prompt was analyzed for security threats',
      confidence: explanation.confidence || riskAssessment.confidence,
    };
    
  } catch (error) {
    console.error('Attack explanation failed:', error);
    
    // Fallback to basic explanation
    return generateFallbackExplanation(prompt, riskAssessment);
  }
}

/**
 * Generate fallback explanation if Gemini fails
 */
function generateFallbackExplanation(
  prompt: string,
  riskAssessment: RiskAssessment
): AttackExplanation {
  const categories = Array.from(riskAssessment.categories);
  const primaryCategory = categories[0] || 'security';
  
  const attackTypeMap: Record<string, string> = {
    'prompt-injection': 'Prompt Injection Attack',
    'jailbreak': 'Jailbreak Attempt',
    'data-exfiltration': 'Data Exfiltration',
    'system-access': 'System Access Attempt',
    'code-injection': 'Code Injection',
    'security': 'Security Threat',
  };
  
  const attackType = attackTypeMap[primaryCategory] || 'Security Threat';
  
  return {
    summary: `Detected ${attackType.toLowerCase()} with ${riskAssessment.riskScore}/100 risk score`,
    attackType,
    severity: riskAssessment.riskLevel as any,
    technicalDetails: `Pattern-based detection identified ${riskAssessment.detectedPatterns.length} suspicious patterns in the prompt.`,
    potentialImpact: riskAssessment.shouldBlock 
      ? 'Could compromise system security or leak sensitive data'
      : 'Limited impact - request was allowed',
    mitigationSteps: [
      'Monitor for similar attack patterns',
      'Review and update security rules',
      'Educate users on secure prompt practices',
    ],
    educationalNote: `This prompt triggered ${categories.join(', ')} detection rules.`,
    confidence: riskAssessment.confidence,
  };
}

/**
 * Generate mitigation recommendations based on attack patterns
 */
export async function generateMitigationPlan(
  attackExplanation: AttackExplanation,
  riskAssessment: RiskAssessment
): Promise<string[]> {
  try {
    const categories = Array.from(riskAssessment.categories);
    
    const mitigationPrompt = `As a cybersecurity expert, provide specific mitigation steps for this attack:

**Attack Type:** ${attackExplanation.attackType}
**Severity:** ${attackExplanation.severity}
**Categories:** ${categories.join(', ')}
**Technical Details:** ${attackExplanation.technicalDetails}

Provide 5 specific, actionable mitigation steps in JSON array format:
["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]

Focus on:
1. Immediate response actions
2. Pattern updates
3. User education
4. System hardening
5. Monitoring improvements

Return ONLY a JSON array, no other text.`;

    const result = await model.generateContent(mitigationPrompt);
    const response = result.response.text().trim();
    
    let jsonText = response;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const steps = JSON.parse(jsonText);
    return Array.isArray(steps) ? steps : attackExplanation.mitigationSteps;
    
  } catch (error) {
    console.error('Mitigation plan generation failed:', error);
    return attackExplanation.mitigationSteps;
  }
}

/**
 * Generate user-friendly security report
 */
export function formatSecurityReport(
  prompt: string,
  riskAssessment: RiskAssessment,
  explanation: AttackExplanation
): string {
  const emoji = {
    low: '✅',
    medium: '⚠️',
    high: '🔶',
    critical: '🚨',
  };
  
  const status = riskAssessment.shouldBlock ? 'BLOCKED' : 'ALLOWED';
  const icon = emoji[explanation.severity];
  
  return `
${icon} SECURITY ANALYSIS REPORT

Status: ${status}
Risk Score: ${riskAssessment.riskScore}/100
Severity: ${explanation.severity.toUpperCase()}
Attack Type: ${explanation.attackType}
Confidence: ${Math.round(explanation.confidence * 100)}%

SUMMARY
${explanation.summary}

TECHNICAL DETAILS
${explanation.technicalDetails}

POTENTIAL IMPACT
${explanation.potentialImpact}

MITIGATION STEPS
${explanation.mitigationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

EDUCATIONAL NOTE
${explanation.educationalNote}

---
Generated by DevShield AI - Powered by Google Gemini & Vertex AI
`.trim();
}
