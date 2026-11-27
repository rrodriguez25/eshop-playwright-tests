import { expect, test } from '../../fixtures/test';
import { createKnownBug, parseBugs, type BugEntry } from '../../fixtures/known-bug';

const bugs = {
  'demo-open': { title: 'Open demo bug', priority: 'low', status: 'open' },
  'demo-fixed': { title: 'Fixed demo bug', priority: 'low', status: 'fixed' },
} satisfies Record<string, BugEntry>;

const knownBug = createKnownBug<string>(bugs);
const annotation = (description: string) => ({ type: 'known-bug', description });

test.describe('knownBug', () => {
  test('open bug that still fails ends as an expected failure', async () => {
    await knownBug('demo-open', async () => {
      throw new Error('still broken');
    });
  });

  test('open bug that passes is reported as looks-fixed', async () => {
    await knownBug('demo-open', async () => {});

    expect(test.info().annotations).toContainEqual(annotation('demo-open: looks-fixed'));
    expect(test.info().expectedStatus).toBe('passed');
  });

  test('fixed bug that fails again is a real failure', async () => {
    const run = knownBug('demo-fixed', async () => {
      throw new Error('back again');
    });

    await expect(run).rejects.toThrow('back again');
    expect(test.info().annotations).toContainEqual(annotation('demo-fixed: regressed'));
    expect(test.info().expectedStatus).toBe('passed');
  });

  test('fixed bug that passes is reported as stale', async () => {
    await knownBug('demo-fixed', async () => {});

    expect(test.info().annotations).toContainEqual(annotation('demo-fixed: stale'));
  });

  test('rethrows whatever the callback throws', async () => {
    const run = knownBug('demo-fixed', async () => {
      throw 'plain string';
    });

    await expect(run).rejects.toBe('plain string');
  });

  test('rejects an unknown bug id', async () => {
    await expect(knownBug('no-such-bug', async () => {})).rejects.toThrow('Unknown bug id "no-such-bug"');
  });
});

const ID = 'issue-2026-11-25-00001';

test.describe('parseBugs', () => {
  test('rejects an id that is not issue-<year>-<month>-<day>-<5 digits>', () => {
    expect(() => parseBugs({ 'item-404-empty-body': { title: 't', priority: 'low', status: 'open' } }))
      .toThrow('bugs.json: "item-404-empty-body" must be named issue-YYYY-MM-DD-NNNNN');
  });

  test('rejects an entry with an invalid status', () => {
    expect(() => parseBugs({ [ID]: { title: 't', priority: 'low', status: 'closed' } }))
      .toThrow('bugs.json: "issue-2026-11-25-00001".status must be "open" or "fixed"');
  });

  test('keeps the fields in file order', () => {
    const parsed = parseBugs({ [ID]: { status: 'open', title: 't', module: 'item', priority: 'low' } });

    expect(Object.keys(parsed[ID] ?? {})).toEqual(['status', 'title', 'module', 'priority']);
  });

  test('rejects an unknown field', () => {
    expect(() => parseBugs({ [ID]: { title: 't', priority: 'low', status: 'open', notes: 'n' } }))
      .toThrow('bugs.json: "issue-2026-11-25-00001".notes is not a known field');
  });

  test('rejects an entry without a title', () => {
    expect(() => parseBugs({ [ID]: { priority: 'low', status: 'open' } })).toThrow('bugs.json: "issue-2026-11-25-00001".title');
  });
});
