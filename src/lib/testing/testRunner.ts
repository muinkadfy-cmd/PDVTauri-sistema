/**
 * Test Runner - Smart Tech
 * Executa testes e gera relatórios
 */

import { logger } from '@/utils/logger';

export interface TestResult {
  name: string;
  ok: boolean;
  durationMs: number;
  details?: string;
  error?: Error;
}

export interface TestSuite {
  name: string;
  tests: Test[];
}

export type Test = () => Promise<void> | void;

/**
 * Executa um teste individual e captura resultado
 */
async function runTest(name: string, testFn: Test): Promise<TestResult> {
  const start = performance.now();
  let ok = false;
  let details: string | undefined;
  let error: Error | undefined;

  try {
    await testFn();
    ok = true;
    details = 'OK';
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err : new Error(String(err));
    details = error.message;
    logger.error(`[TestRunner] Teste falhou: ${name}`, error);
  }

  const durationMs = performance.now() - start;

  return { name, ok, durationMs, details, error };
}

/**
 * Executa todos os testes de uma suite
 */
export async function runTestSuite(suite: TestSuite): Promise<TestResult[]> {
  logger.log(`[TestRunner] Executando suite: ${suite.name} (${suite.tests.length} testes)`);

  const results: TestResult[] = [];

  for (const [index, test] of suite.tests.entries()) {
    const testName = `${suite.name} - Teste ${index + 1}`;
    const result = await runTest(testName, test);
    results.push(result);
  }

  return results;
}

/**
 * Executa múltiplas suites de testes
 */
export async function runAllTests(suites: TestSuite[]): Promise<{
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  };
}> {
  const start = performance.now();
  logger.log(`[TestRunner] Iniciando execução de ${suites.length} suites de testes...`);

  const allResults: TestResult[] = [];

  for (const suite of suites) {
    const suiteResults = await runTestSuite(suite);
    allResults.push(...suiteResults);
  }

  const durationMs = performance.now() - start;
  const passed = allResults.filter(r => r.ok).length;
  const failed = allResults.filter(r => !r.ok).length;

  const summary = {
    total: allResults.length,
    passed,
    failed,
    durationMs
  };

  logger.log(`[TestRunner] Execução concluída:`, summary);
  logger.log(`[TestRunner] Passou: ${passed}/${allResults.length}, Falhou: ${failed}/${allResults.length}`);

  return { results: allResults, summary };
}

/**
 * Formata resultado para exibição
 */
export function formatTestResult(result: TestResult): string {
  const status = result.ok ? '✅ PASS' : '❌ FAIL';
  const time = `${result.durationMs.toFixed(2)}ms`;
  return `${status} [${time}] ${result.name}${result.details ? ` - ${result.details}` : ''}`;
}

/**
 * Formata erro para exibição
 */
export function formatTestError(error: Error | undefined): string {
  if (!error) return '';
  
  let message = error.message;
  if (error.stack) {
    message += `\n${error.stack}`;
  }
  return message;
}
