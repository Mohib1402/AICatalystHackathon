/**
 * Vertex AI Natural Language Integration
 * 
 * Provides AI-powered sentiment analysis and entity detection
 * to enhance pattern-based security detection.
 */

import { LanguageServiceClient } from '@google-cloud/language';

// Initialize Vertex AI client
const languageClient = new LanguageServiceClient();

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  score: number;        // -1.0 (negative) to 1.0 (positive)
  magnitude: number;    // 0.0 to +inf (strength of emotion)
  confidence: number;   // 0.0 to 1.0
}

/**
 * Entity detection result
 */
export interface EntityResult {
  name: string;
  type: string;         // EMAIL, PHONE_NUMBER, PERSON, etc.
  salience: number;     // 0.0 to 1.0 (importance)
}

/**
 * Vertex AI analysis result
 */
export interface VertexAIResult {
  sentiment: SentimentResult;
  entities: EntityResult[];
  riskContribution: number;  // 0-100 points to add to risk score
  reasoning: string[];
}

/**
 * Analyze text sentiment using Vertex AI Natural Language API
 * 
 * @param text - Text to analyze
 * @returns Sentiment analysis result
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  try {
    const document = {
      content: text,
      type: 'PLAIN_TEXT' as const,
    };

    const [result] = await languageClient.analyzeSentiment({ document });
    const sentiment = result.documentSentiment;

    if (!sentiment || sentiment.score === null || sentiment.score === undefined || 
        sentiment.magnitude === null || sentiment.magnitude === undefined) {
      throw new Error('No sentiment data returned');
    }

    // Calculate confidence based on magnitude
    // Higher magnitude = more confident in the sentiment
    const confidence = Math.min(sentiment.magnitude / 2, 1.0);

    return {
      score: sentiment.score,
      magnitude: sentiment.magnitude,
      confidence,
    };
  } catch (error) {
    console.error('Vertex AI sentiment analysis error:', error);
    // Return neutral sentiment on error (graceful degradation)
    return {
      score: 0,
      magnitude: 0,
      confidence: 0,
    };
  }
}

/**
 * Detect entities in text using Vertex AI Natural Language API
 * 
 * @param text - Text to analyze
 * @returns List of detected entities
 */
export async function detectEntities(text: string): Promise<EntityResult[]> {
  try {
    const document = {
      content: text,
      type: 'PLAIN_TEXT' as const,
    };

    const [result] = await languageClient.analyzeEntities({ document });
    const entities = result.entities || [];

    return entities
      .map(entity => ({
        name: entity.name || '',
        type: String(entity.type || 'UNKNOWN'),
        salience: entity.salience || 0,
      }))
      .filter(entity => entity.salience > 0.01); // Filter out noise
  } catch (error) {
    console.error('Vertex AI entity detection error:', error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

/**
 * Perform comprehensive Vertex AI analysis on text
 * Combines sentiment and entity detection for security assessment
 * 
 * @param text - Text to analyze (typically user prompt)
 * @returns Complete Vertex AI analysis result
 */
export async function analyzePrompt(text: string): Promise<VertexAIResult> {
  const [sentiment, entities] = await Promise.all([
    analyzeSentiment(text),
    detectEntities(text),
  ]);

  // Calculate risk contribution from Vertex AI analysis
  let riskContribution = 0;
  const reasoning: string[] = [];

  // 1. Sentiment-based risk (0-30 points)
  if (sentiment.score < -0.3 && sentiment.magnitude > 0.5) {
    // Strong negative sentiment with high magnitude
    const sentimentRisk = Math.min(30, Math.abs(sentiment.score) * sentiment.magnitude * 30);
    riskContribution += sentimentRisk;
    reasoning.push(
      `Negative sentiment detected (score: ${sentiment.score.toFixed(2)}, magnitude: ${sentiment.magnitude.toFixed(2)})`
    );
  } else if (sentiment.score < -0.5) {
    // Very negative sentiment even with low magnitude
    riskContribution += 15;
    reasoning.push(`Strong negative sentiment (score: ${sentiment.score.toFixed(2)})`);
  }

  // 2. Neutral/positive with high magnitude can indicate manipulation
  if (sentiment.score > -0.1 && sentiment.score < 0.1 && sentiment.magnitude > 1.5) {
    riskContribution += 10;
    reasoning.push(
      `Neutral sentiment with high magnitude may indicate manipulation attempt (magnitude: ${sentiment.magnitude.toFixed(2)})`
    );
  }

  // 3. Entity-based risk (0-20 points)
  const sensitiveEntityTypes = ['EMAIL', 'PHONE_NUMBER', 'PERSON', 'ORGANIZATION', 'ADDRESS', 'NUMBER'];
  const sensitiveEntities = entities.filter(e => 
    sensitiveEntityTypes.some(type => e.type.includes(type))
  );

  if (sensitiveEntities.length > 0) {
    const entityRisk = Math.min(20, sensitiveEntities.length * 5);
    riskContribution += entityRisk;
    reasoning.push(
      `Detected ${sensitiveEntities.length} potentially sensitive entities: ${sensitiveEntities.map(e => e.type).join(', ')}`
    );
  }

  // 4. Multiple entities with high salience can indicate data exfiltration attempts
  const highSalienceEntities = entities.filter(e => e.salience > 0.3);
  if (highSalienceEntities.length > 3) {
    riskContribution += 15;
    reasoning.push(
      `Multiple prominent entities detected (${highSalienceEntities.length}), possible data extraction attempt`
    );
  }

  // Cap total Vertex AI contribution at 50 points (rest comes from patterns)
  riskContribution = Math.min(50, riskContribution);

  return {
    sentiment,
    entities,
    riskContribution,
    reasoning,
  };
}

/**
 * Analyze response text for PII leakage
 * Used to detect when the LLM accidentally leaks sensitive information
 * 
 * @param responseText - LLM response to analyze
 * @returns True if PII detected, with list of detected entities
 */
export async function detectPIIInResponse(
  responseText: string
): Promise<{ hasPII: boolean; entities: EntityResult[] }> {
  const entities = await detectEntities(responseText);
  
  // Check for PII entity types
  const piiTypes = ['EMAIL', 'PHONE_NUMBER', 'ADDRESS', 'NUMBER', 'PERSON'];
  const piiEntities = entities.filter(e =>
    piiTypes.some(type => e.type.includes(type)) && e.salience > 0.1
  );

  return {
    hasPII: piiEntities.length > 0,
    entities: piiEntities,
  };
}

/**
 * Health check for Vertex AI service
 * Tests if the API is accessible and working
 * 
 * @returns True if Vertex AI is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const testResult = await analyzeSentiment('Test message');
    return testResult.confidence >= 0;
  } catch (error) {
    console.error('Vertex AI health check failed:', error);
    return false;
  }
}

// Export a singleton instance for convenience
export const vertexAI = {
  analyzeSentiment,
  detectEntities,
  analyzePrompt,
  detectPIIInResponse,
  healthCheck,
};
