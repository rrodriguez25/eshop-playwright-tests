// Builds test-tooling/inventory/screens.json and endpoints.json from eShop's source.
// Usage: pnpm inventory:generate (needs ESHOP_SOURCE_DIR in .env; eShop need not be running).
// Run it after pnpm generate:api-types, or whenever eShop's pages change.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { discoverEndpoints, discoverScreens, mergeSupplement, writeInventory } from '../test-tooling/inventory/inventory';
import { readModules } from '../test-tooling/modules';
import {
  ENDPOINTS_FILE, MODULES_FILE, OPENAPI_DOCUMENTS, SCREENS_FILE, SUPPLEMENT_FILE, WEBAPP_PAGES_DIR, repoRelative,
} from '../test-tooling/paths';
import { printProblems } from '../test-tooling/print';

const { modules, problems: moduleProblems } = readModules(MODULES_FILE);
const pagesDir = path.join(env.eshopSourceDir, WEBAPP_PAGES_DIR);
const sourcePrefix = `${WEBAPP_PAGES_DIR.replace(/\\/g, '/')}/`;
if (!existsSync(pagesDir)) {
  console.error(`ERROR  ${pagesDir} does not exist. Set ESHOP_SOURCE_DIR in .env to your eShop clone.`);
  process.exit(1);
}

const { screens, problems: screenProblems } = discoverScreens(pagesDir, modules, sourcePrefix);
const { endpoints, problems: endpointProblems } = discoverEndpoints(OPENAPI_DOCUMENTS, modules);
const { inventory, problems: supplementProblems } = mergeSupplement({ screens, endpoints }, SUPPLEMENT_FILE, modules);

const problems = [...moduleProblems, ...screenProblems, ...endpointProblems, ...supplementProblems];
printProblems(problems);
if (problems.some((p) => p.level === 'error')) {
  console.error('Inventory not written.');
  process.exit(1);
}

writeInventory(inventory, SCREENS_FILE, ENDPOINTS_FILE);
console.log(`${inventory.screens.length} screens -> ${repoRelative(SCREENS_FILE)}`);
console.log(`${inventory.endpoints.length} endpoints -> ${repoRelative(ENDPOINTS_FILE)}`);
