import { expect, test } from '../../fixtures/test';
import type { BugEntry } from '../../fixtures/known-bug';
import { applyBugUpdates, suggestBugUpdates } from '../../reporters/bug-sync';
import type { KnownBugRecord } from '../../reporters/known-bugs-summary';

const bugs: Record<string, BugEntry> = {
  o1: { title: 'Open one', priority: 'low', status: 'open' },
  o2: { title: 'Open two', priority: 'low', status: 'open' },
  f1: { title: 'Fixed one', priority: 'low', status: 'fixed' },
  f2: { title: 'Fixed two', priority: 'low', status: 'fixed' },
};

const record = (bugId: string, outcome: KnownBugRecord['outcome'], testTitle = 'T'): KnownBugRecord =>
  ({ bugId, outcome, test: testTitle });

test.describe('suggestBugUpdates', () => {
  test('suggests marking an open bug fixed when every test sees it fixed', () => {
    const suggestions = suggestBugUpdates([record('o1', 'looks-fixed', 'A'), record('o1', 'looks-fixed', 'B')], bugs);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ bugId: 'o1', action: 'mark-fixed', tests: ['A', 'B'] });
  });

  test('flags a conflict when tests disagree', () => {
    const suggestions = suggestBugUpdates([record('o1', 'looks-fixed'), record('o1', 'present')], bugs);

    expect(suggestions).toMatchObject([{ bugId: 'o1', action: 'conflict' }]);
  });

  test('suggests reopening a fixed bug that is back', () => {
    expect(suggestBugUpdates([record('f1', 'regressed')], bugs)).toMatchObject([{ bugId: 'f1', action: 'reopen' }]);
  });

  test('suggests removing a stale wrapper', () => {
    expect(suggestBugUpdates([record('f2', 'stale')], bugs)).toMatchObject([{ bugId: 'f2', action: 'remove-wrapper' }]);
  });

  test('says nothing about bugs the run did not reach', () => {
    const suggestions = suggestBugUpdates([record('o1', 'present'), record('unknown', 'looks-fixed')], bugs);

    expect(suggestions).toEqual([]);
  });
});

test.describe('applyBugUpdates', () => {
  test('applies only status changes', () => {
    const before = structuredClone(bugs);
    const suggestions = suggestBugUpdates(
      [record('o1', 'looks-fixed'), record('f1', 'regressed'), record('f2', 'stale')],
      bugs,
    );

    const after = applyBugUpdates(bugs, suggestions);

    expect(after.o1?.status).toBe('fixed');
    expect(after.f1?.status).toBe('open');
    expect(after.f2).toEqual(bugs.f2);
    expect(Object.keys(after)).toEqual(Object.keys(bugs));
    expect(bugs, 'the input is not mutated').toEqual(before);
  });
});
