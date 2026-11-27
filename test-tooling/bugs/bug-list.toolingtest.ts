import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addBug, newBugId, parseBugs, type BugEntry } from './bug-list';

const ID = 'issue-2026-11-25-00001';

const existing: Record<string, BugEntry> = {
  'issue-2026-11-25-49350': { title: 'First', priority: 'medium', status: 'open' },
  'issue-2026-11-25-35712': { title: 'Second', priority: 'low', status: 'fixed' },
};

test('parseBugs rejects an id that is not issue-<year>-<month>-<day>-<5 digits>', () => {
  assert.throws(() => parseBugs({ 'item-404-empty-body': { title: 't', priority: 'low', status: 'open' } }),
    { message: /bugs\.json: "item-404-empty-body" must be named issue-YYYY-MM-DD-NNNNN/ });
});

test('parseBugs rejects an entry with an invalid status', () => {
  assert.throws(() => parseBugs({ [ID]: { title: 't', priority: 'low', status: 'closed' } }),
    { message: `bugs.json: "${ID}".status must be "open" or "fixed"` });
});

test('parseBugs rejects an entry without a title', () => {
  assert.throws(() => parseBugs({ [ID]: { priority: 'low', status: 'open' } }), { message: new RegExp(`"${ID}"\\.title`) });
});

test('parseBugs rejects an unknown field', () => {
  assert.throws(() => parseBugs({ [ID]: { title: 't', priority: 'low', status: 'open', notes: 'n' } }),
    { message: `bugs.json: "${ID}".notes is not a known field` });
});

test('parseBugs keeps the fields in file order', () => {
  const parsed = parseBugs({ [ID]: { status: 'open', title: 't', module: 'item', priority: 'low' } });

  assert.deepEqual(Object.keys(parsed[ID] ?? {}), ['status', 'title', 'module', 'priority']);
});

test('newBugId is issue-, the given day, then 5 digits padded with zeros', () => {
  assert.equal(newBugId(new Date(2026, 10, 27), [], () => 4821), 'issue-2026-11-27-04821');
});

test('newBugId draws again when the id is already taken', () => {
  const draws = [49350, 777];

  const id = newBugId(new Date(2026, 10, 25), Object.keys(existing), () => draws.shift() ?? 0);

  assert.equal(id, 'issue-2026-11-25-00777');
});

test('newBugId always passes the bugs.json id check', () => {
  const id = newBugId(new Date(), [], () => 99999);

  assert.doesNotThrow(() => parseBugs({ [id]: { title: 't', priority: 'low', status: 'open' } }));
});

test('addBug appends the bug as open, after the existing ones', () => {
  const bugs = addBug(existing, 'issue-2026-11-27-04821', { title: 'Third', priority: 'high', module: 'cart' });

  assert.deepEqual(Object.keys(bugs), ['issue-2026-11-25-49350', 'issue-2026-11-25-35712', 'issue-2026-11-27-04821']);
  assert.deepEqual(bugs['issue-2026-11-27-04821'], { title: 'Third', priority: 'high', status: 'open', module: 'cart' });
});

test('addBug rejects an id that is already used', () => {
  assert.throws(() => addBug(existing, 'issue-2026-11-25-49350', { title: 'Dup', priority: 'low' }),
    { message: 'bugs.json already has "issue-2026-11-25-49350"' });
});

test('addBug rejects an entry bugs.json would reject', () => {
  assert.throws(() => addBug(existing, 'issue-2026-11-27-04821', { title: '', priority: 'low' }),
    { message: 'bugs.json: "issue-2026-11-27-04821".title must be a non-empty string' });
});
