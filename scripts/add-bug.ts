// Logs a known eShop bug in data/bugs.json as open, under a new
// issue-<today>-<5 random digits> id, and prints the id for knownBug('<id>', …).
// Usage: pnpm bugs:add --title "…" --priority <high|medium|low> [--module …]
//   [--found <mining|writing>] [--expected …] [--actual …] [--source …]
// Needs neither eShop nor .env.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { addBug, newBugId, parseBugs } from '../test-tooling/bugs/bug-list';
import { BUGS_FILE } from '../test-tooling/paths';

const { values } = parseArgs({
  options: {
    title: { type: 'string' },
    priority: { type: 'string' },
    module: { type: 'string' },
    found: { type: 'string' },
    expected: { type: 'string' },
    actual: { type: 'string' },
    source: { type: 'string' },
  },
});

if (values.title === undefined || values.priority === undefined) {
  console.error('Usage: pnpm bugs:add --title "<what is wrong>" --priority <high|medium|low> [--module <id>] ' +
    '[--found <mining|writing>] [--expected "<…>"] [--actual "<…>"] [--source <eShop path>]');
  process.exit(1);
}

const bugs = parseBugs(JSON.parse(readFileSync(BUGS_FILE, 'utf8')));
const id = newBugId(new Date(), Object.keys(bugs));
const given = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
try {
  // addBug validates every field (priority, found, …) the same way loading bugs.json does.
  writeFileSync(BUGS_FILE, `${JSON.stringify(addBug(bugs, id, given), null, 2)}\n`);
  console.log(id);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
