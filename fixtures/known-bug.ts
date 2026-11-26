import { test } from '@playwright/test';
import bugsJson from '../data/bugs.json';
import { parseBugs, type BugEntry, type KnownBugOutcome } from './bug-list';

/** The annotation type `knownBug` adds to a test, read by the known-bugs reporter. */
export const KNOWN_BUG_ANNOTATION = 'known-bug';

export { KNOWN_BUG_OUTCOMES, parseBugs, type BugEntry, type KnownBugOutcome } from './bug-list';

/** The id of a bug in `data/bugs.json`. A misspelled id doesn't compile. */
export type BugId = keyof typeof bugsJson;

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
