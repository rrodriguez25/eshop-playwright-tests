import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BugEntry } from './bug-list';
import { KnownBugCollector, parseKnownBugAnnotation, summarizeKnownBugs, type KnownBugRecord } from './summary';

const bug = (title: string): BugEntry => ({ title, priority: 'low', status: 'open' });
const knownBugAnnotation = (description: string) => ({ type: 'known-bug', description });

test('parses a known-bug annotation', () => {
  assert.deepEqual(parseKnownBugAnnotation('issue-2026-11-25-49350: looks-fixed'),
    { bugId: 'issue-2026-11-25-49350', outcome: 'looks-fixed' });
});

test('ignores a malformed annotation', () => {
  assert.equal(parseKnownBugAnnotation('issue-2026-11-25-49350: maybe'), undefined);
  assert.equal(parseKnownBugAnnotation('nothing'), undefined);
});

test('a later attempt replaces an earlier one', () => {
  const collector = new KnownBugCollector();

  collector.record('t1', 'T1', [knownBugAnnotation('x: regressed')]);
  collector.record('t1', 'T1', [knownBugAnnotation('x: stale')]);

  assert.deepEqual(collector.records(), [{ bugId: 'x', outcome: 'stale', test: 'T1' }]);
});

test('lists every known bug a test reports', () => {
  const collector = new KnownBugCollector();

  collector.record('t1', 'T1', [
    knownBugAnnotation('a: present'),
    knownBugAnnotation('b: looks-fixed'),
    { type: 'issue', description: 'unrelated' },
  ]);

  assert.deepEqual(collector.records(), [
    { bugId: 'a', outcome: 'present', test: 'T1' },
    { bugId: 'b', outcome: 'looks-fixed', test: 'T1' },
  ]);
});

test('summarizes by outcome, most urgent first', () => {
  const records: KnownBugRecord[] = [
    { bugId: 'p', outcome: 'present', test: 'Present test' },
    { bugId: 's', outcome: 'stale', test: 'Stale test' },
    { bugId: 'l', outcome: 'looks-fixed', test: 'Looks fixed test' },
    { bugId: 'r', outcome: 'regressed', test: 'Regressed test' },
  ];
  const bugs = { p: bug('P title'), s: bug('S title'), l: bug('L title'), r: bug('R title') };

  const summary = summarizeKnownBugs(records, bugs);

  assert.ok(summary.startsWith('Known bugs'));
  const headings = ['Back after a fix', 'Looks fixed', 'Stale wrappers', 'Still present'].map(h => summary.indexOf(h));
  assert.ok(headings.every(index => index >= 0), 'every heading is present');
  assert.deepEqual([...headings].sort((a, b) => a - b), headings);
  assert.match(summary, /r {2}R title {2}\(Regressed test\)/);
});

test('summary is empty without records', () => {
  assert.equal(summarizeKnownBugs([], {}), '');
});

test('leaves out bugs that are not in the list', () => {
  assert.equal(summarizeKnownBugs([{ bugId: 'demo-open', outcome: 'present', test: 'T' }], {}), '');
});
