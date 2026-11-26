import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readModules } from './modules';
import { writeTempFile } from './test-support';

const entry = (id: string, prefix: string) => ({ id, name: id, prefix, screenSources: [], endpointPrefixes: [] });

test('reads a valid module list in order', () => {
  const file = writeTempFile('modules.json', {
    about: 'x',
    modules: [
      { id: 'catalog', name: 'Catalog', prefix: 'CAT', screenSources: ['Catalog'], endpointPrefixes: ['/api/catalog'] },
      entry('basket', 'BSK'),
    ],
  });

  const { modules, problems } = readModules(file);

  assert.deepEqual(problems, []);
  assert.deepEqual(modules, [
    { id: 'catalog', name: 'Catalog', prefix: 'CAT', screenSources: ['Catalog'], endpointPrefixes: ['/api/catalog'] },
    { id: 'basket', name: 'basket', prefix: 'BSK', screenSources: [], endpointPrefixes: [] },
  ]);
});

test('reports an entry missing its fields', () => {
  const file = writeTempFile('modules.json', { modules: [{ id: 'catalog' }] });

  const { modules, problems } = readModules(file);

  assert.deepEqual(modules, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0]?.message ?? '', /needs id, name, prefix/);
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
