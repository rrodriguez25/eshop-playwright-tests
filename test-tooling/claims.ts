/**
 * `claims()`: how a test says which scenario-catalog rows it checks, and on which layer.
 *
 *     test('filters by name prefix', claims(['CAT-READ-FILTER-NAME-PREFIX'], 'api'), async ({ catalog }) => { ... });
 *
 * It goes in the test's details argument, never in the title. For each row it adds a tag `@<ID>`,
 * so `--grep @CAT-READ-FILTER-NAME-PREFIX` runs every test that claims the row, and a `scenario`
 * annotation `<ID> <layer>`, which the HTML report shows. Specs import it from `fixtures/test`.
 *
 * `pnpm check:scenarios` reads the call as source text, so write the ids and the layer as string
 * literals, directly in the test call. See docs/scenario-catalog.md.
 */
import type { TestDetails } from '@playwright/test';
import type { Layer } from './types';

export const SCENARIO_ANNOTATION = 'scenario';

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** This test checks these catalog rows on `layer`. Tags and annotations already in `details` are kept. */
export function claims(ids: string | readonly string[], layer: Layer, details: TestDetails = {}): TestDetails {
  const rows = typeof ids === 'string' ? [ids] : [...ids];
  return {
    ...details,
    tag: [...new Set([...asList(details.tag), ...rows.map((id) => `@${id}`)])],
    annotation: [
      ...asList(details.annotation),
      ...rows.map((id) => ({ type: SCENARIO_ANNOTATION, description: `${id} ${layer}` })),
    ],
  };
}
