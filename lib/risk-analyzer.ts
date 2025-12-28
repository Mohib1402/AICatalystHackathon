import {
  AttackCategory,
  AttackPattern,
  RiskLevel,
  ATTACK_PATTERNS,
  getRiskLevel,
} from './attack-patterns';
import { vertexAI, SentimentResult, EntityResult } from './vertex-ai';

export interface DetectedPattern {
  pattern: AttackPattern;
  matches: string[];
  confidence: number;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  detectedPatterns: DetectedPattern[];
  categories: Set<AttackCategory>;
  shouldBlock: boolean;
  confidence: number;
  reasoning: string[];
  metadata: {
    promptLength: number;
    suspiciousKeywordCount: number;
    highRiskPatternCount: number;
  };
  vertexAI?: {
    sentiment: SentimentResult;
    entities: EntityResult[];
    riskContribution: number;
  };
}

export class RiskAnalyzer {
  private blockThreshold = 76;
  private useVertexAI = true;

  async analyzePrompt(prompt: string): Promise<RiskAssessment> {
    const normalizedPrompt = prompt.toLowerCase();
    const detectedPatterns: DetectedPattern[] = [];
    const reasoning: string[] = [];
    const categories = new Set<AttackCategory>();

    let totalScore = 0;
    let suspiciousKeywordCount = 0;
    let highRiskPatternCount = 0;

    // Check for educational context
    const isEducational = this.hasEducationalContext(prompt);
    if (isEducational) {
      reasoning.push('Educational context detected - applying reduced risk scoring');
    }

    // Pattern-based detection
    for (const pattern of ATTACK_PATTERNS) {
      const detection = this.detectPattern(prompt, normalizedPrompt, pattern);
      
      if (detection.matches.length > 0) {
        detectedPatterns.push(detection);
        categories.add(pattern.category);
        
        // Apply educational context modifier (85% reduction for maximum safety)
        const scoreMultiplier = isEducational ? 0.15 : 1.0;
        const adjustedScore = pattern.riskScore * scoreMultiplier;
        totalScore += adjustedScore;
        suspiciousKeywordCount += detection.matches.length;

        if (pattern.riskScore >= 76) {
          highRiskPatternCount++;
        }

        reasoning.push(
          `Detected ${pattern.name} (${pattern.category}): ${detection.matches.length} match(es)${isEducational ? ' [Educational context: -85% risk]' : ''}`
        );
      }
    }

    // Structural analysis (apply educational context modifier)
    const structuralRisk = this.analyzeStructure(prompt);
    const structuralScoreMultiplier = isEducational ? 0.15 : 1.0;
    totalScore += structuralRisk.score * structuralScoreMultiplier;
    if (structuralRisk.findings.length > 0) {
      reasoning.push(...structuralRisk.findings.map(f => 
        isEducational ? `${f} [Educational context: -70% risk]` : f
      ));
    }

    // Vertex AI analysis (hybrid approach) - apply educational context modifier
    let vertexAIData;
    if (this.useVertexAI) {
      try {
        const vertexResult = await vertexAI.analyzePrompt(prompt);
        vertexAIData = {
          sentiment: vertexResult.sentiment,
          entities: vertexResult.entities,
          riskContribution: vertexResult.riskContribution,
        };
        
        // Add Vertex AI risk contribution (weighted 30%, with educational modifier)
        const vertexScoreMultiplier = isEducational ? 0.3 : 1.0;
        const vertexScore = vertexResult.riskContribution * 0.3 * vertexScoreMultiplier;
        totalScore += vertexScore;
        
        // Add Vertex AI reasoning
        if (vertexResult.reasoning.length > 0) {
          reasoning.push('Vertex AI Analysis:');
          reasoning.push(...vertexResult.reasoning);
        }
      } catch (error) {
        console.error('Vertex AI analysis failed, falling back to pattern-only detection:', error);
      }
    }

    const normalizedScore = Math.min(100, totalScore);
    const riskLevel = getRiskLevel(normalizedScore);
    const shouldBlock = normalizedScore >= this.blockThreshold;

    const confidence = this.calculateConfidence(
      detectedPatterns.length,
      suspiciousKeywordCount,
      highRiskPatternCount
    );

    if (detectedPatterns.length === 0 && !vertexAIData) {
      reasoning.push('No malicious patterns detected');
    }

    return {
      riskScore: normalizedScore,
      riskLevel,
      detectedPatterns,
      categories,
      shouldBlock,
      confidence,
      reasoning,
      metadata: {
        promptLength: prompt.length,
        suspiciousKeywordCount,
        highRiskPatternCount,
      },
      vertexAI: vertexAIData,
    };
  }

