// Lists catalog rows, the tests that claim them, and covered, blocked and missing obligations.
// Usage: pnpm scenarios:report [module] [--json]. Without a module: one summary line per module and layer.
// It reads spec source, not test results, and exits 1 only for an unknown module.
import { buildModuleReport, formatModuleReport, formatOverview } from '../test-tooling/report';
import { checkRepository } from '../test-tooling/repo-check';

const args = process.argv.slice(2);
const json = args.includes('--json');
const moduleId = args.find((arg) => !arg.startsWith('--'));

const result = checkRepository();
try {
  const reports = (moduleId ? [moduleId] : result.modules.map((m) => m.id)).map((id) => buildModuleReport(id, result));
  if (json) console.log(JSON.stringify(moduleId ? reports[0] : reports, null, 2));
  else console.log(moduleId && reports[0] ? formatModuleReport(reports[0]) : formatOverview(reports));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = result.problems.filter((p) => p.level === 'error').length;
if (errors > 0 && !json) console.warn(`\n${errors} error(s) in the catalogs or claims; run pnpm check:scenarios.`);
