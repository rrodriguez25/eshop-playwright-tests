import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { layerOfSpec, scanSpecs } from './scan';
import { makeTempDir, writeTempFile } from '../test-support';

/** Writes the given specs into a temp repo and scans its tests/ folder. */
function scan(specs: Record<string, string>) {
  const root = makeTempDir();
  for (const [file, source] of Object.entries(specs)) writeTempFile(file, source, root);
  return scanSpecs(join(root, 'tests'), root);
}

const HEADER = "import { claims, test, expect } from '../../fixtures/test';\n";

test('finds a claim in a nested describe', () => {
  const { claims, problems } = scan({
    'tests/api/catalog.api.spec.ts': `${HEADER}
test.describe('Catalog API', () => {
  test.describe('GET /items', () => {
    test('filters by name prefix', claims(['CAT-READ-FILTER-NAME-PREFIX', 'CAT-READ-LIST'], 'api'), async () => {});
  });
});
`,
  });

  assert.deepEqual(problems, []);
  assert.deepEqual(claims, [{
    file: 'tests/api/catalog.api.spec.ts',
    line: 5,
    title: 'Catalog API › GET /items › filters by name prefix',
    ids: ['CAT-READ-FILTER-NAME-PREFIX', 'CAT-READ-LIST'],
    layer: 'api',
    knownBug: false,
    skipped: false,
  }]);
});

test('marks test.fail inside the body as knownBug', () => {
  const { claims } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
test('returns 400', claims('CAT-VAL-NAME', 'api'), async () => {
  test.fail(true, 'eShop bug: returns 500');
});
`,
  });

  assert.equal(claims[0]?.knownBug, true);
});

test('marks a knownBug(...) call inside the body as knownBug', () => {
  const { claims } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
test('returns 400', claims('CAT-VAL-NAME', 'api'), async ({ catalog }) => {
  await knownBug('issue-2026-11-25-35712', async () => {
    await expect(catalog.create()).rejects.toThrow('-> 400');
  });
});
`,
  });

  assert.equal(claims[0]?.knownBug, true);
});

test('marks test.fail(title, claims(...), fn) as knownBug', () => {
  const { claims } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}test.fail('returns 400', claims('CAT-VAL-NAME', 'api'), async () => {});\n`,
  });

  assert.equal(claims[0]?.knownBug, true);
});

test('marks test.skip and test.fixme as skipped', () => {
  const { claims } = scan({
    'tests/ui/a.ui.spec.ts': `${HEADER}
test.skip('a', claims('CAT-UI-A', 'ui'), async () => {});
test.fixme('b', claims('CAT-UI-B', 'ui'), async () => {});
`,
  });

  assert.deepEqual(claims.map((c) => c.skipped), [true, true]);
});

test('reports non-literal ids or layer', () => {
  const { claims, problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
const ID = 'CAT-READ-A';
const LAYER = 'api';
test('a', claims([ID], 'api'), async () => {});
test('b', claims(['CAT-READ-B'], LAYER), async () => {});
`,
  });

  assert.equal(claims.length, 0);
  assert.equal(problems.filter((p) => p.level === 'error' && /string literals/.test(p.message)).length, 2);
});

test('reports a claims call outside a test call', () => {
  const { problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}const details = claims('CAT-READ-A', 'api');\ntest('a', details, async () => {});\n`,
  });

  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.level, 'error');
  assert.match(problems[0]?.message ?? '', /directly in a test/);
});

test('reports a layer that does not match the folder', () => {
  const { problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}test('a', claims('CAT-READ-A', 'ui'), async () => {});\n`,
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0]?.message ?? '', /'ui'.*tests\/api/);
});

test('reports a claim under tests/db or tests/preflight', () => {
  const { problems } = scan({
    'tests/db/a.db.spec.ts': `${HEADER}test('a', claims('CAT-READ-A', 'api'), async () => {});\n`,
    'tests/preflight/a.preflight.ts': `${HEADER}test('a', claims('CAT-READ-A', 'ui'), async () => {});\n`,
  });

  assert.equal(problems.filter((p) => p.level === 'error' && /tests\/ui or tests\/api/.test(p.message)).length, 2);
});

