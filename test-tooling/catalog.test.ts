import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogReferenceProblems, loadCatalogs } from './catalog';
import { SCENARIOS_DIR, SCHEMA_FILE } from './paths';
import { makeTempDir, writeTempFile } from './test-support';
import type { Inventory, ModuleEntry, Problem, ScenarioRow } from './types';

const MODULES: ModuleEntry[] = [
  { id: 'catalog', name: 'Catalog', prefix: 'CAT', screenSources: [], endpointPrefixes: [] },
  { id: 'basket', name: 'Basket', prefix: 'BSK', screenSources: [], endpointPrefixes: [] },
];

const INVENTORY: Inventory = {
  screens: [
    { id: 'webapp:/', app: 'webapp', route: '/', module: 'catalog', name: 'Catalog', source: 'x' },
    { id: 'webapp:/cart', app: 'webapp', route: '/cart', module: 'basket', name: 'CartPage', source: 'x' },
  ],
  endpoints: [
    { id: 'GET /api/catalog/items', method: 'GET', path: '/api/catalog/items', module: 'catalog', versions: ['1.0'], source: 'x' },
  ],
};

function row(overrides: Partial<ScenarioRow> = {}): ScenarioRow {
  return {
    id: 'CAT-READ-LIST',
    behaviour: 'The catalog lists items.',
    screens: [],
    endpoints: ['GET /api/catalog/items'],
    kind: 'happy',
    source: 'existing-test',
    sourceNote: 'tests/api/catalog.api.spec.ts',
    status: 'active',
    added: '2026-11-26',
    changed: '2026-11-26',
    ...overrides,
  };
}

/** A temp scenarios dir holding the real schema plus the given files. */
function scenariosDir(files: Record<string, unknown>): string {
  const dir = makeTempDir();
  copyFileSync(SCHEMA_FILE, join(dir, 'scenario.schema.json'));
  for (const [name, content] of Object.entries(files)) writeTempFile(name, content, dir);
  return dir;
}

function load(files: Record<string, unknown>) {
  const dir = scenariosDir(files);
  return loadCatalogs(dir, join(dir, 'scenario.schema.json'), MODULES);
}

function catalog(rows: ScenarioRow[], module = 'catalog', prefix = 'CAT') {
  return { $schema: './scenario.schema.json', module, prefix, scenarios: rows };
}

function errorsMatching(problems: Problem[], pattern: RegExp): Problem[] {
  return problems.filter((p) => p.level === 'error' && pattern.test(p.message));
}

test('loads a valid catalog with no problems', () => {
  const { catalogs, problems } = load({ 'catalog.scenarios.json': catalog([row()]) });

  assert.deepEqual(problems, []);
  assert.equal(catalogs.length, 1);
  assert.equal(catalogs[0]?.scenarios[0]?.id, 'CAT-READ-LIST');
});

test('rejects invalid JSON', () => {
  const { problems } = load({ 'catalog.scenarios.json': '{ not json' });

  assert.equal(errorsMatching(problems, /not valid JSON/).length, 1);
});

test('rejects a file that breaks the schema', () => {
  const { catalogs, problems } = load({ 'catalog.scenarios.json': catalog([row({ kind: 'sad' as never })]) });

  assert.equal(catalogs.length, 0);
  assert.equal(errorsMatching(problems, /kind/).length, 1);
});

test('rejects a misnamed json file', () => {
  const { problems } = load({ 'catalog.json': catalog([row()]) });

  assert.equal(errorsMatching(problems, /<module>\.scenarios\.json/).length, 1);
});

test('skips files starting with _ but validates the template against the schema', () => {
  const valid = load({ '_template.scenarios.json': catalog([row()]) });
  const broken = load({ '_template.scenarios.json': { module: 'catalog' } });

  assert.deepEqual(valid.catalogs, []);
  assert.deepEqual(valid.problems, []);
  assert.equal(broken.catalogs.length, 0);
  assert.ok(broken.problems.some((p) => p.level === 'error' && p.where.endsWith('_template.scenarios.json')));
});

test('rejects a file for an unknown module', () => {
  const { problems } = load({ 'payments.scenarios.json': catalog([row()], 'payments') });

  assert.equal(errorsMatching(problems, /payments.*modules\.json/).length, 1);
});

test('rejects a module field that differs from the file name', () => {
  const { problems } = load({ 'catalog.scenarios.json': catalog([row()], 'basket') });

  assert.equal(errorsMatching(problems, /"basket"/).length, 1);
});

test('rejects a prefix that differs from modules.json', () => {
  const { problems } = load({ 'catalog.scenarios.json': catalog([row({ id: 'CAX-READ-LIST' })], 'catalog', 'CAX') });

  assert.equal(errorsMatching(problems, /prefix "CAX".*CAT/).length, 1);
});

test('rejects an id without its prefix', () => {
  const { problems } = load({ 'catalog.scenarios.json': catalog([row({ id: 'BSK-READ-LIST' })]) });

  assert.equal(errorsMatching(problems, /BSK-READ-LIST.*CAT-/).length, 1);
});

test('rejects an id used twice across catalogs', () => {
  const { problems } = load({
    'catalog.scenarios.json': catalog([row({ id: 'CAT-READ-LIST' }), row({ id: 'CAT-READ-LIST' })]),
  });

  assert.equal(errorsMatching(problems, /CAT-READ-LIST.*twice/).length, 1);
});

test('rejects 2026-02-30', () => {
  const { problems } = load({ 'catalog.scenarios.json': catalog([row({ added: '2026-02-30', changed: '2026-03-01' })]) });

  assert.equal(errorsMatching(problems, /2026-02-30/).length, 1);
});

test('rejects changed before added', () => {
  const { problems } = load({ 'catalog.scenarios.json': catalog([row({ added: '2026-11-26', changed: '2026-11-01' })]) });

  assert.equal(errorsMatching(problems, /before/).length, 1);
});

test('rejects an active row naming an unknown screen or endpoint', () => {
  const { catalogs } = load({
    'catalog.scenarios.json': catalog([row({ screens: ['webapp:/nowhere'], endpoints: ['GET /api/nowhere'] })]),
  });

  const problems = catalogReferenceProblems(catalogs, INVENTORY);

  assert.equal(errorsMatching(problems, /webapp:\/nowhere/).length, 1);
  assert.equal(errorsMatching(problems, /GET \/api\/nowhere/).length, 1);
});

test('allows a retired row naming an unknown screen', () => {
  const { catalogs } = load({
    'catalog.scenarios.json': catalog([row({ status: 'retired', screens: ['webapp:/gone'] })]),
  });

  assert.deepEqual(catalogReferenceProblems(catalogs, INVENTORY), []);
});

test("warns on a row naming another module's screen", () => {
  const { catalogs } = load({ 'catalog.scenarios.json': catalog([row({ screens: ['webapp:/cart'] })]) });

  const problems = catalogReferenceProblems(catalogs, INVENTORY);

  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.level, 'warning');
  assert.match(problems[0]?.message ?? '', /basket/);
});

test('loads the committed scenarios folder with no problems', () => {
  const { problems } = loadCatalogs(SCENARIOS_DIR, SCHEMA_FILE, [
    ...MODULES,
    { id: 'ordering', name: 'Ordering', prefix: 'ORD', screenSources: [], endpointPrefixes: [] },
    { id: 'identity', name: 'Identity', prefix: 'IDN', screenSources: [], endpointPrefixes: [] },
  ]);

  assert.deepEqual(problems, []);
});
