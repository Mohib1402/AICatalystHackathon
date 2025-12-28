import { riskAnalyzer } from '../lib/risk-analyzer';
import { adversarialEdgeCases } from './adversarial-edge-cases';

interface TestResult {
  id: string;
  prompt: string;
  category: string;
  expectedRisk: string;
  actualScore: number;
  actualRisk: string;
  passed: boolean;
  description: string;
}

async function testAdversarialCases() {
  console.log('🔍 Testing 30 Adversarial Edge Cases...\n');
  console.log('=' .repeat(80));

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of adversarialEdgeCases) {
    const analysis = await riskAnalyzer.analyzePrompt(testCase.prompt);
    
    const riskLevelMap: { [key: string]: string } = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    const actualRisk = analysis.riskLevel.toLowerCase();
    const expectedRisk = testCase.expectedRisk.toLowerCase();
    
    // For critical/high expected, we need at least high detection
    const isPassed = 
      (expectedRisk === 'critical' && (actualRisk === 'critical' || actualRisk === 'high')) ||
      (expectedRisk === 'high' && (actualRisk === 'critical' || actualRisk === 'high')) ||
      (expectedRisk === 'medium' && actualRisk !== 'low') ||
      (actualRisk === expectedRisk);

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      id: testCase.id,
      prompt: testCase.prompt,
      category: testCase.category,
      expectedRisk: testCase.expectedRisk,
      actualScore: analysis.riskScore,
      actualRisk,
      passed: isPassed,
      description: testCase.description,
    });
  }

  console.log('\n📊 Adversarial Test Results:\n');
  console.log(`Total Tests: ${adversarialEdgeCases.length}`);
  console.log(`✅ Passed: ${passed}/${adversarialEdgeCases.length} (${((passed/adversarialEdgeCases.length)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed}/${adversarialEdgeCases.length}\n`);

  console.log('=' .repeat(80));
  console.log('\n🚨 FAILED EDGE CASES (Detection Gaps):\n');
  
  const failures = results.filter(r => !r.passed);
  if (failures.length === 0) {
    console.log('✅ All adversarial cases detected successfully!\n');
  } else {
    failures.forEach((result, idx) => {
      console.log(`${idx + 1}. [${result.id}] ${result.category}`);
      console.log(`   Prompt: "${result.prompt.substring(0, 70)}..."`);
      console.log(`   Expected: ${result.expectedRisk}, Got: ${result.actualRisk} (score: ${result.actualScore})`);
      console.log(`   Gap: ${result.description}`);
      console.log('');
    });
  }

  console.log('=' .repeat(80));
  console.log('\n💡 Detection Gap Analysis:\n');
  
  const gapsByCategory: { [key: string]: number } = {};
  failures.forEach(f => {
    gapsByCategory[f.category] = (gapsByCategory[f.category] || 0) + 1;
  });

  Object.entries(gapsByCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count} gaps`);
    });

  console.log('\n' + '='.repeat(80));
  
  return {
    total: adversarialEdgeCases.length,
    passed,
    failed,
    failures,
    accuracy: (passed / adversarialEdgeCases.length) * 100,
  };
}

testAdversarialCases()
  .then(results => {
    if (results.failed > 0) {
      console.log(`\n⚠️  FOUND ${results.failed} DETECTION GAPS - Need to strengthen patterns\n`);
      process.exit(1);
    } else {
      console.log('\n🎉 All adversarial cases handled - System is robust!\n');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
