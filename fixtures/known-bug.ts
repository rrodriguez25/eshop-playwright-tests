import { test } from '@playwright/test';
import bugsJson from '../data/bugs.json';

/** The annotation type `knownBug` adds to a test, read by the known-bugs reporter. */
export const KNOWN_BUG_ANNOTATION = 'known-bug';

/** What a run found for a known bug. */
export type KnownBugOutcome = 'present' | 'looks-fixed' | 'regressed' | 'stale';

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

/** The id of a bug in `data/bugs.json`. A misspelled id doesn't compile. */
export type BugId = keyof typeof bugsJson;

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
    bugs[id] = entry;
  }
  return bugs;
}

/**
 * Builds `knownBug` over a list of bugs. The wrapper runs the steps that show the bug and records
 * the outcome as a `known-bug` annotation:
 *
 * - open bug, steps fail: `present`; the test becomes an expected failure, so the run stays green
 * - open bug, steps pass: `looks-fixed`; the test continues
 * - fixed bug, steps fail: `regressed`; a real failure
 * - fixed bug, steps pass: `stale`; the test continues, and the wrapper can be removed
 */
export function createKnownBug<Id extends string>(bugs: Record<Id, BugEntry>) {
  return async (bugId: Id, callback: () => Promise<void>): Promise<void> => {
    const entry: BugEntry | undefined = Object.hasOwn(bugs, bugId) ? bugs[bugId] : undefined;
    if (entry === undefined) {
      throw new Error(`Unknown bug id "${bugId}": add it to data/bugs.json first`);
    }
    await test.step(`Known bug ${bugId}: ${entry.title}`, async () => {
      let failure: { error: unknown } | undefined;
      try {
        await callback();
      } catch (error) {
        failure = { error };
      }
      const outcome = outcomeFor(entry.status, failure !== undefined);
      test.info().annotations.push({ type: KNOWN_BUG_ANNOTATION, description: `${bugId}: ${outcome}` });
      if (failure !== undefined) {
        if (entry.status === 'open') {
          test.info().fail();
        }
        throw failure.error;
      }
    });
  };
}

function outcomeFor(status: BugEntry['status'], failed: boolean): KnownBugOutcome {
  if (status === 'open') return failed ? 'present' : 'looks-fixed';
  return failed ? 'regressed' : 'stale';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(id: string, field: string, value: unknown, allowed: readonly T[]): T {
  const match = allowed.find(option => option === value);
  if (match === undefined) {
    throw new Error(`bugs.json: "${id}".${field} must be ${allowed.map(option => `"${option}"`).join(' or ')}`);
  }
  return match;
}

function hasEveryBugId(parsed: Record<string, BugEntry>): parsed is Record<BugId, BugEntry> {
  return Object.keys(bugsJson).every(id => Object.hasOwn(parsed, id));
}

const parsedBugs = parseBugs(bugsJson);
if (!hasEveryBugId(parsedBugs)) {
  throw new Error('bugs.json: parsed entries do not match the file');
}

/** The validated contents of `data/bugs.json`. */
export const bugs: Record<BugId, BugEntry> = parsedBugs;

/**
 * Wraps the steps of a test that show a known eShop bug. Wrap only those steps, and put the call
 * last in the test: nothing after a present bug runs.
 *
 * ```ts
 * await knownBug('item-404-empty-body', async () => {
 *   await itemPage.goto({ itemId: MISSING_ITEM_ID });
 *   await expect(itemPage.notFoundHeading).toBeVisible();
 * });
 * ```
 */
export const knownBug = createKnownBug(bugs);
