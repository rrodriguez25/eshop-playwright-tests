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

test.describe('parseBugs', () => {
  test('rejects an entry with an invalid status', () => {
    expect(() => parseBugs({ x: { title: 't', priority: 'low', status: 'closed' } }))
      .toThrow('bugs.json: "x".status must be "open" or "fixed"');
  });

  test('keeps the fields in file order', () => {
    const parsed = parseBugs({ x: { status: 'open', title: 't', module: 'item', priority: 'low' } });

    expect(Object.keys(parsed.x ?? {})).toEqual(['status', 'title', 'module', 'priority']);
  });

  test('rejects an unknown field', () => {
    expect(() => parseBugs({ x: { title: 't', priority: 'low', status: 'open', notes: 'n' } }))
      .toThrow('bugs.json: "x".notes is not a known field');
  });

  test('rejects an entry without a title', () => {
    expect(() => parseBugs({ x: { priority: 'low', status: 'open' } })).toThrow('bugs.json: "x".title');
  });
});
