/**
 * What each catalog row owes, per test layer, and whether a test pays it.
 *
 * - UI is owed when the row names a screen, or a test under tests/ui claims it.
 * - API is owed when the row names an endpoint, or a test under tests/api claims it.
 *
 * An owed (row, layer) is covered when a test that runs and isn't a known eShop bug claims it,
 * blocked when only known-bug tests claim it, and missing otherwise. See docs/scenario-catalog.md.
 */
import type { Claim } from './scan';
import { LAYERS, type CatalogFile, type Layer, type ScenarioRow } from '../types';

export type ObligationState = 'covered' | 'blocked' | 'missing';

export interface Obligation {
  rowId: string;
  module: string;
  layer: Layer;
  state: ObligationState;
  /** Every claim of this row on this layer, whatever its state. */
  claims: Claim[];
}

function namesLayer(row: ScenarioRow, layer: Layer): boolean {
  return layer === 'ui' ? row.screens.length > 0 : row.endpoints.length > 0;
}

function stateOf(claims: Claim[]): ObligationState {
  const running = claims.filter((c) => !c.skipped);
  if (running.some((c) => !c.knownBug)) return 'covered';
  return running.length > 0 ? 'blocked' : 'missing';
}

/** One obligation per owed (active row, layer), in catalog and row order, UI before API. */
export function computeObligations(catalogs: CatalogFile[], claims: Claim[]): Obligation[] {
  const obligations: Obligation[] = [];
  for (const catalog of catalogs) {
    for (const row of catalog.scenarios.filter((r) => r.status === 'active')) {
      for (const layer of LAYERS) {
        const layerClaims = claims.filter((c) => c.layer === layer && c.ids.includes(row.id));
        if (!namesLayer(row, layer) && layerClaims.length === 0) continue;
        obligations.push({ rowId: row.id, module: catalog.module, layer, state: stateOf(layerClaims), claims: layerClaims });
      }
    }
  }
  return obligations;
}
