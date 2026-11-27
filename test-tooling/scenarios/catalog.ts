/**
 * Loading the scenario catalogs, `test-tooling/scenarios/<module>.scenarios.json`, and every check
 * that needs only the files themselves (and, for screens and endpoints, the inventory).
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020';
import { isRecord, readJson } from '../json';
import { repoRelative } from '../paths';
import type { CatalogFile, Inventory, ModuleEntry, Problem, ScenarioRow } from '../types';

const CATALOG_SUFFIX = '.scenarios.json';
const SCHEMA_NAME = 'scenario.schema.json';

/** A real calendar day written `YYYY-MM-DD`. */
function isRealDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function compileSchema(schemaFile: string): ValidateFunction<CatalogFile> {
  const read = readJson(schemaFile);
  if ('error' in read || !isRecord(read.value)) {
    throw new Error(`Cannot read the catalog schema ${schemaFile}: ${'error' in read ? read.error : 'not an object'}`);
  }
  return new Ajv2020({ allErrors: true, strict: false }).compile<CatalogFile>(read.value);
}

function rowProblems(file: CatalogFile, module: ModuleEntry, where: string): Problem[] {
  const problems: Problem[] = [];
  const error = (message: string) => problems.push({ level: 'error', where, message });
  for (const row of file.scenarios) {
    if (!row.id.startsWith(`${module.prefix}-`)) {
      error(`${row.id} does not start with the module's prefix ${module.prefix}-`);
    }
    for (const [field, value] of [['added', row.added], ['changed', row.changed]] as const) {
      if (!isRealDay(value)) error(`${row.id}: ${field} ${value} is not a real date`);
    }
    if (isRealDay(row.added) && isRealDay(row.changed) && row.changed < row.added) {
      error(`${row.id}: changed ${row.changed} is before added ${row.added}`);
    }
  }
  return problems;
}

/**
 * Reads every catalog in `scenariosDir`. Files starting with `_` (the template) are checked against
 * the schema but not returned. Each returned catalog matches the schema; the problems say what is
 * wrong with the rest.
 */
export function loadCatalogs(
  scenariosDir: string,
  schemaFile: string,
  modules: ModuleEntry[],
): { catalogs: CatalogFile[]; problems: Problem[] } {
  const validate = compileSchema(schemaFile);
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const catalogs: CatalogFile[] = [];
  const problems: Problem[] = [];
  const firstFileOfId = new Map<string, string>();

  const names = readdirSync(scenariosDir).filter((name) => name.endsWith('.json') && name !== SCHEMA_NAME).sort();
  for (const name of names) {
    const file = path.join(scenariosDir, name);
    const where = repoRelative(file);
    const error = (message: string) => problems.push({ level: 'error', where, message });
    const isTemplate = name.startsWith('_');

    if (!isTemplate && !name.endsWith(CATALOG_SUFFIX)) {
      error(`is never read: a catalog file is named <module>.scenarios.json`);
      continue;
    }
    const read = readJson(file);
    if ('error' in read) {
      error(`not valid JSON: ${read.error}`);
      continue;
    }
    if (!validate(read.value)) {
      for (const issue of validate.errors ?? []) {
        error(`does not match the schema at ${issue.instancePath || '/'}: ${issue.message ?? 'invalid'}`);
      }
      continue;
    }
    if (isTemplate) continue;

    const content = read.value;
    const moduleId = name.slice(0, -CATALOG_SUFFIX.length);
    const module = moduleById.get(moduleId);
    if (!module) {
      error(`"${moduleId}" is not a module id in test-tooling/modules.json`);
      continue;
    }
    if (content.module !== moduleId) {
      error(`module field "${content.module}" differs from the file name's "${moduleId}"`);
    }
    if (content.prefix !== module.prefix) {
      error(`prefix "${content.prefix}" differs from ${moduleId}'s prefix ${module.prefix} in test-tooling/modules.json`);
    }
    problems.push(...rowProblems(content, module, where));
    for (const row of content.scenarios) {
      const first = firstFileOfId.get(row.id);
      if (first) error(`${row.id} is used twice${first === where ? ' in this file' : ` (also in ${first})`}`);
      else firstFileOfId.set(row.id, where);
    }
    catalogs.push(content);
  }
  return { catalogs, problems };
}

/**
 * Screens and endpoints an active row names must be in the inventory (an error). Naming another
 * module's screen or endpoint is allowed but warned about. Retired rows are not checked: what they
 * named may be gone from eShop.
 */
export function catalogReferenceProblems(catalogs: CatalogFile[], inventory: Inventory): Problem[] {
  const screenModule = new Map(inventory.screens.map((s) => [s.id, s.module]));
  const endpointModule = new Map(inventory.endpoints.map((e) => [e.id, e.module]));
  const problems: Problem[] = [];
  const check = (catalog: CatalogFile, row: ScenarioRow, ids: string[], known: Map<string, string>, kind: string) => {
    const where = `${catalog.module}.scenarios.json ${row.id}`;
    for (const id of ids) {
      const owner = known.get(id);
      if (!owner) {
        problems.push({ level: 'error', where, message: `${kind} "${id}" is not in the inventory (test-tooling/inventory/${kind}s.json)` });
      } else if (owner !== catalog.module) {
        problems.push({ level: 'warning', where, message: `${kind} "${id}" belongs to module ${owner}` });
      }
    }
  };
  for (const catalog of catalogs) {
    for (const row of catalog.scenarios.filter((r) => r.status === 'active')) {
      check(catalog, row, row.screens, screenModule, 'screen');
      check(catalog, row, row.endpoints, endpointModule, 'endpoint');
    }
  }
  return problems;
}
