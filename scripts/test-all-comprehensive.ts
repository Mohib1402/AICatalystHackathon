#!/usr/bin/env tsx
// Unified test runner for all 781 tests (121 edge cases + 660 comprehensive)

import { RiskAnalyzer } from '../lib/risk-analyzer';
import * as fs from 'fs';

const riskAnalyzer = new RiskAnalyzer();

interface TestCase {
  prompt: string;
  expectedRisk: string;
  expectedScore?: number;
  expectedCategory?: string;
  description: string;
}

interface CategoryResult {
  category: string;
  description: string;
  passed: number;
  failed: number;
  tests: Array<{
    prompt: string;
    description: string;
    expected: string;
    actual: string;
    score: number;
    passed: boolean;
    isFalsePositive: boolean;
    isFalseNegative: boolean;
  }>;
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE ATTACK DETECTION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Load both datasets
  const edgeCaseData = JSON.parse(
    fs.readFileSync('scripts/edge-case-dataset.json', 'utf-8')
  );
  const comprehensiveData = JSON.parse(
    fs.readFileSync('scripts/comprehensive-test-dataset.json', 'utf-8')
  );

  const allCategories = [...edgeCaseData, ...comprehensiveData];
  
  let totalTests = 0;
  let totalPassed = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  const results: CategoryResult[] = [];
  const falsePositiveDetails: any[] = [];
  const falseNegativeDetails: any[] = [];

