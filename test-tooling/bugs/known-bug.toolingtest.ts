import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { before, test } from 'node:test';

/** One probe test's final result: `expected` (passed, or an expected failure) or `unexpected`. */
type ProbeResult = { status: string; annotations: string[]; errors: string[] };

const results = new Map<string, ProbeResult>();

/** Runs probe/known-bug.probe.ts in its own Playwright process and keeps each test's result. */
before(() => {
  const cli = require.resolve('@playwright/test/cli');
  const config = path.join(__dirname, 'probe', 'playwright.config.ts');
  const run = spawnSync(process.execPath, [cli, 'test', '-c', config], { encoding: 'utf8' });
  collect(JSON.parse(run.stdout));
});

function collect(node: unknown): void {
  if (typeof node !== 'object' || node === null) return;
  if ('title' in node && typeof node.title === 'string' && 'tests' in node && Array.isArray(node.tests)) {
    const [first] = node.tests;
    if (isRecord(first) && typeof first.status === 'string' && Array.isArray(first.annotations) && Array.isArray(first.results)) {
      results.set(node.title, {
        status: first.status,
        annotations: first.annotations.flatMap(a => (isRecord(a) && a.type === 'known-bug' && typeof a.description === 'string' ? [a.description] : [])),
        errors: first.results.flatMap(r => (isRecord(r) && Array.isArray(r.errors) ? r.errors : []))
          .flatMap(e => (isRecord(e) ? [String(e.message ?? e.value ?? '')] : [])),
      });
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(collect);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function result(title: string): ProbeResult {
  const found = results.get(title);
  assert.ok(found, `probe test "${title}" did not run`);
  return found;
}

test('an open bug that still fails is an expected failure, reported present', () => {
  const { status, annotations, errors } = result('open bug that still fails');

  assert.equal(status, 'expected');
  assert.deepEqual(annotations, ['probe-open: present']);
  assert.match(errors.join('\n'), /^Error: still broken/);
});

test('an open bug that passes is reported looks-fixed and the test passes', () => {
  assert.deepEqual(result('open bug that passes'), { status: 'expected', annotations: ['probe-open: looks-fixed'], errors: [] });
});

test('a fixed bug that fails again is a real failure, reported regressed', () => {
  const { status, annotations } = result('fixed bug that fails again');

  assert.equal(status, 'unexpected');
  assert.deepEqual(annotations, ['probe-fixed: regressed']);
});

test('a fixed bug that passes is reported stale and the test passes', () => {
  assert.deepEqual(result('fixed bug that passes'), { status: 'expected', annotations: ['probe-fixed: stale'], errors: [] });
});

test('rethrows whatever the callback throws', () => {
  const { status, errors } = result('a thrown non-Error');

  assert.equal(status, 'unexpected');
  assert.match(errors.join('\n'), /plain string/);
});

test('rejects an unknown bug id', () => {
  const { status, errors } = result('an unknown bug id');

  assert.equal(status, 'unexpected');
  assert.match(errors.join('\n'), /Unknown bug id "no-such-bug"/);
});

test('an earlier unrelated failure is not excused by a present bug', () => {
  assert.equal(result('a soft failure before a present bug').status, 'unexpected');
});

test('a soft failure inside the callback counts as the bug being present', () => {
  const { status, annotations } = result('a soft failure inside the callback');

  assert.equal(status, 'expected');
  assert.deepEqual(annotations, ['probe-open: present']);
});
