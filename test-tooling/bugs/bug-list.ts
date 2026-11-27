/**
 * The shape of `data/bugs.json`, its validation, and new entries. Pure: used by
 * `knownBug`, the reporter, `pnpm bugs:add` and `pnpm bugs:sync`.
 */
import { randomInt } from 'node:crypto';

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

/** A bug being logged: everything but `status`, which starts as `open`. */
export type NewBug = Omit<BugEntry, 'status'>;

/**
 * A new bug id for `day`: `issue-YYYY-MM-DD-` and 5 random digits, drawn again while the id is
 * in `taken`. `random` returns 0 to 99999 and is only replaced in tests.
 */
export function newBugId(day: Date, taken: readonly string[], random: () => number = () => randomInt(0, 100_000)): string {
  const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()].map(part => String(part).padStart(2, '0')).join('-');
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = `issue-${date}-${String(random()).padStart(5, '0')}`;
    if (!taken.includes(id)) return id;
  }
  throw new Error(`Could not find a free bug id for ${date} after 100 draws`);
}

/**
 * `bugs` with `bug` appended under `id` as `open`. Throws if the id is used or the entry is
 * invalid. Takes raw fields (command-line input) as well as a `NewBug`, and validates them as
 * loading `bugs.json` does.
 */
export function addBug(bugs: Record<string, BugEntry>, id: string, bug: NewBug | Record<string, unknown>): Record<string, BugEntry> {
  if (Object.hasOwn(bugs, id)) {
    throw new Error(`bugs.json already has "${id}"`);
  }
  const { title, priority, ...details } = bug;
  const entry = parseBugs({ [id]: { title, priority, status: 'open', ...details } })[id];
  if (entry === undefined) {
    throw new Error(`bugs.json: "${id}" could not be added`);
  }
  return { ...bugs, [id]: entry };
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
