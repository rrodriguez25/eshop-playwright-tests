// Compares the last run's known-bug outcomes with test-tooling/bugs/bugs.json and prints the
// suggested changes. Usage: pnpm bugs:sync [--apply]. With --apply, writes the status changes;
// review the diff like any other change. Needs neither eShop nor .env.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseBugs } from '../test-tooling/bugs/bug-list';
import { applyBugUpdates, parseKnownBugsReport, suggestBugUpdates } from '../test-tooling/bugs/sync';
import { BUGS_FILE, KNOWN_BUGS_REPORT, repoRelative } from '../test-tooling/paths';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!existsSync(KNOWN_BUGS_REPORT)) {
  fail('No known-bugs report: run the suite first');
}
let report: ReturnType<typeof parseKnownBugsReport>;
try {
  report = parseKnownBugsReport(JSON.parse(readFileSync(KNOWN_BUGS_REPORT, 'utf8')));
} catch (error) {
  fail(`${repoRelative(KNOWN_BUGS_REPORT)}: ${error instanceof Error ? error.message : String(error)}`);
}
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
  for (const test of suggestion.tests) console.log(`    ${test}`);
}

if (process.argv.includes('--apply')) {
  const changes = suggestions.filter(s => s.action === 'mark-fixed' || s.action === 'reopen').length;
  writeFileSync(BUGS_FILE, `${JSON.stringify(applyBugUpdates(bugs, suggestions), null, 2)}\n`);
  console.log(`Updated ${repoRelative(BUGS_FILE)}: ${changes} status changes`);
}
