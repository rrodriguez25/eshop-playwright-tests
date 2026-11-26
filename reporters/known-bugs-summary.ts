import { KNOWN_BUG_ANNOTATION, type BugEntry, type KnownBugOutcome } from '../fixtures/known-bug';

/** One known bug's outcome in one test. */
export interface KnownBugRecord {
  bugId: string;
  outcome: KnownBugOutcome;
  test: string;
}

const OUTCOMES: readonly KnownBugOutcome[] = ['present', 'looks-fixed', 'regressed', 'stale'];

/** Sections of the summary, most urgent first. */
const SECTIONS: readonly { outcome: KnownBugOutcome; heading: string }[] = [
  { outcome: 'regressed', heading: 'Back after a fix' },
  { outcome: 'looks-fixed', heading: 'Looks fixed' },
  { outcome: 'stale', heading: 'Stale wrappers' },
  { outcome: 'present', heading: 'Still present' },
];

/** Reads a `known-bug` annotation's description, `<bugId>: <outcome>`. */
export function parseKnownBugAnnotation(description: string): { bugId: string; outcome: KnownBugOutcome } | undefined {
  const match = /^(.+): ([a-z-]+)$/.exec(description);
  const bugId = match?.[1];
  const outcome = OUTCOMES.find(option => option === match?.[2]);
  return bugId === undefined || outcome === undefined ? undefined : { bugId, outcome };
}

/** Collects known-bug outcomes per test. Only a test's last attempt counts, so a retry replaces the earlier result. */
export class KnownBugCollector {
  private readonly byTest = new Map<string, KnownBugRecord[]>();

  record(testId: string, testTitle: string, annotations: { type: string; description?: string }[]): void {
    const records: KnownBugRecord[] = [];
    for (const annotation of annotations) {
      if (annotation.type !== KNOWN_BUG_ANNOTATION || annotation.description === undefined) continue;
      const parsed = parseKnownBugAnnotation(annotation.description);
      if (parsed !== undefined) {
        records.push({ ...parsed, test: testTitle });
      }
    }
    this.byTest.set(testId, records);
  }

  records(): KnownBugRecord[] {
    return [...this.byTest.values()].flat();
  }
}

/** Keeps only records of bugs in the list, so test-only ids never reach a real summary. */
export function listedRecords(records: KnownBugRecord[], bugs: Record<string, BugEntry>): KnownBugRecord[] {
  return records.filter(record => Object.hasOwn(bugs, record.bugId));
}

/** The "Known bugs" section printed after a run, grouped by outcome. Empty when there is nothing to list. */
export function summarizeKnownBugs(records: KnownBugRecord[], bugs: Record<string, BugEntry>): string {
  const listed = listedRecords(records, bugs);
  if (listed.length === 0) return '';
  const lines = ['Known bugs'];
  for (const { outcome, heading } of SECTIONS) {
    const inSection = listed.filter(record => record.outcome === outcome);
    if (inSection.length === 0) continue;
    lines.push(`  ${heading}`);
    for (const record of inSection) {
      lines.push(`    ${record.bugId}  ${bugs[record.bugId]?.title ?? ''}  (${record.test})`);
    }
  }
  return lines.join('\n');
}
