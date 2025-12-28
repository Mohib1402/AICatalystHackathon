import { riskAnalyzer } from '../lib/risk-analyzer';
import * as fs from 'fs';
import * as path from 'path';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║        Edge Case Security Testing System                ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

interface EdgeCaseTest {
  prompt: string;
  expectedRisk: string;
  expectedScore?: number;
  expectedCategory?: string;
  description: string;
}

interface EdgeCaseCategory {
  category: string;
  description: string;
  tests: EdgeCaseTest[];
}

interface CategoryResults {
  category: string;
  description: string;
  totalTests: number;
  passed: number;
  failed: number;
  falsePositives: number;
  falseNegatives: number;
  failures: Array<{
    test: EdgeCaseTest;
    result: any;
    reason: string;
  }>;
}

async function runEdgeCaseTests() {
  const datasetPath = path.join(__dirname, 'edge-case-dataset.json');
  const categories: EdgeCaseCategory[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  const categoryResults: CategoryResults[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalFalsePositives = 0;
  let totalFalseNegatives = 0;

  console.log(`Testing ${categories.length} edge case categories...\n`);
  console.log('═'.repeat(80));

  for (const category of categories) {
    console.log(`\n📁 Category: ${category.category}`);
    console.log(`   ${category.description}`);
    console.log('─'.repeat(80));

    let categoryPassed = 0;
    let categoryFailed = 0;
    let categoryFP = 0;
    let categoryFN = 0;
    const failures: CategoryResults['failures'] = [];

    for (const testCase of category.tests) {
      totalTests++;
      const result = await riskAnalyzer.analyzePrompt(testCase.prompt);
      
      let testPassed = true;
      let failureReason = '';
      let isFalsePositive = false;
      let isFalseNegative = false;

      // Check risk level expectations
      if (testCase.expectedRisk === 'low' && result.riskLevel !== 'low') {
        testPassed = false;
        isFalsePositive = true;
        categoryFP++;
        totalFalsePositives++;
        failureReason = `FALSE POSITIVE: Expected low risk, got ${result.riskLevel} (score: ${result.riskScore})`;
      } else if (testCase.expectedRisk === 'critical' && result.riskLevel !== 'critical') {
        testPassed = false;
        isFalseNegative = true;
        categoryFN++;
        totalFalseNegatives++;
        failureReason = `FALSE NEGATIVE: Expected critical risk, got ${result.riskLevel} (score: ${result.riskScore})`;
      } else if (testCase.expectedRisk === 'high' && result.riskLevel !== 'high' && result.riskLevel !== 'critical') {
        testPassed = false;
        failureReason = `Expected high risk, got ${result.riskLevel} (score: ${result.riskScore})`;
      } else if (testCase.expectedRisk === 'medium' && result.riskLevel === 'low') {
        testPassed = false;
        failureReason = `Expected medium risk, got ${result.riskLevel} (score: ${result.riskScore})`;
      }

      // Check category expectations
      if (testCase.expectedCategory && result.categories.size > 0) {
        const hasExpectedCategory = Array.from(result.categories).some(
          cat => cat === testCase.expectedCategory
        );
        if (!hasExpectedCategory) {
          testPassed = false;
          failureReason = `Expected category ${testCase.expectedCategory}, got ${Array.from(result.categories).join(', ') || 'none'}`;
        }
      }

      const icon = testPassed ? '✅' : (isFalsePositive ? '⚠️ ' : (isFalseNegative ? '🚨' : '❌'));
      const shortPrompt = testCase.prompt.substring(0, 70) + (testCase.prompt.length > 70 ? '...' : '');
      
      console.log(`${icon} ${testCase.description}`);
      console.log(`   Prompt: "${shortPrompt}"`);
      console.log(`   Risk: ${result.riskLevel.toUpperCase()} (${result.riskScore}/100) | Block: ${result.shouldBlock}`);
      
      if (result.detectedPatterns.length > 0) {
        const patternNames = result.detectedPatterns.slice(0, 2).map(p => p.pattern.name).join(', ');
        const more = result.detectedPatterns.length > 2 ? ` +${result.detectedPatterns.length - 2}` : '';
        console.log(`   Patterns: ${patternNames}${more}`);
      }

      if (!testPassed) {
        console.log(`   ❗ ${failureReason}`);
        failures.push({ test: testCase, result, reason: failureReason });
        categoryFailed++;
        totalFailed++;
      } else {
        categoryPassed++;
        totalPassed++;
      }
      console.log('');
    }

    categoryResults.push({
      category: category.category,
      description: category.description,
      totalTests: category.tests.length,
      passed: categoryPassed,
      failed: categoryFailed,
      falsePositives: categoryFP,
      falseNegatives: categoryFN,
      failures,
    });

    console.log(`Category Summary: ${categoryPassed}/${category.tests.length} passed`);
    if (categoryFP > 0) console.log(`   ⚠️  False Positives: ${categoryFP}`);
    if (categoryFN > 0) console.log(`   🚨 False Negatives: ${categoryFN}`);
  }

  // Overall Summary
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('EDGE CASE TEST SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}/${totalTests} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log(`❌ Failed: ${totalFailed}/${totalTests}`);
  console.log(`⚠️  False Positives: ${totalFalsePositives} (legitimate queries blocked)`);
  console.log(`🚨 False Negatives: ${totalFalseNegatives} (attacks not detected)\n`);

  // Category Breakdown
  console.log('CATEGORY BREAKDOWN:');
  console.log('─'.repeat(80));
  for (const catResult of categoryResults) {
    const passRate = Math.round((catResult.passed / catResult.totalTests) * 100);
    const status = catResult.falseNegatives === 0 ? '✅' : '🚨';
    console.log(`${status} ${catResult.category}: ${catResult.passed}/${catResult.totalTests} (${passRate}%)`);
    if (catResult.falsePositives > 0) {
      console.log(`   ⚠️  ${catResult.falsePositives} false positives`);
    }
    if (catResult.falseNegatives > 0) {
      console.log(`   🚨 ${catResult.falseNegatives} false negatives (CRITICAL!)`);
    }
  }

  // Critical Issues
  if (totalFalseNegatives > 0) {
    console.log('\n🚨 CRITICAL SECURITY GAPS:');
    console.log('─'.repeat(80));
    for (const catResult of categoryResults) {
      if (catResult.falseNegatives > 0) {
        console.log(`\n${catResult.category}:`);
        catResult.failures
          .filter(f => f.reason.includes('FALSE NEGATIVE'))
          .forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${f.test.description}`);
            console.log(`     Attack: "${f.test.prompt.substring(0, 80)}..."`);
            console.log(`     Got: ${f.result.riskLevel} (${f.result.riskScore}) - Expected: ${f.test.expectedRisk}`);
            console.log(`     Patterns detected: ${f.result.detectedPatterns.length ? f.result.detectedPatterns.map((p: any) => p.pattern.name).join(', ') : 'NONE'}`);
          });
      }
    }
  }

  // Weakest Categories
  console.log('\n📊 WEAKEST CATEGORIES (Need Improvement):');
  console.log('─'.repeat(80));
  const sortedByFailures = [...categoryResults].sort((a, b) => 
    (b.failed / b.totalTests) - (a.failed / a.totalTests)
  );
  sortedByFailures.slice(0, 5).forEach((cat, idx) => {
    const failRate = Math.round((cat.failed / cat.totalTests) * 100);
    console.log(`${idx + 1}. ${cat.category}: ${failRate}% failure rate (${cat.failed}/${cat.totalTests} failed)`);
  });

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('─'.repeat(80));
  
  const recommendations: string[] = [];
  
  for (const catResult of categoryResults) {
    if (catResult.category === 'OBFUSCATION_ENCODING' && catResult.falseNegatives > 0) {
      recommendations.push('Add encoding detection: hex (\\x), unicode (\\u), base64 patterns');
    }
    if (catResult.category === 'MULTILINGUAL_ATTACKS' && catResult.falseNegatives > 0) {
      recommendations.push('Add multilingual attack patterns for non-English languages');
    }
    if (catResult.category === 'INDIRECT_ATTACKS' && catResult.falseNegatives > 0) {
      recommendations.push('Add multi-step attack detection (function definitions, completions)');
    }
    if (catResult.category === 'FORMAT_EXPLOITS' && catResult.falseNegatives > 0) {
      recommendations.push('Add structured format detection (JSON, XML, markdown injection)');
    }
    if (catResult.category === 'CONTEXT_MANIPULATION' && catResult.falseNegatives > 0) {
      recommendations.push('Add delimiter injection patterns (---END, <SYSTEM>, etc.)');
    }
  }

  if (recommendations.length === 0) {
    console.log('✅ No critical improvements needed! System handling edge cases well.');
  } else {
    recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
  }

  // Final Verdict
  console.log('\n');
  console.log('═'.repeat(80));
  const overallPassRate = Math.round((totalPassed / totalTests) * 100);
  if (totalFalseNegatives === 0 && overallPassRate >= 90) {
    console.log('🎉 EXCELLENT: System ready for production deployment!');
    console.log(`   Pass rate: ${overallPassRate}% with 0 false negatives`);
    return 0;
  } else if (totalFalseNegatives === 0 && overallPassRate >= 80) {
    console.log('✅ GOOD: System handling edge cases reasonably well');
    console.log(`   Pass rate: ${overallPassRate}% with 0 false negatives`);
    console.log('   Consider improvements for better coverage');
    return 0;
  } else if (totalFalseNegatives > 0) {
    console.log('🚨 CRITICAL: Security gaps detected! DO NOT DEPLOY');
    console.log(`   ${totalFalseNegatives} attacks bypassed detection`);
    console.log('   Fix false negatives before deploying');
    return 2;
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT: Too many false positives');
    console.log(`   Pass rate: ${overallPassRate}%`);
    return 1;
  }
}

runEdgeCaseTests()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Error running edge case tests:', err);
    process.exit(1);
  });
