import { expect, test } from '../../fixtures/test';
import { addBug, newBugId, parseBugs, type BugEntry } from '../../fixtures/bug-list';

const existing: Record<string, BugEntry> = {
  'issue-2026-11-25-49350': { title: 'First', priority: 'medium', status: 'open' },
  'issue-2026-11-25-35712': { title: 'Second', priority: 'low', status: 'fixed' },
};

test.describe('newBugId', () => {
  test('is issue-, the given day, then 5 digits padded with zeros', () => {
    expect(newBugId(new Date(2026, 10, 27), [], () => 4821)).toBe('issue-2026-11-27-04821');
  });

  test('draws again when the id is already taken', () => {
    const draws = [49350, 777];

    const id = newBugId(new Date(2026, 10, 25), Object.keys(existing), () => draws.shift() ?? 0);

    expect(id).toBe('issue-2026-11-25-00777');
  });

  test('always passes the bugs.json id check', () => {
    const id = newBugId(new Date(), [], () => 99999);

    expect(() => parseBugs({ [id]: { title: 't', priority: 'low', status: 'open' } })).not.toThrow();
  });
});

test.describe('addBug', () => {
  test('appends the bug as open, after the existing ones', () => {
    const bugs = addBug(existing, 'issue-2026-11-27-04821', { title: 'Third', priority: 'high', module: 'cart' });

    expect(Object.keys(bugs)).toEqual(['issue-2026-11-25-49350', 'issue-2026-11-25-35712', 'issue-2026-11-27-04821']);
    expect(bugs['issue-2026-11-27-04821']).toEqual({ title: 'Third', priority: 'high', status: 'open', module: 'cart' });
  });

  test('rejects an id that is already used', () => {
    expect(() => addBug(existing, 'issue-2026-11-25-49350', { title: 'Dup', priority: 'low' }))
      .toThrow('bugs.json already has "issue-2026-11-25-49350"');
  });

  test('rejects an entry bugs.json would reject', () => {
    expect(() => addBug(existing, 'issue-2026-11-27-04821', { title: '', priority: 'low' }))
      .toThrow('bugs.json: "issue-2026-11-27-04821".title must be a non-empty string');
  });
});
