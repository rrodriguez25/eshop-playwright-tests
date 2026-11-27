import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CheckResult } from './check';
import { computeObligations } from './obligations';
import { buildModuleReport, formatModuleReport, formatOverview } from './report';
import type { Claim } from './scan';
import type { CatalogFile, Inventory, ModuleEntry, ScenarioRow } from '../types';

const MODULES: ModuleEntry[] = ['catalog', 'basket', 'ordering', 'identity'].map((id) => ({
  id, name: id[0]?.toUpperCase() + id.slice(1), prefix: id.slice(0, 3).toUpperCase(), screenSources: [], endpointPrefixes: [],
}));

const INVENTORY: Inventory = {
  screens: [
    { id: 'webapp:/', app: 'webapp', route: '/', module: 'catalog', name: 'Catalog', source: 'x' },
    { id: 'webapp:/item/:itemId', app: 'webapp', route: '/item/:itemId', module: 'catalog', name: 'ItemPage', source: 'x' },
  ],
  endpoints: [
    { id: 'GET /api/catalog/items', method: 'GET', path: '/api/catalog/items', module: 'catalog', versions: ['1.0'], source: 'x' },
    { id: 'GET /api/catalog/catalogtypes', method: 'GET', path: '/api/catalog/catalogtypes', module: 'catalog', versions: ['1.0'], source: 'x' },
  ],
};

function row(id: string, overrides: Partial<ScenarioRow>): ScenarioRow {
  return {
    id, behaviour: `Behaviour of ${id}.`, screens: [], endpoints: [], kind: 'happy', source: 'existing-test',
    sourceNote: '', status: 'active', lastUpdated: '2026-11-26', ...overrides,
  };
}

function claim(id: string, layer: 'ui' | 'api', overrides: Partial<Claim> = {}): Claim {
  return { file: `tests/${layer}/a.spec.ts`, line: 3, title: `Suite › ${id}`, ids: [id], layer, knownBug: false, skipped: false, ...overrides };
}

function result(): CheckResult {
  const catalogs: CatalogFile[] = [{
    module: 'catalog',
    prefix: 'CAT',
    scenarios: [
      row('CAT-UI-HOME', { screens: ['webapp:/'] }),
      row('CAT-UI-GONE', { screens: ['webapp:/'] }),
      row('CAT-READ-LIST', { endpoints: ['GET /api/catalog/items'] }),
      row('CAT-VAL-NAME', { endpoints: ['GET /api/catalog/items'], kind: 'error' }),
      row('CAT-READ-OLD', { status: 'retired', screens: ['webapp:/item/:itemId'] }),
    ],
  }];
  const claims = [
    claim('CAT-UI-HOME', 'ui'),
    claim('CAT-READ-LIST', 'api'),
    claim('CAT-VAL-NAME', 'api', { knownBug: true }),
  ];
  return { problems: [], obligations: computeObligations(catalogs, claims), catalogs, modules: MODULES, inventory: INVENTORY, claims };
}

test('summarises owed, covered, blocked and missing per layer', () => {
  const report = buildModuleReport('catalog', result());

  assert.deepEqual(report.summary, {
    ui: { owed: 2, covered: 1, blocked: 0, missing: 1 },
    api: { owed: 2, covered: 1, blocked: 1, missing: 0 },
  });
  const text = formatModuleReport(report);
  assert.match(text, /UI\s+2 owed → 1 covered · 0 blocked · 1 missing\s+50%/);
  assert.match(text, /API\s+2 owed → 1 covered · 1 blocked · 0 missing\s+50%/);
});

test('shows - for a layer that owes nothing', () => {
  const text = formatModuleReport(buildModuleReport('basket', result()));

  assert.match(text, /UI\s+0 owed → 0 covered · 0 blocked · 0 missing\s+-/);
});

test('lists missing obligations as id (layer)', () => {
  const text = formatModuleReport(buildModuleReport('catalog', result()));

  assert.match(text, /missing: CAT-UI-GONE \(ui\)/);
  assert.match(text, /blocked: CAT-VAL-NAME \(api\)/);
});

test('lists each row with its claiming tests', () => {
  const text = formatModuleReport(buildModuleReport('catalog', result()));

  assert.match(text, /CAT-READ-LIST/);
  assert.match(text, /api\s+covered\s+tests\/api\/a\.spec\.ts:3\s+Suite › CAT-READ-LIST/);
  assert.doesNotMatch(text, /CAT-READ-OLD/);
});

test('lists inventory items no active row names', () => {
  const report = buildModuleReport('catalog', result());

  assert.deepEqual(report.unnamedScreens, ['webapp:/item/:itemId']);
  assert.deepEqual(report.unnamedEndpoints, ['GET /api/catalog/catalogtypes']);
});

test('the overview has a line per module and layer and a total', () => {
  const reports = MODULES.map((m) => buildModuleReport(m.id, result()));

  const text = formatOverview(reports);

  assert.match(text, /catalog\s+ui\s+2 owed → 1 covered · 0 blocked · 1 missing\s+50%/);
  assert.match(text, /identity\s+api\s+0 owed/);
  assert.match(text, /total\s+ui\s+2 owed/);
});

test('unknown module throws', () => {
  assert.throws(
    () => buildModuleReport('payments', result()),
    { message: 'Unknown module payments. Known: catalog, basket, ordering, identity' },
  );
});
