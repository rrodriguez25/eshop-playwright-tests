import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runCheck, type CheckInput } from './check';
import { SCHEMA_FILE } from '../paths';
import { makeTempDir, writeTempFile } from '../test-support';

const ROW = {
  behaviour: 'x', screens: [], endpoints: ['GET /api/catalog/items'], kind: 'happy', source: 'existing-test',
  sourceNote: '', added: '2026-11-26', changed: '2026-11-26',
};

/** A temp repo with one module, one endpoint, the given rows and the given specs. */
function repo(rows: Record<string, unknown>[], specs: Record<string, string> = {}): CheckInput {
  const root = makeTempDir();
  const input: CheckInput = {
    repoRoot: root,
    modulesFile: writeTempFile('test-tooling/modules.json', {
      modules: [{ id: 'catalog', name: 'Catalog', prefix: 'CAT', screenSources: [], endpointPrefixes: ['/api/catalog'] }],
    }, root),
    scenariosDir: join(root, 'test-tooling/scenarios'),
    schemaFile: join(root, 'test-tooling/scenarios/scenario.schema.json'),
    screensFile: writeTempFile('test-tooling/inventory/screens.json', { items: [] }, root),
    endpointsFile: writeTempFile('test-tooling/inventory/endpoints.json', {
      items: [{ id: 'GET /api/catalog/items', method: 'GET', path: '/api/catalog/items', module: 'catalog', versions: ['1.0'], source: 'x' }],
    }, root),
    testsDir: join(root, 'tests'),
  };
  mkdirSync(input.scenariosDir, { recursive: true });
  mkdirSync(input.testsDir, { recursive: true });
  copyFileSync(SCHEMA_FILE, input.schemaFile);
  writeTempFile('catalog.scenarios.json', { module: 'catalog', prefix: 'CAT', scenarios: rows }, input.scenariosDir);
  for (const [file, source] of Object.entries(specs)) writeTempFile(file, source, root);
  return input;
}

const spec = (line: string) => `import { claims, test } from '../../fixtures/test';\n${line}\n`;
const errors = (input: CheckInput) => runCheck(input).problems.filter((p) => p.level === 'error');

test('unclaimed rows produce no problems', () => {
  const result = runCheck(repo([{ id: 'CAT-READ-LIST', status: 'active', ...ROW }]));

  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.obligations.map((o) => o.state), ['missing']);
});

test('claim of an unknown id fails', () => {
  const input = repo([{ id: 'CAT-READ-LIST', status: 'active', ...ROW }], {
    'tests/api/a.api.spec.ts': spec("test('a', claims('CAT-READ-NOPE', 'api'), async () => {});"),
  });

  const found = errors(input);

  assert.equal(found.length, 1);
  assert.match(found[0]?.message ?? '', /CAT-READ-NOPE.*no catalog/);
  assert.equal(found[0]?.where, 'tests/api/a.api.spec.ts:2');
});

test('claim of a retired row fails', () => {
  const input = repo([{ id: 'CAT-READ-OLD', status: 'retired', ...ROW }], {
    'tests/api/a.api.spec.ts': spec("test('a', claims('CAT-READ-OLD', 'api'), async () => {});"),
  });

  assert.match(errors(input)[0]?.message ?? '', /CAT-READ-OLD.*retired/);
});

test('a row owing nothing warns', () => {
  const result = runCheck(repo([{ id: 'CAT-READ-LIST', status: 'active', ...ROW, endpoints: [] }]));

  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0]?.level, 'warning');
  assert.match(result.problems[0]?.message ?? '', /owes nothing/);
});

test('a claimed row is covered', () => {
  const input = repo([{ id: 'CAT-READ-LIST', status: 'active', ...ROW }], {
    'tests/api/a.api.spec.ts': spec("test('a', claims('CAT-READ-LIST', 'api'), async () => {});"),
  });

  const result = runCheck(input);

  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.obligations.map((o) => o.state), ['covered']);
});

test('missing inventory file fails', () => {
  const input = repo([{ id: 'CAT-READ-LIST', status: 'active', ...ROW }]);
  rmSync(input.endpointsFile);

  assert.ok(errors(input).some((p) => /inventory:generate/.test(p.message)));
});
