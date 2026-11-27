/** What `pnpm bugs:sync` suggests and applies to `data/bugs.json` after a run. */
import { KNOWN_BUG_OUTCOMES, isRecord, type BugEntry } from './bug-list';
import type { KnownBugRecord } from './summary';

/** The known-bugs report a run leaves behind, validated. Throws with what is wrong. */
export function parseKnownBugsReport(raw: unknown): { status: string; records: KnownBugRecord[] } {
  if (!isRecord(raw) || typeof raw.status !== 'string' || !Array.isArray(raw.records)) {
    throw new Error('not a known-bugs report: expected { status, records }');
  }
  const records: KnownBugRecord[] = [];
  for (const item of raw.records) {
    const outcome = isRecord(item) ? KNOWN_BUG_OUTCOMES.find(option => option === item.outcome) : undefined;
    if (!isRecord(item) || typeof item.bugId !== 'string' || typeof item.test !== 'string' || outcome === undefined) {
      throw new Error(`invalid record in the known-bugs report: ${JSON.stringify(item)}`);
    }
    records.push({ bugId: item.bugId, outcome, test: item.test });
  }
  return { status: raw.status, records };
}

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
