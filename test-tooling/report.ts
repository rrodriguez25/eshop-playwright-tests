/**
 * `pnpm scenarios:report`: per module, each active row with the tests that claim it, and what the
 * module owes per layer as covered, blocked and missing. It reads spec source, not test results:
 * a covered obligation has a claiming test, which may still fail when run.
 */
import type { CheckResult } from './check';
import type { Obligation, ObligationState } from './obligations';
import { LAYERS, type Layer, type ModuleEntry, type ScenarioRow } from './types';

export interface LayerSummary {
  owed: number;
  covered: number;
  blocked: number;
  missing: number;
}

export interface ModuleReport {
  module: ModuleEntry;
  rows: { row: ScenarioRow; obligations: Obligation[] }[];
  summary: Record<Layer, LayerSummary>;
  /** The module's inventory screens no active row (of any catalog) names: information, not obligations. */
  unnamedScreens: string[];
  unnamedEndpoints: string[];
}

function summarise(obligations: Obligation[]): LayerSummary {
  const count = (state: ObligationState) => obligations.filter((o) => o.state === state).length;
  return { owed: obligations.length, covered: count('covered'), blocked: count('blocked'), missing: count('missing') };
}

export function buildModuleReport(moduleId: string, result: CheckResult): ModuleReport {
  const module = result.modules.find((m) => m.id === moduleId);
  if (!module) {
    throw new Error(`Unknown module ${moduleId}. Known: ${result.modules.map((m) => m.id).join(', ')}`);
  }
  const activeRows = result.catalogs.flatMap((c) => c.scenarios.filter((r) => r.status === 'active'));
  const ownRows = result.catalogs.filter((c) => c.module === moduleId).flatMap((c) => c.scenarios.filter((r) => r.status === 'active'));
  const ownObligations = result.obligations.filter((o) => o.module === moduleId);
  const namedScreens = new Set(activeRows.flatMap((r) => r.screens));
  const namedEndpoints = new Set(activeRows.flatMap((r) => r.endpoints));

  return {
    module,
    rows: ownRows.map((row) => ({ row, obligations: ownObligations.filter((o) => o.rowId === row.id) })),
    summary: {
      ui: summarise(ownObligations.filter((o) => o.layer === 'ui')),
      api: summarise(ownObligations.filter((o) => o.layer === 'api')),
    },
    unnamedScreens: result.inventory.screens.filter((s) => s.module === moduleId && !namedScreens.has(s.id)).map((s) => s.id),
    unnamedEndpoints: result.inventory.endpoints.filter((e) => e.module === moduleId && !namedEndpoints.has(e.id)).map((e) => e.id),
  };
}

function percentage({ owed, covered }: LayerSummary): string {
  return owed === 0 ? '-' : `${Math.round((covered / owed) * 100)}%`;
}

function summaryLine(label: string, summary: LayerSummary): string {
  return `${label} ${String(summary.owed).padStart(3)} owed → ${summary.covered} covered · ${summary.blocked} blocked · ` +
    `${summary.missing} missing   ${percentage(summary)}`;
}

function obligationLines(obligation: Obligation): string[] {
  const head = `    ${obligation.layer.padEnd(4)} ${obligation.state.padEnd(8)}`;
  if (obligation.claims.length === 0) return [`${head} no test claims it`];
  return obligation.claims.map((claim) => {
    const note = claim.skipped ? ' (skipped)' : claim.knownBug ? ' (known eShop bug)' : '';
    return `${head} ${claim.file}:${claim.line}  ${claim.title}${note}`;
  });
}

export function formatModuleReport(report: ModuleReport): string {
  const lines = [`${report.module.name} (${report.module.id}): ${report.rows.length} active row(s)`, ''];
  for (const { row, obligations } of report.rows) {
    lines.push(`  ${row.id}  ${row.kind}  ${row.behaviour}`);
    if (obligations.length === 0) lines.push('    owes nothing: names no screen or endpoint, and no test claims it');
    for (const obligation of obligations) lines.push(...obligationLines(obligation));
  }
  lines.push('');
  for (const layer of LAYERS) lines.push(summaryLine(layer.toUpperCase().padEnd(4), report.summary[layer]));
  for (const state of ['missing', 'blocked'] as const) {
    const listed = report.rows.flatMap(({ obligations }) => obligations.filter((o) => o.state === state));
    if (listed.length > 0) lines.push(`  ${state}: ${listed.map((o) => `${o.rowId} (${o.layer})`).join(', ')}`);
  }
  if (report.unnamedScreens.length > 0 || report.unnamedEndpoints.length > 0) {
    lines.push('', 'Not named by any active row yet (information, not obligations):');
    if (report.unnamedScreens.length > 0) lines.push(`  screens:   ${report.unnamedScreens.join(', ')}`);
    if (report.unnamedEndpoints.length > 0) lines.push(`  endpoints: ${report.unnamedEndpoints.join(', ')}`);
  }
  return lines.join('\n');
}

export function formatOverview(reports: ModuleReport[]): string {
  const lines: string[] = [];
  for (const report of reports) {
    for (const layer of LAYERS) {
      lines.push(summaryLine(`${report.module.id.padEnd(10)} ${layer.padEnd(4)}`, report.summary[layer]));
    }
  }
  for (const layer of LAYERS) {
    const total = reports.reduce<LayerSummary>((sum, report) => {
      const s = report.summary[layer];
      return { owed: sum.owed + s.owed, covered: sum.covered + s.covered, blocked: sum.blocked + s.blocked, missing: sum.missing + s.missing };
    }, { owed: 0, covered: 0, blocked: 0, missing: 0 });
    lines.push(summaryLine(`${'total'.padEnd(10)} ${layer.padEnd(4)}`, total));
  }
  return lines.join('\n');
}
