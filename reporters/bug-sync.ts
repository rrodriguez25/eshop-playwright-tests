/**
 * What `pnpm bugs:sync` suggests and applies to `data/bugs.json` after a run. Only type imports,
 * so plain Node can run it from `scripts/sync-bugs.ts`.
 */
import type { BugEntry } from '../fixtures/bug-list';
import type { KnownBugRecord } from './known-bugs-summary';

export type BugSuggestion = {
  bugId: string;
  action: 'mark-fixed' | 'reopen' | 'remove-wrapper' | 'conflict';
  reason: string;
  tests: string[];
};

/**
 * Suggestions per bug, from that bug's own records only, so a partial run says nothing about bugs
 * it didn't reach. Records of bugs not in the list are ignored.
 */
export function suggestBugUpdates(records: KnownBugRecord[], bugs: Record<string, BugEntry>): BugSuggestion[] {
  const byBug = new Map<string, KnownBugRecord[]>();
  for (const record of records) {
    if (!Object.hasOwn(bugs, record.bugId)) continue;
    byBug.set(record.bugId, [...(byBug.get(record.bugId) ?? []), record]);
  }
  const suggestions: BugSuggestion[] = [];
  for (const [bugId, bugRecords] of byBug) {
    const status = bugs[bugId]?.status;
    const tests = bugRecords.map(record => record.test);
    const outcomes = new Set(bugRecords.map(record => record.outcome));
    if (status === 'open' && outcomes.has('looks-fixed')) {
      suggestions.push(outcomes.size === 1
        ? { bugId, action: 'mark-fixed', reason: 'every test that checks it sees it fixed', tests }
        : { bugId, action: 'conflict', reason: 'some tests see it fixed, others still see it', tests });
    } else if (status === 'fixed' && outcomes.has('regressed')) {
      suggestions.push({ bugId, action: 'reopen', reason: 'marked fixed, but a test sees it again', tests });
    } else if (status === 'fixed' && outcomes.size === 1 && outcomes.has('stale')) {
      suggestions.push({ bugId, action: 'remove-wrapper', reason: 'fixed and passing; remove its knownBug wrappers', tests });
    }
  }
  return suggestions;
}

/** A copy of `bugs` with the status changes applied: `mark-fixed` and `reopen` only. Key order is kept. */
export function applyBugUpdates(bugs: Record<string, BugEntry>, suggestions: BugSuggestion[]): Record<string, BugEntry> {
  const updated: Record<string, BugEntry> = {};
  for (const [bugId, entry] of Object.entries(bugs)) {
    const suggestion = suggestions.find(candidate => candidate.bugId === bugId);
    if (suggestion?.action === 'mark-fixed') {
      updated[bugId] = { ...entry, status: 'fixed' };
    } else if (suggestion?.action === 'reopen') {
      updated[bugId] = { ...entry, status: 'open' };
    } else {
      updated[bugId] = { ...entry };
    }
  }
  return updated;
}
