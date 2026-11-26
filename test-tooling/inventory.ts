/**
 * The screen and endpoint inventories: every screen eShop's web app routes to and every endpoint its
 * OpenAPI documents describe, each assigned to a module. Catalog rows may only name what these list.
 *
 * `pnpm inventory:generate` builds them from eShop's source and writes `test-tooling/inventory/`;
 * the check and the report only read the committed files.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isRecord, isStringList, readJson } from './json';
import { repoRelative } from './paths';
import { SCREEN_APPS, type EndpointItem, type Inventory, type ModuleEntry, type Problem, type ScreenApp, type ScreenItem } from './types';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];
const PAGE_DIRECTIVE = /^﻿?\s*@page\s+"([^"]+)"/;

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * A Blazor `@page` template as a screen route: each `{name}` or `{name:constraint}` parameter is
 * written `:name`, the way page objects write `URL_PATH`, and literal segments are lower-cased.
 */
export function routeToScreenRoute(template: string): string {
  const segments = template
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const parameter = /^\{\*?([A-Za-z0-9_]+)(:[^}]*)?\??\}$/.exec(segment);
      return parameter ? `:${parameter[1]}` : segment.toLowerCase();
    });
  return `/${segments.join('/')}`;
}

function razorFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return razorFiles(full);
    return entry.name.endsWith('.razor') ? [full] : [];
  });
}

function sourceMatches(source: string, relativeFile: string): boolean {
  return source.endsWith('.razor') ? relativeFile === source : relativeFile.startsWith(`${source}/`);
}

/** Matches `candidates` to modules; returns the one module, or a problem message. */
function singleModule(what: string, matches: ModuleEntry[]): { module: string } | { problem: string } {
  const [first, second] = matches;
  if (!first) return { problem: `${what} belongs to no module in test-tooling/modules.json` };
  if (second) return { problem: `${what} belongs to two modules: ${matches.map((m) => m.id).join(', ')}` };
  return { module: first.id };
}

/**
 * Every `@page` route under `pagesDir` (eShop's `src/WebApp/Components/Pages`), as a `webapp` screen.
 * `sourcePrefix` is prepended to each screen's `source` so it reads relative to the eShop clone.
 */
export function discoverScreens(
  pagesDir: string,
  modules: ModuleEntry[],
  sourcePrefix = '',
): { screens: ScreenItem[]; problems: Problem[] } {
  const screens: ScreenItem[] = [];
  const problems: Problem[] = [];
  for (const file of razorFiles(pagesDir)) {
    const relativeFile = path.relative(pagesDir, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const directive = PAGE_DIRECTIVE.exec(line);
      if (!directive?.[1]) return;
      const source = `${sourcePrefix}${relativeFile}:${index + 1}`;
      const owner = singleModule(source, modules.filter((m) => m.screenSources.some((s) => sourceMatches(s, relativeFile))));
      if ('problem' in owner) {
        problems.push({ level: 'error', where: source, message: owner.problem });
        return;
      }
      const route = routeToScreenRoute(directive[1]);
      screens.push({
        id: `webapp:${route}`,
        app: 'webapp',
        route,
        module: owner.module,
        name: path.basename(file, '.razor'),
        source,
      });
    });
  }
  return { screens: screens.sort(byId), problems };
}

function endpointModule(endpointPath: string, modules: ModuleEntry[]): ModuleEntry[] {
  const candidates = modules.flatMap((module) =>
    module.endpointPrefixes
      .filter((prefix) => endpointPath === prefix || endpointPath.startsWith(`${prefix}/`))
      .map((prefix) => ({ module, length: prefix.length })),
  );
  const longest = Math.max(...candidates.map((c) => c.length));
  return candidates.filter((c) => c.length === longest).map((c) => c.module);
}

/** Every operation in the OpenAPI `documents`, one item per `METHOD /path` across versions. */
export function discoverEndpoints(
  documents: readonly { file: string; version: string }[],
  modules: ModuleEntry[],
): { endpoints: EndpointItem[]; problems: Problem[] } {
  const found = new Map<string, EndpointItem>();
  const problems: Problem[] = [];
  for (const document of documents) {
    const source = repoRelative(document.file);
    const read = readJson(document.file);
    if ('error' in read) {
      problems.push({ level: 'error', where: source, message: `not valid JSON: ${read.error}` });
      continue;
    }
    const paths = isRecord(read.value) ? read.value.paths : undefined;
    if (!isRecord(paths)) {
      problems.push({ level: 'error', where: source, message: 'has no "paths" object' });
      continue;
    }
    for (const [endpointPath, operations] of Object.entries(paths)) {
      if (!isRecord(operations)) continue;
      for (const [method, operation] of Object.entries(operations)) {
        if (!HTTP_METHODS.includes(method)) continue;
        const id = `${method.toUpperCase()} ${endpointPath}`;
        const existing = found.get(id);
        if (existing) {
          if (!existing.versions.includes(document.version)) existing.versions.push(document.version);
          continue;
        }
        const owner = singleModule(id, endpointModule(endpointPath, modules));
        if ('problem' in owner) {
          problems.push({ level: 'error', where: source, message: owner.problem });
          continue;
        }
        const operationId = isRecord(operation) && typeof operation.operationId === 'string' ? operation.operationId : undefined;
        found.set(id, {
          id,
          method: method.toUpperCase(),
          path: endpointPath,
          module: owner.module,
          versions: [document.version],
          ...(operationId ? { operationId } : {}),
          source,
        });
      }
    }
  }
  return { endpoints: [...found.values()].sort(byId), problems };
}

