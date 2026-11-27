import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverEndpoints, discoverScreens, mergeSupplement, readInventory, routeToScreenRoute } from './inventory';
import { makeTempDir, writeTempFile } from '../test-support';
import type { ModuleEntry } from '../types';

const MODULES: ModuleEntry[] = [
  { id: 'catalog', name: 'Catalog', prefix: 'CAT', screenSources: ['Catalog', 'Item'], endpointPrefixes: ['/api/catalog'] },
  { id: 'ordering', name: 'Ordering', prefix: 'ORD', screenSources: ['User/Orders.razor'], endpointPrefixes: ['/api/orders'] },
  { id: 'identity', name: 'Identity', prefix: 'IDN', screenSources: ['User/LogIn.razor'], endpointPrefixes: ['/Account'] },
];

function openApi(paths: Record<string, Record<string, unknown>>) {
  return { openapi: '3.0.1', info: { title: 't', version: '1' }, paths };
}

test('converts a Blazor route template', () => {
  assert.equal(routeToScreenRoute('/item/{itemId:int}'), '/item/:itemId');
  assert.equal(routeToScreenRoute('/'), '/');
  assert.equal(routeToScreenRoute('/User/Orders'), '/user/orders');
});

test('discovers @page routes including files with a BOM', () => {
  const pages = makeTempDir();
  writeTempFile('Item/ItemPage.razor', '﻿@page "/item/{itemId:int}"\n<h1>x</h1>\n', pages);

  const { screens, problems } = discoverScreens(pages, MODULES);

  assert.deepEqual(problems, []);
  assert.equal(screens.length, 1);
  assert.equal(screens[0]?.id, 'webapp:/item/:itemId');
  assert.equal(screens[0]?.module, 'catalog');
  assert.equal(screens[0]?.name, 'ItemPage');
  assert.match(screens[0]?.source ?? '', /ItemPage\.razor:1$/);
});

test('matches a single-file screen source', () => {
  const pages = makeTempDir();
  writeTempFile('User/Orders.razor', '@page "/user/orders"\n', pages);
  writeTempFile('User/LogIn.razor', '@page "/user/login"\n', pages);

  const { screens } = discoverScreens(pages, MODULES);

  assert.deepEqual(
    screens.map((s) => [s.id, s.module]),
    [['webapp:/user/login', 'identity'], ['webapp:/user/orders', 'ordering']],
  );
});

test('reports a page no module claims', () => {
  const pages = makeTempDir();
  writeTempFile('Cart/CartPage.razor', '@page "/cart"\n', pages);

  const { screens, problems } = discoverScreens(pages, MODULES);

  assert.equal(screens.length, 0);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.level, 'error');
  assert.match(problems[0]?.message ?? '', /CartPage\.razor/);
});

test('merges an endpoint present in two versions', () => {
  const dir = makeTempDir();
  const v1 = writeTempFile('v1.json', openApi({ '/api/catalog/items': { get: { operationId: 'list' } } }), dir);
  const v2 = writeTempFile('v2.json', openApi({ '/api/catalog/items': { get: {}, post: {} } }), dir);

  const { endpoints, problems } = discoverEndpoints([{ file: v1, version: '1.0' }, { file: v2, version: '2.0' }], MODULES);

  assert.deepEqual(problems, []);
  assert.deepEqual(endpoints.map((e) => [e.id, e.versions]), [
    ['GET /api/catalog/items', ['1.0', '2.0']],
    ['POST /api/catalog/items', ['2.0']],
  ]);
  assert.equal(endpoints[0]?.operationId, 'list');
});

test('assigns endpoints by longest prefix and reports unassigned ones', () => {
  const modules: ModuleEntry[] = [
    ...MODULES,
    { id: 'pictures', name: 'Pictures', prefix: 'PIC', screenSources: [], endpointPrefixes: ['/api/catalog/items/{id}/pic'] },
  ];
  const doc = writeTempFile('v1.json', openApi({
    '/api/catalog/items/{id}/pic': { get: {} },
    '/api/catalog/items/{id}': { get: {} },
    '/api/basket': { get: {} },
  }));

  const { endpoints, problems } = discoverEndpoints([{ file: doc, version: '1.0' }], modules);

  assert.deepEqual(endpoints.map((e) => [e.id, e.module]), [
    ['GET /api/catalog/items/{id}', 'catalog'],
    ['GET /api/catalog/items/{id}/pic', 'pictures'],
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0]?.message ?? '', /GET \/api\/basket/);
});

test('sorts screens and endpoints by id', () => {
  const pages = makeTempDir();
  writeTempFile('Item/ItemPage.razor', '@page "/item/{itemId:int}"\n', pages);
  writeTempFile('Catalog/Catalog.razor', '@page "/"\n', pages);
  const doc = writeTempFile('v1.json', openApi({ '/api/orders': { post: {}, get: {} } }));

  const { screens } = discoverScreens(pages, MODULES);
  const { endpoints } = discoverEndpoints([{ file: doc, version: '1.0' }], MODULES);

  assert.deepEqual(screens.map((s) => s.id), ['webapp:/', 'webapp:/item/:itemId']);
  assert.deepEqual(endpoints.map((e) => e.id), ['GET /api/orders', 'POST /api/orders']);
});

test('merges supplement screens and endpoints and reports an unknown module', () => {
  const supplement = writeTempFile('supplement.json', {
    about: 'x',
    screens: [{ app: 'identity', route: '/account/login', module: 'identity', name: 'Login', source: 'A.cs:39' }],
    endpoints: [
      { method: 'POST', path: '/Account/Login', module: 'identity', source: 'A.cs:59' },
      { method: 'GET', path: '/nowhere', module: 'nope', source: 'A.cs:1' },
    ],
  });

  const { inventory, problems } = mergeSupplement({ screens: [], endpoints: [] }, supplement, MODULES);

  assert.deepEqual(inventory.screens.map((s) => s.id), ['identity:/account/login']);
  assert.deepEqual(inventory.endpoints.map((e) => e.id), ['POST /Account/Login']);
  assert.equal(problems.length, 1);
  assert.match(problems[0]?.message ?? '', /nope/);
});

test('reading a missing inventory file is a problem, not a crash', () => {
  const dir = makeTempDir();

  const { inventory, problems } = readInventory(join(dir, 'screens.json'), join(dir, 'endpoints.json'));

  assert.deepEqual(inventory, { screens: [], endpoints: [] });
  assert.equal(problems.length, 2);
  assert.match(problems[0]?.message ?? '', /inventory:generate/);
});