  analyzePromptSync(prompt: string): RiskAssessment {
    const normalizedPrompt = prompt.toLowerCase();
    const detectedPatterns: DetectedPattern[] = [];
    const reasoning: string[] = [];
    const categories = new Set<AttackCategory>();

    let totalScore = 0;
    let suspiciousKeywordCount = 0;
    let highRiskPatternCount = 0;

    // Check for educational context
    const isEducational = this.hasEducationalContext(prompt);
    if (isEducational) {
      reasoning.push('Educational context detected - applying reduced risk scoring');
    }

    for (const pattern of ATTACK_PATTERNS) {
      const detection = this.detectPattern(prompt, normalizedPrompt, pattern);
      
      if (detection.matches.length > 0) {
        detectedPatterns.push(detection);
        categories.add(pattern.category);
        
        // Apply educational context modifier (85% reduction for maximum safety)
        const scoreMultiplier = isEducational ? 0.15 : 1.0;
        const adjustedScore = pattern.riskScore * scoreMultiplier;
        totalScore += adjustedScore;
        suspiciousKeywordCount += detection.matches.length;

        if (pattern.riskScore >= 76) {
          highRiskPatternCount++;
        }

        reasoning.push(
          `Detected ${pattern.name} (${pattern.category}): ${detection.matches.length} match(es)${isEducational ? ' [Educational context: -85% risk]' : ''}`
        );
      }
    }

    const structuralRisk = this.analyzeStructure(prompt);
    const structuralScoreMultiplier = isEducational ? 0.15 : 1.0;
    totalScore += structuralRisk.score * structuralScoreMultiplier;
    if (structuralRisk.findings.length > 0) {
      reasoning.push(...structuralRisk.findings.map(f => 
        isEducational ? `${f} [Educational context: -70% risk]` : f
      ));
    }

    const normalizedScore = Math.min(100, totalScore);
    const riskLevel = getRiskLevel(normalizedScore);
    const shouldBlock = normalizedScore >= this.blockThreshold;

    const confidence = this.calculateConfidence(
      detectedPatterns.length,
      suspiciousKeywordCount,
      highRiskPatternCount
    );

    if (detectedPatterns.length === 0) {
      reasoning.push('No malicious patterns detected');
    }

    return {
      riskScore: normalizedScore,
      riskLevel,
      detectedPatterns,
      categories,
      shouldBlock,
      confidence,
      reasoning,
      metadata: {
        promptLength: prompt.length,
        suspiciousKeywordCount,
        highRiskPatternCount,
      },
    };
  }

  setVertexAIEnabled(enabled: boolean): void {
    this.useVertexAI = enabled;
  }

  private detectPattern(
    originalPrompt: string,
    normalizedPrompt: string,
    pattern: AttackPattern
  ): DetectedPattern {
    const matches: string[] = [];
    const searchPrompt = pattern.caseSensitive ? originalPrompt : normalizedPrompt;

    if (pattern.regex) {
      const regexMatches = searchPrompt.match(pattern.regex);
      if (regexMatches) {
        matches.push(...regexMatches);
      }
    }

    for (const keyword of pattern.keywords) {
      const searchKeyword = pattern.caseSensitive ? keyword : keyword.toLowerCase();
      if (searchPrompt.includes(searchKeyword)) {
        matches.push(keyword);
      }
    }

    const confidence = matches.length > 0 ? Math.min(1.0, matches.length * 0.3) : 0;

    return {
      pattern,
      matches: [...new Set(matches)],
      confidence,
    };
  }