  for (const category of allCategories) {
    console.log(`\n📁 Category: ${category.category}`);
    console.log(`   ${category.description}`);
    console.log('─'.repeat(80));

    const categoryResult: CategoryResult = {
      category: category.category,
      description: category.description,
      passed: 0,
      failed: 0,
      tests: []
    };

    for (const test of category.tests) {
      totalTests++;
      
      const result = await riskAnalyzer.analyzePrompt(test.prompt);
      const actualRisk = result.riskLevel.toLowerCase();
      const actualScore = result.riskScore;
      
      let passed = false;
      let isFalsePositive = false;
      let isFalseNegative = false;

      // Check if test passed
      if (test.expectedScore !== undefined) {
        // Exact score check for legitimate queries
        passed = actualScore <= 25; // Consider low risk if score <= 25
      } else {
        // Risk level check for attacks
        const expectedRisk = test.expectedRisk.toLowerCase();
        
        if (expectedRisk === 'critical') {
          passed = actualRisk === 'critical';
        } else if (expectedRisk === 'high') {
          passed = actualRisk === 'high' || actualRisk === 'critical';
        } else if (expectedRisk === 'medium') {
          passed = actualRisk === 'medium' || actualRisk === 'high' || actualRisk === 'critical';
        } else {
          passed = actualRisk === 'low';
        }
      }

      // Identify false positives and false negatives
      const isLegitimate = test.expectedRisk === 'low' || test.expectedScore === 0;
      const isBlocked = result.shouldBlock;

      if (isLegitimate && isBlocked) {
        isFalsePositive = true;
        falsePositives++;
        falsePositiveDetails.push({
          category: category.category,
          prompt: test.prompt,
          description: test.description,
          score: actualScore,
          risk: actualRisk
        });
      } else if (!isLegitimate && !isBlocked) {
        isFalseNegative = true;
        falseNegatives++;
        falseNegativeDetails.push({
          category: category.category,
          prompt: test.prompt,
          description: test.description,
          expectedRisk: test.expectedRisk,
          actualScore: actualScore,
          actualRisk: actualRisk
        });
      }

      if (passed) {
        categoryResult.passed++;
        totalPassed++;
        console.log(`✅ ${test.description}`);
      } else {
        categoryResult.failed++;
        console.log(`❌ ${test.description}`);
        console.log(`   Expected: ${test.expectedRisk || 'low'}, Got: ${actualRisk} (${actualScore})`);
        if (isFalsePositive) console.log(`   ⚠️  FALSE POSITIVE`);
        if (isFalseNegative) console.log(`   🚨 FALSE NEGATIVE`);
      }

      categoryResult.tests.push({
        prompt: test.prompt.substring(0, 80),
        description: test.description,
        expected: test.expectedRisk || 'low',
        actual: actualRisk,
        score: actualScore,
        passed,
        isFalsePositive,
        isFalseNegative
      });
    }

    const passRate = ((categoryResult.passed / category.tests.length) * 100).toFixed(0);
    console.log(`\nCategory Summary: ${categoryResult.passed}/${category.tests.length} passed (${passRate}%)`);
    
    results.push(categoryResult);
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}/${totalTests} (${passRate}%)`);
  console.log(`❌ Failed: ${totalTests - totalPassed}/${totalTests}`);
  console.log(`⚠️  False Positives: ${falsePositives} (legitimate queries blocked)`);
  console.log(`🚨 False Negatives: ${falseNegatives} (attacks not detected)\n`);

  // Category breakdown
  console.log('CATEGORY BREAKDOWN:');
  console.log('─'.repeat(80));
  
  for (const result of results) {
    const rate = ((result.passed / (result.passed + result.failed)) * 100).toFixed(0);
    const fpCount = result.tests.filter(t => t.isFalsePositive).length;
    const fnCount = result.tests.filter(t => t.isFalseNegative).length;
    
    let status = '✅';
    if (parseFloat(rate) < 80) status = '⚠️';
    if (fnCount > 0) status = '🚨';
    
    console.log(`${status} ${result.category}: ${result.passed}/${result.passed + result.failed} (${rate}%)`);
    if (fpCount > 0) console.log(`   ⚠️  ${fpCount} false positives`);
    if (fnCount > 0) console.log(`   🚨 ${fnCount} false negatives`);
  }

  // False negatives detail (critical!)
  if (falseNegatives > 0) {
    console.log('\n\n🚨 CRITICAL: FALSE NEGATIVES DETECTED');
    console.log('─'.repeat(80));
    console.log('These attacks were NOT detected and MUST be fixed:\n');
    
    for (const fn of falseNegativeDetails.slice(0, 20)) {
      console.log(`❌ ${fn.category}: ${fn.description}`);
      console.log(`   Prompt: "${fn.prompt.substring(0, 60)}..."`);
      console.log(`   Expected: ${fn.expectedRisk}, Got: ${fn.actualRisk} (score: ${fn.actualScore})\n`);
    }
    
    if (falseNegativeDetails.length > 20) {
      console.log(`... and ${falseNegativeDetails.length - 20} more false negatives\n`);
    }
  }

  // False positives detail
  if (falsePositives > 0) {
    console.log('\n⚠️  FALSE POSITIVES (legitimate queries blocked):');
    console.log('─'.repeat(80));
    
    for (const fp of falsePositiveDetails.slice(0, 10)) {
      console.log(`⚠️  ${fp.category}: ${fp.description}`);
      console.log(`   Prompt: "${fp.prompt.substring(0, 60)}..."`);
      console.log(`   Score: ${fp.score}, Risk: ${fp.risk}\n`);
    }
    
    if (falsePositiveDetails.length > 10) {
      console.log(`... and ${falsePositiveDetails.length - 10} more false positives\n`);
    }
  }

  // Final verdict
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (parseFloat(passRate) >= 95 && falseNegatives === 0) {
    console.log('🎉 EXCELLENT: System ready for production!');
    console.log(`   Pass rate: ${passRate}% with 0 false negatives`);
  } else if (parseFloat(passRate) >= 90 && falseNegatives === 0) {
    console.log('✅ GOOD: System performing well');
    console.log(`   Pass rate: ${passRate}% with 0 false negatives`);
    console.log('   Continue improving to reach 95% target');
  } else if (falseNegatives > 0) {
    console.log('🚨 CRITICAL: Security gaps detected! DO NOT DEPLOY');
    console.log(`   ${falseNegatives} attacks bypassed detection`);
    console.log('   Fix false negatives before deploying');
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT: Too many false positives');
    console.log(`   Pass rate: ${passRate}%`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Save detailed results
  fs.writeFileSync(
    'scripts/test-results-comprehensive.json',
    JSON.stringify({
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalTests - totalPassed,
        passRate: parseFloat(passRate),
        falsePositives,
        falseNegatives
      },
      categoryResults: results,
      falsePositiveDetails,
      falseNegativeDetails
    }, null, 2)
  );
  
  console.log('📄 Detailed results saved to: scripts/test-results-comprehensive.json\n');
}

runTests().catch(console.error);
