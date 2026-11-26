import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeObligations } from './obligations';
import type { Claim } from './scan';
import type { CatalogFile, ScenarioRow } from './types';

function row(id: string, overrides: Partial<ScenarioRow> = {}): ScenarioRow {
  return {
    id, behaviour: 'x', screens: [], endpoints: [], kind: 'happy', source: 'existing-test', sourceNote: '',
    status: 'active', added: '2026-11-26', changed: '2026-11-26', ...overrides,
  };
}

function claim(id: string, layer: 'ui' | 'api', overrides: Partial<Claim> = {}): Claim {
  return { file: `tests/${layer}/a.spec.ts`, line: 1, title: 't', ids: [id], layer, knownBug: false, skipped: false, ...overrides };
}

const catalogOf = (...rows: ScenarioRow[]): CatalogFile[] => [{ module: 'catalog', prefix: 'CAT', scenarios: rows }];

const summary = (catalogs: CatalogFile[], claims: Claim[]) =>
  computeObligations(catalogs, claims).map((o) => `${o.rowId} ${o.layer} ${o.state}`);

test('a row with a screen owes ui and a row with an endpoint owes api', () => {
  const catalogs = catalogOf(
    row('CAT-UI-HOME', { screens: ['webapp:/'] }),
    row('CAT-READ-LIST', { endpoints: ['GET /api/catalog/items'] }),
    row('CAT-READ-BOTH', { screens: ['webapp:/'], endpoints: ['GET /api/catalog/items'] }),
  );

  assert.deepEqual(summary(catalogs, []), [
    'CAT-UI-HOME ui missing',
    'CAT-READ-LIST api missing',
    'CAT-READ-BOTH ui missing',
    'CAT-READ-BOTH api missing',
  ]);
});

test('a claim alone makes its layer owed', () => {
  const obligations = computeObligations(catalogOf(row('CAT-READ-X')), [claim('CAT-READ-X', 'api')]);

  assert.deepEqual(obligations.map((o) => `${o.layer} ${o.state}`), ['api covered']);
  assert.equal(obligations[0]?.module, 'catalog');
  assert.equal(obligations[0]?.claims.length, 1);
});

test('knownBug-only claims are blocked', () => {
  const catalogs = catalogOf(row('CAT-VAL-X', { endpoints: ['POST /api/catalog/items'] }));

  assert.deepEqual(summary(catalogs, [claim('CAT-VAL-X', 'api', { knownBug: true })]), ['CAT-VAL-X api blocked']);
});

test('skipped-only claims are missing', () => {
  const catalogs = catalogOf(row('CAT-VAL-X', { endpoints: ['POST /api/catalog/items'] }));

  assert.deepEqual(summary(catalogs, [claim('CAT-VAL-X', 'api', { skipped: true })]), ['CAT-VAL-X api missing']);
});

test('one passing claim beats a knownBug claim', () => {
  const catalogs = catalogOf(row('CAT-VAL-X', { endpoints: ['POST /api/catalog/items'] }));
  const claims = [claim('CAT-VAL-X', 'api', { knownBug: true }), claim('CAT-VAL-X', 'api')];

  assert.deepEqual(summary(catalogs, claims), ['CAT-VAL-X api covered']);
});

test('a claim on one layer does not cover the other', () => {
  const catalogs = catalogOf(row('CAT-READ-BOTH', { screens: ['webapp:/'], endpoints: ['GET /api/catalog/items'] }));

  assert.deepEqual(summary(catalogs, [claim('CAT-READ-BOTH', 'ui')]), ['CAT-READ-BOTH ui covered', 'CAT-READ-BOTH api missing']);
});

test('retired rows owe nothing', () => {
  const catalogs = catalogOf(row('CAT-READ-OLD', { status: 'retired', screens: ['webapp:/'] }));

  assert.deepEqual(summary(catalogs, [claim('CAT-READ-OLD', 'ui')]), []);
});