  private analyzeStructure(prompt: string): { score: number; findings: string[] } {
    let score = 0;
    const findings: string[] = [];

    if (prompt.length > 2000) {
      score += 10;
      findings.push('Unusually long prompt (potential obfuscation)');
    }

    const specialCharCount = (prompt.match(/[<>{}[\]()`;|&$]/g) || []).length;
    if (specialCharCount > 10) {
      score += 15;
      findings.push(`High special character count: ${specialCharCount}`);
    }

    // Check for full-width character obfuscation (Unicode range FF01-FF5E)
    const fullWidthChars = (prompt.match(/[\uFF01-\uFF5E]/g) || []).length;
    if (fullWidthChars > 5) {
      score += 80; // Critical - deliberate character substitution obfuscation
      findings.push(`Full-width character obfuscation detected: ${fullWidthChars} chars`);
    }

    // Check for Unicode diacritics obfuscation (combining marks)
    const diacritics = (prompt.match(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF]/g) || []).length;
    if (diacritics > 10) {
      score += 60; // Increased - this is deliberate obfuscation
      findings.push(`Unicode diacritics obfuscation detected: ${diacritics} marks`);
    }

    const upperCaseRatio = (prompt.match(/[A-Z]/g) || []).length / prompt.length;
    if (upperCaseRatio > 0.5 && prompt.length > 50) {
      score += 10;
      findings.push('Excessive uppercase (possible shouting/emphasis attack)');
    }

    const repeatedWords = prompt.match(/(\b\w+\b)(?=.*\b\1\b)/gi) || [];
    if (repeatedWords.length > 20) {
      score += 10;
      findings.push('Excessive word repetition detected');
    }

    const urlMatches = prompt.match(/https?:\/\/[^\s]+/gi) || [];
    if (urlMatches.length > 3) {
      score += 15;
      findings.push(`Multiple URLs detected: ${urlMatches.length}`);
    }

    const encodedPatterns = /(%[0-9A-F]{2}|\\x[0-9A-F]{2}|\\u[0-9A-F]{4})/gi;
    const encodedMatches = prompt.match(encodedPatterns) || [];
    if (encodedMatches.length > 5) {
      score += 20;
      findings.push('Encoded characters detected (possible obfuscation)');
    }

    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|WHERE|FROM|TABLE)\b/gi;
    const sqlMatches = prompt.match(sqlKeywords) || [];
    if (sqlMatches.length > 2) {
      score += 25;
      findings.push('SQL injection patterns detected');
    }

    return { score, findings };
  }

  private hasEducationalContext(prompt: string): boolean {
    const normalizedPrompt = prompt.toLowerCase();
    
    // Educational phrases that indicate learning intent
    const educationalPhrases = [
      /^explain\s+(this|the|how|what|why)/i,
      /^what\s+(does|is|are)\s+.+\s+(do|mean)/i,
      /^how\s+(does|do|can|to|should)/i,
      /^can\s+you\s+(explain|show|teach|help\s+me\s+understand)/i,
      /help\s+me\s+understand/i,
      /for\s+(educational|learning|academic|research|security\s+training|my\s+class)/i,
      /i'?m\s+(teaching|learning|studying)/i,
      /security\s+(research|awareness|training|education)/i,
      /to\s+prevent\s+it/i,
      /for\s+my\s+(paper|thesis|research|course|class|software\s+engineering\s+course)/i,
      /here'?s\s+some\s+code[:\s]+.{0,50}what\s+does\s+it\s+do/i,
      /what\s+(would|does)\s+.+\s+code\s+do/i,
      /review\s+(this|my)\s+code/i,
      /help\s+me\s+(debug|understand|learn)/i,
      /continue\s+this\s+story/i,
      /i'?m\s+writing\s+(a\s+)?(novel|story|fiction)/i,
      /document\s+(the|this)/i,
      /best\s+(way|practice|method|strategy|approach)\s+to\s+(store|secure|protect|implement|handle|design)/i,
      /what'?s\s+the\s+best\s+(way|practice|strategy|approach)/i,
      /how\s+(should|can)\s+i\s+(configure|set\s+up|implement|structure|handle|use)/i,
      /owasp/i,
      /the\s+risks?\s+of\s+using/i,
      /show\s+me\s+how\s+(authentication|systems|to)/i,
      /most\s+common\s+(api|endpoints|vulnerabilities)/i,
      /what\s+are\s+the\s+(risks|benefits|differences)/i,
      /difference\s+between/i,
      /vs\s+/i,
      /comparison/i,
      /what\s+metrics\s+should/i,
      /\b(best\s+backup\s+strategy|rotation\s+strategy|partitioning\s+strategy)/i,
      /\b(production\s+(database|environment|system)|enterprise\s+setup)/i,
      /\b(database|api|system)\s+administration/i,
      /\b(devops|sysadmin|dba)\b/i,
      /\brecommended\s+(way|method|approach|practice)/i,
      /\b(why\s+use|what\s+are)\s+(security|auth|encryption|headers)/i,
      /\bexplain\s+(this|the)\s+code\s+(in|using)\s+\w+/i,
      /\bfor\s+(my|our|the)\s+(security|cyber|infosec)\s+(class|course)/i,
    ];
    
    return educationalPhrases.some(regex => regex.test(normalizedPrompt));
  }

  private calculateConfidence(
    patternCount: number,
    keywordCount: number,
    highRiskCount: number
  ): number {
    if (patternCount === 0) return 1.0;

    let confidence = 0.5;

    if (patternCount > 0) confidence += 0.2;
    if (patternCount > 2) confidence += 0.1;
    if (keywordCount > 3) confidence += 0.1;
    if (highRiskCount > 0) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  setBlockThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 100) {
      throw new Error('Block threshold must be between 0 and 100');
    }
    this.blockThreshold = threshold;
  }

  getBlockThreshold(): number {
    return this.blockThreshold;
  }
}

export const riskAnalyzer = new RiskAnalyzer();