function isScreenApp(value: unknown): value is ScreenApp {
  return SCREEN_APPS.some((app) => app === value);
}

/**
 * Adds the hand-kept `supplement.json` entries: screens and endpoints that no `@page` route or
 * OpenAPI document lists, such as Identity's MVC account pages. Each entry names its module and
 * its eShop `file:line`.
 */
export function mergeSupplement(
  inventory: Inventory,
  supplementFile: string,
  modules: ModuleEntry[],
): { inventory: Inventory; problems: Problem[] } {
  const where = repoRelative(supplementFile);
  const read = readJson(supplementFile);
  if ('error' in read) {
    return { inventory, problems: [{ level: 'error', where, message: `not valid JSON: ${read.error}` }] };
  }
  const content = isRecord(read.value) ? read.value : {};
  const problems: Problem[] = [];
  const moduleIds = new Set(modules.map((m) => m.id));
  const screens = [...inventory.screens];
  const endpoints = [...inventory.endpoints];

  const entries = (key: string): Record<string, unknown>[] => {
    const list = content[key];
    return Array.isArray(list) ? list.filter(isRecord) : [];
  };
  const knownModule = (module: unknown, label: string): module is string => {
    if (typeof module === 'string' && moduleIds.has(module)) return true;
    problems.push({ level: 'error', where, message: `${label}: module "${String(module)}" is not in test-tooling/modules.json` });
    return false;
  };

  for (const { app, route, module, name, source } of entries('screens')) {
    const label = `screen ${String(app)}:${String(route)}`;
    if (!isScreenApp(app) || typeof route !== 'string' || typeof name !== 'string' || typeof source !== 'string') {
      problems.push({ level: 'error', where, message: `${label} needs app (${SCREEN_APPS.join(' or ')}), route, name and source` });
      continue;
    }
    if (!knownModule(module, label)) continue;
    const normalised = routeToScreenRoute(route);
    screens.push({ id: `${app}:${normalised}`, app, route: normalised, module, name, source });
  }
  for (const { method, path: endpointPath, module, source } of entries('endpoints')) {
    const label = `endpoint ${String(method)} ${String(endpointPath)}`;
    if (typeof method !== 'string' || typeof endpointPath !== 'string' || typeof source !== 'string') {
      problems.push({ level: 'error', where, message: `${label} needs method, path and source` });
      continue;
    }
    if (!knownModule(module, label)) continue;
    const upper = method.toUpperCase();
    endpoints.push({ id: `${upper} ${endpointPath}`, method: upper, path: endpointPath, module, versions: [], source });
  }

  for (const list of [screens, endpoints]) {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) problems.push({ level: 'error', where, message: `${item.id} is listed twice` });
      seen.add(item.id);
    }
  }
  return { inventory: { screens: screens.sort(byId), endpoints: endpoints.sort(byId) }, problems };
}

function toScreenItem(raw: unknown): ScreenItem | null {
  if (!isRecord(raw)) return null;
  const { id, app, route, module, name, source } = raw;
  if (typeof id !== 'string' || !isScreenApp(app) || typeof route !== 'string' || typeof module !== 'string'
    || typeof name !== 'string' || typeof source !== 'string') return null;
  return { id, app, route, module, name, source };
}

function toEndpointItem(raw: unknown): EndpointItem | null {
  if (!isRecord(raw)) return null;
  const { id, method, path: endpointPath, module, versions, operationId, source } = raw;
  if (typeof id !== 'string' || typeof method !== 'string' || typeof endpointPath !== 'string'
    || typeof module !== 'string' || !isStringList(versions) || typeof source !== 'string') return null;
  return { id, method, path: endpointPath, module, versions, ...(typeof operationId === 'string' ? { operationId } : {}), source };
}

function readItems<T>(file: string, convert: (raw: unknown) => T | null, problems: Problem[]): T[] {
  const where = repoRelative(file);
  if (!existsSync(file)) {
    problems.push({ level: 'error', where, message: 'is missing; run pnpm inventory:generate' });
    return [];
  }
  const read = readJson(file);
  const items = 'error' in read || !isRecord(read.value) ? undefined : read.value.items;
  if (!Array.isArray(items)) {
    problems.push({ level: 'error', where, message: 'is not an { items: [...] } inventory file; run pnpm inventory:generate' });
    return [];
  }
  const converted: T[] = [];
  items.forEach((raw, index) => {
    const item = convert(raw);
    if (item) converted.push(item);
    else problems.push({ level: 'error', where, message: `item ${index} is malformed; run pnpm inventory:generate` });
  });
  return converted;
}

/** Reads the committed inventory files. A missing or malformed file is a problem, not a crash. */
export function readInventory(screensFile: string, endpointsFile: string): { inventory: Inventory; problems: Problem[] } {
  const problems: Problem[] = [];
  const screens = readItems(screensFile, toScreenItem, problems);
  const endpoints = readItems(endpointsFile, toEndpointItem, problems);
  return { inventory: { screens, endpoints }, problems };
}

const GENERATED_NOTE = 'Generated by pnpm inventory:generate from eShop. Do not edit; edit supplement.json or modules.json and regenerate.';

/** Writes both inventory files, sorted, with 2-space JSON and a trailing newline. */
export function writeInventory(inventory: Inventory, screensFile: string, endpointsFile: string): void {
  const write = (file: string, items: unknown[]) =>
    writeFileSync(file, `${JSON.stringify({ about: GENERATED_NOTE, items }, null, 2)}\n`);
  write(screensFile, [...inventory.screens].sort(byId));
  write(endpointsFile, [...inventory.endpoints].sort(byId));
}
