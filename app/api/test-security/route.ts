import { NextRequest, NextResponse } from 'next/server';
import { riskAnalyzer } from '@/lib/risk-analyzer';
import fs from 'fs';
import path from 'path';

// Development-only endpoint for testing attack detection
// TODO: Remove or protect this endpoint in production
export async function GET(req: NextRequest) {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const datasetPath = path.join(process.cwd(), 'scripts', 'attack-dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

    const results = dataset.map((testCase: any) => {
      const analysis = riskAnalyzer.analyzePromptSync(testCase.prompt);
      
      let passed = true;
      let failureReason = '';

      if (testCase.expectedRisk === 'low' && analysis.riskLevel !== 'low') {
        passed = false;
        failureReason = `Expected low risk, got ${analysis.riskLevel}`;
      } else if (testCase.expectedRisk === 'critical' && analysis.riskLevel !== 'critical') {
        passed = false;
        failureReason = `Expected critical risk, got ${analysis.riskLevel}`;
      } else if (testCase.expectedRisk === 'high' && analysis.riskLevel !== 'high' && analysis.riskLevel !== 'critical') {
        passed = false;
        failureReason = `Expected high risk, got ${analysis.riskLevel}`;
      }

      if (testCase.expectedCategory && analysis.categories.size > 0) {
        const hasExpectedCategory = Array.from(analysis.categories).some(
          cat => cat === testCase.expectedCategory
        );
        if (!hasExpectedCategory) {
          passed = false;
          failureReason = `Expected category ${testCase.expectedCategory}`;
        }
      }

      return {
        description: testCase.description,
        prompt: testCase.prompt.substring(0, 50) + '...',
        passed,
        failureReason,
        analysis: {
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          shouldBlock: analysis.shouldBlock,
          patternsDetected: analysis.detectedPatterns.length,
          categories: Array.from(analysis.categories),
        }
      };
    });

    const passed = results.filter((r: any) => r.passed).length;
    const failed = results.filter((r: any) => !r.passed).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed,
        failed,
        successRate: Math.round((passed / results.length) * 100),
      },
      results,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
