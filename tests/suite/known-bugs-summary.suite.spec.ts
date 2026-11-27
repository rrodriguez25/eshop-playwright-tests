import { expect, test } from '../../fixtures/test';
import type { BugEntry } from '../../fixtures/known-bug';
import {
  KnownBugCollector,
  parseKnownBugAnnotation,
  summarizeKnownBugs,
  type KnownBugRecord,
} from '../../reporters/known-bugs-summary';

const bug = (title: string): BugEntry => ({ title, priority: 'low', status: 'open' });
const knownBugAnnotation = (description: string) => ({ type: 'known-bug', description });

test.describe('parseKnownBugAnnotation', () => {
  test('parses a known-bug annotation', () => {
    expect(parseKnownBugAnnotation('issue-2026-11-25-49350: looks-fixed'))
      .toEqual({ bugId: 'issue-2026-11-25-49350', outcome: 'looks-fixed' });
  });

  test('ignores a malformed annotation', () => {
    expect(parseKnownBugAnnotation('issue-2026-11-25-49350: maybe')).toBeUndefined();
    expect(parseKnownBugAnnotation('nothing')).toBeUndefined();
  });
});

test.describe('KnownBugCollector', () => {
  test('a later attempt replaces an earlier one', () => {
    const collector = new KnownBugCollector();

    collector.record('t1', 'T1', [knownBugAnnotation('x: regressed')]);
    collector.record('t1', 'T1', [knownBugAnnotation('x: stale')]);

    expect(collector.records()).toEqual([{ bugId: 'x', outcome: 'stale', test: 'T1' }]);
  });

  test('lists every known bug a test reports', () => {
    const collector = new KnownBugCollector();

    collector.record('t1', 'T1', [
      knownBugAnnotation('a: present'),
      knownBugAnnotation('b: looks-fixed'),
      { type: 'issue', description: 'unrelated' },
    ]);

    expect(collector.records()).toEqual([
      { bugId: 'a', outcome: 'present', test: 'T1' },
      { bugId: 'b', outcome: 'looks-fixed', test: 'T1' },
    ]);
  });
});

test.describe('summarizeKnownBugs', () => {
  test('summarizes by outcome, most urgent first', () => {
    const records: KnownBugRecord[] = [
      { bugId: 'p', outcome: 'present', test: 'Present test' },
      { bugId: 's', outcome: 'stale', test: 'Stale test' },
      { bugId: 'l', outcome: 'looks-fixed', test: 'Looks fixed test' },
      { bugId: 'r', outcome: 'regressed', test: 'Regressed test' },
    ];
    const bugs = { p: bug('P title'), s: bug('S title'), l: bug('L title'), r: bug('R title') };

    const summary = summarizeKnownBugs(records, bugs);

    expect(summary.startsWith('Known bugs')).toBe(true);
    const headings = ['Back after a fix', 'Looks fixed', 'Stale wrappers', 'Still present'].map(h => summary.indexOf(h));
    expect(headings.every(index => index >= 0), 'every heading is present').toBe(true);
    expect([...headings].sort((a, b) => a - b)).toEqual(headings);
    expect(summary).toContain('r');
    expect(summary).toContain('R title');
    expect(summary).toContain('Regressed test');
  });

  test('summary is empty without records', () => {
    expect(summarizeKnownBugs([], {})).toBe('');
  });

  test('leaves out bugs that are not in the list', () => {
    expect(summarizeKnownBugs([{ bugId: 'demo-open', outcome: 'present', test: 'T' }], {})).toBe('');
  });
});
