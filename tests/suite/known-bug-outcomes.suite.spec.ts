import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '../../fixtures/test';

type ProbeResult = { status: string; annotations: { type: string; description?: string }[] };

/**
 * Runs the probes in a separate Playwright run and returns each test's final status: `expected`
 * (an expected failure or a pass) or `unexpected` (a real failure), with its annotations.
 */
function runProbes(): Map<string, ProbeResult> {
  const config = path.join(__dirname, 'known-bug-probe', 'probe.config.ts');
  const cli = require.resolve('@playwright/test/cli');
  const run = spawnSync(process.execPath, [cli, 'test', '-c', config], { encoding: 'utf8' });
  const report: unknown = JSON.parse(run.stdout);
  const results = new Map<string, ProbeResult>();
  collect(report, results);
  return results;
}

function collect(node: unknown, results: Map<string, ProbeResult>): void {
  if (typeof node !== 'object' || node === null) return;
  if ('title' in node && 'tests' in node && Array.isArray(node.tests) && typeof node.title === 'string') {
    const [first] = node.tests;
    if (typeof first === 'object' && first !== null && 'status' in first && 'annotations' in first
      && typeof first.status === 'string' && Array.isArray(first.annotations)) {
      results.set(node.title, { status: first.status, annotations: first.annotations });
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => collect(child, results));
  }
}

test.describe('knownBug final outcomes', () => {
  // One probe run serves every test below.
  test.describe.configure({ mode: 'serial' });
  let results: Map<string, ProbeResult>;

  test.beforeAll(() => {
    results = runProbes();
  });

  test('a present open bug alone is an expected failure', () => {
    expect(results.get('present bug alone')?.status).toBe('expected');
  });

  test('an earlier unrelated failure is not excused by a present bug', () => {
    expect(results.get('soft failure before a present bug')?.status).toBe('unexpected');
  });

  test('a soft failure inside the callback counts as the bug being present', () => {
    const result = results.get('soft failure inside the callback');

    expect(result?.annotations).toContainEqual({ type: 'known-bug', description: 'probe-open: present' });
    expect(result?.status).toBe('expected');
  });
});
