/**
 * `pnpm bugs:sync [--apply]`: compares the last run's known-bug outcomes with `data/bugs.json`.
 * Prints the suggested changes; with `--apply`, writes the status changes. Review the diff of
 * `data/bugs.json` like any other change. Runs under plain Node, so imports carry `.ts`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { KNOWN_BUG_OUTCOMES, isRecord, parseBugs } from '../fixtures/bug-list.ts';
import { applyBugUpdates, suggestBugUpdates } from '../reporters/bug-sync.ts';
import type { KnownBugRecord } from '../reporters/known-bugs-summary.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const BUGS_FILE = path.join(REPO_ROOT, 'data', 'bugs.json');
const REPORT_FILE = path.join(REPO_ROOT, 'test-results', 'known-bugs.json');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readReport(): { status: string; records: KnownBugRecord[] } {
  if (!existsSync(REPORT_FILE)) {
    fail('No known-bugs report: run the suite first');
  }
  const raw: unknown = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
  if (!isRecord(raw) || typeof raw.status !== 'string' || !Array.isArray(raw.records)) {
    fail(`${REPORT_FILE} is not a known-bugs report`);
  }
  const records: KnownBugRecord[] = [];
  for (const item of raw.records) {
    const outcome = isRecord(item) ? KNOWN_BUG_OUTCOMES.find(option => option === item.outcome) : undefined;
    if (!isRecord(item) || typeof item.bugId !== 'string' || typeof item.test !== 'string' || outcome === undefined) {
      fail(`${REPORT_FILE} has an invalid record: ${JSON.stringify(item)}`);
    }
    records.push({ bugId: item.bugId, outcome, test: item.test });
  }
  return { status: raw.status, records };
}

const apply = process.argv.includes('--apply');
const report = readReport();
if (report.status === 'interrupted' || report.status === 'timedout') {
  fail(`The last run didn't finish (${report.status}); run it again`);
}
const bugs = parseBugs(JSON.parse(readFileSync(BUGS_FILE, 'utf8')));
const suggestions = suggestBugUpdates(report.records, bugs);

if (suggestions.length === 0) {
  console.log('Known bugs match the last run');
}
for (const suggestion of suggestions) {
  console.log(`${suggestion.action}  ${suggestion.bugId}  ${suggestion.reason}`);
  for (const test of suggestion.tests) {
    console.log(`    ${test}`);
  }
}

if (apply) {
  const changes = suggestions.filter(s => s.action === 'mark-fixed' || s.action === 'reopen').length;
  writeFileSync(BUGS_FILE, `${JSON.stringify(applyBugUpdates(bugs, suggestions), null, 2)}\n`);
  console.log(`Updated data/bugs.json: ${changes} status changes`);
}
