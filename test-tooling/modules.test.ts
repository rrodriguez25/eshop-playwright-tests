import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readModules } from './modules';
import { MODULES_FILE } from './paths';
import { writeTempFile } from './test-support';

const entry = (id: string, prefix: string) => ({ id, name: id, prefix, screenSources: [], endpointPrefixes: [] });

test('reads the committed module list', () => {
  const { modules, problems } = readModules(MODULES_FILE);

  assert.deepEqual(modules.map((m) => m.id), ['catalog', 'basket', 'ordering', 'identity']);
  assert.deepEqual(modules.map((m) => m.prefix), ['CAT', 'BSK', 'ORD', 'IDN']);
  assert.deepEqual(problems, []);
});

test('reports a duplicate id', () => {
  const file = writeTempFile('modules.json', { modules: [entry('catalog', 'CAT'), entry('catalog', 'CAX')] });

  const { problems } = readModules(file);

  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.level, 'error');
  assert.match(problems[0]?.message ?? '', /catalog/);
});

test('reports a duplicate prefix', () => {
  const file = writeTempFile('modules.json', { modules: [entry('catalog', 'CAT'), entry('basket', 'CAT')] });

  const { problems } = readModules(file);

  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.level, 'error');
  assert.match(problems[0]?.message ?? '', /CAT/);
});

test('reports a prefix that is not 2 to 4 capitals', () => {
  const file = writeTempFile('modules.json', { modules: [entry('catalog', 'Cat')] });

  const { problems } = readModules(file);

  assert.equal(problems.length, 1);
  assert.match(problems[0]?.message ?? '', /Cat/);
});
