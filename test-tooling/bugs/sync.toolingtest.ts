import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BugEntry } from './bug-list';
import type { KnownBugRecord } from './summary';
import { applyBugUpdates, parseKnownBugsReport, suggestBugUpdates } from './sync';

const bugs: Record<string, BugEntry> = {
  o1: { title: 'Open one', priority: 'low', status: 'open' },
  o2: { title: 'Open two', priority: 'low', status: 'open' },
  f1: { title: 'Fixed one', priority: 'low', status: 'fixed' },
  f2: { title: 'Fixed two', priority: 'low', status: 'fixed' },
};

const record = (bugId: string, outcome: KnownBugRecord['outcome'], testTitle = 'T'): KnownBugRecord =>
  ({ bugId, outcome, test: testTitle });

test('suggests marking an open bug fixed when every test sees it fixed', () => {
  const suggestions = suggestBugUpdates([record('o1', 'looks-fixed', 'A'), record('o1', 'looks-fixed', 'B')], bugs);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.action, 'mark-fixed');
  assert.deepEqual(suggestions[0]?.tests, ['A', 'B']);
});

test('flags a conflict when tests disagree', () => {
  const suggestions = suggestBugUpdates([record('o1', 'looks-fixed'), record('o1', 'present')], bugs);

  assert.deepEqual(suggestions.map(s => [s.bugId, s.action]), [['o1', 'conflict']]);
});

test('suggests reopening a fixed bug that is back', () => {
  assert.deepEqual(suggestBugUpdates([record('f1', 'regressed')], bugs).map(s => s.action), ['reopen']);
});

test('suggests reopening a fixed bug that is back in one test and stale in another', () => {
  const suggestions = suggestBugUpdates([record('f1', 'stale', 'A'), record('f1', 'regressed', 'B')], bugs);

  assert.deepEqual(suggestions.map(s => s.action), ['reopen']);
});

test('suggests removing a stale wrapper', () => {
  assert.deepEqual(suggestBugUpdates([record('f2', 'stale')], bugs).map(s => s.action), ['remove-wrapper']);
});

test('says nothing about bugs the run did not reach', () => {
  assert.deepEqual(suggestBugUpdates([record('o1', 'present'), record('unknown', 'looks-fixed')], bugs), []);
});

test('applies only status changes', () => {
  const before = structuredClone(bugs);
  const suggestions = suggestBugUpdates([record('o1', 'looks-fixed'), record('f1', 'regressed'), record('f2', 'stale')], bugs);

  const after = applyBugUpdates(bugs, suggestions);

  assert.equal(after.o1?.status, 'fixed');
  assert.equal(after.f1?.status, 'open');
  assert.deepEqual(after.f2, bugs.f2);
  assert.deepEqual(Object.keys(after), Object.keys(bugs));
  assert.deepEqual(bugs, before, 'the input is not mutated');
});

test('reads a known-bugs report', () => {
  const report = parseKnownBugsReport({ status: 'passed', records: [{ bugId: 'o1', outcome: 'present', test: 'T' }] });

  assert.deepEqual(report, { status: 'passed', records: [{ bugId: 'o1', outcome: 'present', test: 'T' }] });
});

test('rejects a report with an unknown outcome', () => {
  assert.throws(() => parseKnownBugsReport({ status: 'passed', records: [{ bugId: 'o1', outcome: 'maybe', test: 'T' }] }),
    { message: /invalid record in the known-bugs report/ });
});

test('rejects something that is not a report', () => {
  assert.throws(() => parseKnownBugsReport([]), { message: /not a known-bugs report/ });
});
