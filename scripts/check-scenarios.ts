// Checks the scenario catalogs, the inventory and every claims() in the specs.
// Usage: pnpm check:scenarios. Exits 1 on any error; missing obligations never fail it.
// Needs neither eShop nor .env, so CI runs it.
import { LAYERS } from '../test-tooling/types';
import { printProblems } from '../test-tooling/print';
import { checkRepository } from '../test-tooling/scenarios/repo-check';

const { problems, obligations, modules, claims } = checkRepository();
printProblems(problems);

for (const module of modules) {
  for (const layer of LAYERS) {
    const owed = obligations.filter((o) => o.module === module.id && o.layer === layer);
    const count = (state: string) => owed.filter((o) => o.state === state).length;
    console.log(
      `${module.id.padEnd(10)} ${layer.padEnd(4)} ${String(owed.length).padStart(3)} owed: ` +
        `${count('covered')} covered, ${count('blocked')} blocked, ${count('missing')} missing`,
    );
  }
}

const errors = problems.filter((p) => p.level === 'error').length;
const warnings = problems.length - errors;
console.log(`${claims.length} claim(s) read; ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exit(1);
