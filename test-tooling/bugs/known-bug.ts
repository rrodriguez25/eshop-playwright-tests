import { test } from '@playwright/test';
import bugsJson from './bugs.json';
import { parseBugs, type BugEntry, type KnownBugOutcome } from './bug-list';

/** The annotation type `knownBug` adds to a test, read by the known-bugs reporter. */
export const KNOWN_BUG_ANNOTATION = 'known-bug';

export { KNOWN_BUG_OUTCOMES, parseBugs, type BugEntry, type KnownBugOutcome } from './bug-list';

/** The id of a bug in `test-tooling/bugs/bugs.json`. A misspelled id doesn't compile. */
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
      throw new Error(`Unknown bug id "${bugId}": log it with pnpm bugs:add first`);
    }
    await test.step(`Known bug ${bugId}: ${entry.title}`, async () => {
      const errorsBefore = test.info().errors.length;
      let failure: { error: unknown } | undefined;
      try {
        await callback();
      } catch (error) {
        failure = { error };
      }
      // A soft assertion inside the callback fails without throwing; it still means the bug is there.
      const failed = failure !== undefined || test.info().errors.length > errorsBefore;
      const outcome = outcomeFor(entry.status, failed);
      test.info().annotations.push({ type: KNOWN_BUG_ANNOTATION, description: `${bugId}: ${outcome}` });
      // Only a test with no earlier failure becomes an expected failure: a present bug never excuses
      // another failure that came before it.
      if (failed && entry.status === 'open' && errorsBefore === 0) {
        test.info().fail();
      }
      if (failure !== undefined) {
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

/** The validated contents of `test-tooling/bugs/bugs.json`. */
export const bugs: Record<BugId, BugEntry> = parsedBugs;

/**
 * Wraps the steps of a test that show a known eShop bug. Wrap only those steps, and put the call
 * last in the test: nothing after a present bug runs.
 *
 * ```ts
 * await knownBug('issue-2026-11-25-49350', async () => {
 *   await itemPage.goto({ itemId: MISSING_ITEM_ID });
 *   await expect(itemPage.notFoundHeading).toBeVisible();
 * });
 * ```
 */
export const knownBug = createKnownBug(bugs);
