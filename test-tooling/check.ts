/**
 * `pnpm check:scenarios`: every rule on the module list, the catalogs, the inventory and the
 * claims, plus the obligations they add up to. Missing obligations are reported, never failed.
 */
import { loadCatalogs, catalogReferenceProblems } from './catalog';
import { readInventory } from './inventory';
import { readModules } from './modules';
import { computeObligations, type Obligation } from './obligations';
import { scanSpecs, type Claim } from './scan';
import type { CatalogFile, Inventory, ModuleEntry, Problem } from './types';

export interface CheckInput {
  modulesFile: string;
  scenariosDir: string;
  schemaFile: string;
  screensFile: string;
  endpointsFile: string;
  testsDir: string;
  repoRoot: string;
}

export interface CheckResult {
  problems: Problem[];
  obligations: Obligation[];
  catalogs: CatalogFile[];
  modules: ModuleEntry[];
  inventory: Inventory;
  claims: Claim[];
}

function claimProblems(catalogs: CatalogFile[], claims: Claim[]): Problem[] {
  const statusOf = new Map(catalogs.flatMap((c) => c.scenarios.map((r) => [r.id, r.status] as const)));
  const problems: Problem[] = [];
  for (const claim of claims) {
    const where = `${claim.file}:${claim.line}`;
    for (const id of claim.ids) {
      const status = statusOf.get(id);
      if (!status) {
        problems.push({ level: 'error', where, message: `claims ${id}, which no catalog defines` });
      } else if (status === 'retired') {
        problems.push({ level: 'error', where, message: `claims ${id}, which is retired; stop claiming it` });
      }
    }
  }
  return problems;
}

function owesNothingWarnings(catalogs: CatalogFile[], obligations: Obligation[]): Problem[] {
  const owing = new Set(obligations.map((o) => o.rowId));
  return catalogs.flatMap((catalog) =>
    catalog.scenarios
      .filter((row) => row.status === 'active' && !owing.has(row.id))
      .map((row): Problem => ({
        level: 'warning',
        where: `${catalog.module}.scenarios.json ${row.id}`,
        message: 'owes nothing: it names no screen or endpoint and no test claims it',
      })),
  );
}

export function runCheck(input: CheckInput): CheckResult {
  const { modules, problems: moduleProblems } = readModules(input.modulesFile);
  const { catalogs, problems: catalogProblems } = loadCatalogs(input.scenariosDir, input.schemaFile, modules);
  const { inventory, problems: inventoryProblems } = readInventory(input.screensFile, input.endpointsFile);
  const { claims, problems: scanProblems } = scanSpecs(input.testsDir, input.repoRoot);
  const obligations = computeObligations(catalogs, claims);
  const problems = [
    ...moduleProblems,
    ...catalogProblems,
    ...inventoryProblems,
    ...catalogReferenceProblems(catalogs, inventory),
    ...scanProblems,
    ...claimProblems(catalogs, claims),
    ...owesNothingWarnings(catalogs, obligations),
  ];
  return { problems, obligations, catalogs, modules, inventory, claims };
}
