/**
 * The shapes the scenario tooling works with: modules, inventory items, catalog rows and the
 * problems the check reports. See docs/scenario-catalog.md.
 */

/** The test layers a row can owe a proof on, and a claim can be made from. */
export const LAYERS = ['ui', 'api'] as const;
export type Layer = (typeof LAYERS)[number];

export const KINDS = ['happy', 'error', 'edge', 'regression'] as const;
export type Kind = (typeof KINDS)[number];

export const SOURCES = ['screen', 'business-rule', 'bug', 'new-feature', 'existing-test'] as const;
export type Source = (typeof SOURCES)[number];

export const STATUSES = ['active', 'retired'] as const;
export type Status = (typeof STATUSES)[number];

/** `<PREFIX>-<GROUP>-<SLUG>` in capitals: `CAT-READ-FILTER-NAME-PREFIX`. */
export const ROW_ID_PATTERN = /^[A-Z]{2,4}-[A-Z]+-[A-Z0-9-]*[A-Z0-9]$/;

/** 2 to 4 capital letters. */
export const PREFIX_PATTERN = /^[A-Z]{2,4}$/;

/** The apps a screen can belong to. */
export const SCREEN_APPS = ['webapp', 'identity'] as const;
export type ScreenApp = (typeof SCREEN_APPS)[number];

/** One entry of `test-tooling/modules.json`. */
export interface ModuleEntry {
  id: string;
  name: string;
  prefix: string;
  /** Folders or single `.razor` files under eShop's `src/WebApp/Components/Pages`. */
  screenSources: string[];
  /** Path prefixes whose endpoints belong to the module. */
  endpointPrefixes: string[];
}

export interface ScreenItem {
  /** `<app>:<route>`: `webapp:/item/:itemId`. */
  id: string;
  app: ScreenApp;
  route: string;
  module: string;
  name: string;
  /** Where in eShop the screen is declared, `file:line` relative to the eShop clone. */
  source: string;
}

export interface EndpointItem {
  /** `METHOD /path` as the OpenAPI document spells it: `GET /api/catalog/items/{id}`. */
  id: string;
  method: string;
  path: string;
  module: string;
  /** The API versions whose documents list it, e.g. `['1.0', '2.0']`. */
  versions: string[];
  operationId?: string;
  /** The OpenAPI document (repo-relative) or eShop `file:line` it comes from. */
  source: string;
}

export interface Inventory {
  screens: ScreenItem[];
  endpoints: EndpointItem[];
}

export interface ScenarioRow {
  id: string;
  behaviour: string;
  screens: string[];
  endpoints: string[];
  kind: Kind;
  source: Source;
  sourceNote: string;
  status: Status;
  /** The day the row was written or last changed, YYYY-MM-DD. */
  lastUpdated: string;
}

/** One `<module>.scenarios.json`. */
export interface CatalogFile {
  module: string;
  prefix: string;
  scenarios: ScenarioRow[];
}

export interface Problem {
  level: 'error' | 'warning';
  /** The file, row or test the problem is about. */
  where: string;
  message: string;
}
