import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { KNOWN_BUGS_REPORT } from '../paths';
import { bugs } from './known-bug';
import { KnownBugCollector, listedRecords, summarizeKnownBugs, type KnownBugRecord } from './summary';

/** What `KNOWN_BUGS_REPORT` holds after a run; read by `pnpm bugs:sync`. */
export interface KnownBugsReport {
  status: FullResult['status'];
  records: KnownBugRecord[];
}

/**
 * Prints a "Known bugs" section after each run and saves the outcomes to
 * `test-results/known-bugs.json`. Default export: Playwright loads reporters that way, the one
 * exception to named exports.
 */
export default class KnownBugsReporter implements Reporter {
  private readonly collector = new KnownBugCollector();

  onTestEnd(test: TestCase, result: TestResult): void {
    this.collector.record(test.id, test.titlePath().filter(Boolean).join(' › '), result.annotations);
  }

  onEnd(result: FullResult): void {
    const records = listedRecords(this.collector.records(), bugs);
    const summary = summarizeKnownBugs(records, bugs);
    if (summary !== '') {
      process.stdout.write(`\n${summary}\n`);
    }
    const report: KnownBugsReport = { status: result.status, records };
    mkdirSync(path.dirname(KNOWN_BUGS_REPORT), { recursive: true });
    writeFileSync(KNOWN_BUGS_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  }

  printsToStdio(): boolean {
    return false;
  }
}