test('reports a layer other than ui or api', () => {
  const { problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}test('a', claims('CAT-READ-A', 'db'), async () => {});\n`,
  });

  assert.equal(problems.filter((p) => p.level === 'error' && /'db'/.test(p.message)).length, 1);
});

test('scans a describe whose title is a template literal', () => {
  const { claims, problems } = scan({
    'tests/ui/a.ui.spec.ts': `${HEADER}
const user = 'alice';
test.describe(\`Header as \${user}\`, () => {
  test('shows the name', claims('IDN-UI-HEADER-NAME', 'ui'), async () => {});
});
`,
  });

  assert.deepEqual(problems, []);
  assert.equal(claims[0]?.title, 'Header as ${user} › shows the name');
});

test('marks tests in describe.skip and describe.fixme as skipped', () => {
  const { claims } = scan({
    'tests/ui/a.ui.spec.ts': `${HEADER}
test.describe.skip('off', () => { test('a', claims('CAT-UI-A', 'ui'), async () => {}); });
test.describe.fixme('broken', () => { test('b', claims('CAT-UI-B', 'ui'), async () => {}); });
`,
  });

  assert.deepEqual(claims.map((c) => c.skipped), [true, true]);
});

test('marks tests after a describe-level test.skip or test.fixme as skipped', () => {
  const { claims } = scan({
    'tests/ui/a.ui.spec.ts': `${HEADER}
test.describe('x', () => {
  test.skip(process.platform === 'win32', 'not on Windows');
  test('a', claims('CAT-UI-A', 'ui'), async () => {});
});
test.describe('y', () => {
  test.fixme();
  test('b', claims('CAT-UI-B', 'ui'), async () => {});
});
`,
  });

  assert.deepEqual(claims.map((c) => c.skipped), [true, true]);
});

test('marks tests after a describe-level test.fail as knownBug', () => {
  const { claims } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
test.describe('x', () => {
  test.fail(true, 'eShop bug: all of these fail');
  test('a', claims('CAT-VAL-A', 'api'), async () => {});
});
`,
  });

  assert.equal(claims[0]?.knownBug, true);
  assert.equal(claims[0]?.skipped, false);
});

test('marks test.skip and test.fixme inside the body as skipped', () => {
  const { claims } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
test('a', claims('CAT-READ-A', 'api'), async () => { test.skip(true, 'not yet'); });
test('b', claims('CAT-READ-B', 'api'), async () => { test.fixme(); });
`,
  });

  assert.deepEqual(claims.map((c) => c.skipped), [true, true]);
});

test('a skipped describe does not leak into its sibling', () => {
  const { claims } = scan({
    'tests/ui/a.ui.spec.ts': `${HEADER}
test.describe.skip('off', () => { test('a', claims('CAT-UI-A', 'ui'), async () => {}); });
test.describe('on', () => { test('b', claims('CAT-UI-B', 'ui'), async () => {}); });
`,
  });

  assert.deepEqual(claims.map((c) => c.skipped), [true, false]);
});

test('reads claims in tests and describes with variable titles', () => {
  const { claims, problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}
const SUITE = 'Catalog';
const NAME = 'lists items';
test.describe(SUITE, () => {
  test(NAME, claims('CAT-READ-A', 'api'), async () => {});
});
`,
  });

  assert.deepEqual(problems, []);
  assert.equal(claims[0]?.title, 'SUITE › NAME');
});

test('ignores tests without claims', () => {
  const { claims, problems } = scan({
    'tests/api/a.api.spec.ts': `${HEADER}test('a', async () => {});\ntest('b', { tag: '@x' }, async () => {});\n`,
  });

  assert.deepEqual(claims, []);
  assert.deepEqual(problems, []);
});

test('normalises Windows separators', () => {
  assert.equal(layerOfSpec('tests\\ui\\a.ui.spec.ts'), 'ui');
  assert.equal(layerOfSpec('tests/api/a.api.spec.ts'), 'api');
  assert.equal(layerOfSpec('tests/db/a.db.spec.ts'), null);
});
