/**
 * The shape of `data/bugs.json` and its validation. No imports, so plain Node can run it
 * (`scripts/sync-bugs.ts`) as well as Playwright.
 */

/** One known eShop bug from `data/bugs.json`. */
export interface BugEntry {
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'fixed';
  module?: string;
  found?: 'mining' | 'writing';
  expected?: string;
  actual?: string;
  source?: string;
}

/** What a run found for a known bug. */
export type KnownBugOutcome = 'present' | 'looks-fixed' | 'regressed' | 'stale';

export const KNOWN_BUG_OUTCOMES: readonly KnownBugOutcome[] = ['present', 'looks-fixed', 'regressed', 'stale'];

/** A bug id: `issue-`, the date the bug was found, then 5 random digits, such as `issue-2026-11-25-49350`. */
const BUG_ID = /^issue-\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{5}$/;

const PRIORITIES = ['high', 'medium', 'low'] as const;
const STATUSES = ['open', 'fixed'] as const;
const FOUND = ['mining', 'writing'] as const;
const OPTIONAL_TEXT = ['module', 'expected', 'actual', 'source'] as const;

/** Validates the contents of `bugs.json`. Throws on the first invalid field, naming the bug and the field. */
export function parseBugs(raw: unknown): Record<string, BugEntry> {
  if (!isRecord(raw)) {
    throw new Error('bugs.json: must be an object keyed by bug id');
  }
  const bugs: Record<string, BugEntry> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!BUG_ID.test(id)) {
      throw new Error(`bugs.json: "${id}" must be named issue-YYYY-MM-DD-NNNNN (the date it was found, then 5 random digits)`);
    }
    if (!isRecord(value)) {
      throw new Error(`bugs.json: "${id}" must be an object`);
    }
    const title = value.title;
    if (typeof title !== 'string' || title.length === 0) {
      throw new Error(`bugs.json: "${id}".title must be a non-empty string`);
    }
    const entry: BugEntry = {
      title,
      priority: oneOf(id, 'priority', value.priority, PRIORITIES),
      status: oneOf(id, 'status', value.status, STATUSES),
    };
    if (value.found !== undefined) {
      entry.found = oneOf(id, 'found', value.found, FOUND);
    }
    for (const field of OPTIONAL_TEXT) {
      const text = value[field];
      if (text === undefined) continue;
      if (typeof text !== 'string') {
        throw new Error(`bugs.json: "${id}".${field} must be a string`);
      }
      entry[field] = text;
    }
    bugs[id] = inFileOrder(id, entry, Object.keys(value));
  }
  return bugs;
}

const KNOWN_FIELDS: readonly (keyof BugEntry)[] = ['title', 'priority', 'status', 'found', ...OPTIONAL_TEXT];

/**
 * The entry with its fields in the order the file has them, so writing it back (`bugs:sync --apply`)
 * changes only what it means to. Rejects fields it doesn't know, which writing back would drop.
 */
function inFileOrder(id: string, entry: BugEntry, fileKeys: string[]): BugEntry {
  const ordered: Partial<BugEntry> = {};
  for (const key of fileKeys) {
    const field = KNOWN_FIELDS.find(known => known === key);
    if (field === undefined) {
      throw new Error(`bugs.json: "${id}".${key} is not a known field`);
    }
    copyField(ordered, entry, field);
  }
  // The required fields are already in `ordered`, so setting them again keeps their position.
  return { ...ordered, title: entry.title, priority: entry.priority, status: entry.status };
}

function copyField<K extends keyof BugEntry>(target: Partial<BugEntry>, source: BugEntry, key: K): void {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(id: string, field: string, value: unknown, allowed: readonly T[]): T {
  const match = allowed.find(option => option === value);
  if (match === undefined) {
    throw new Error(`bugs.json: "${id}".${field} must be ${allowed.map(option => `"${option}"`).join(' or ')}`);
  }
  return match;
}
