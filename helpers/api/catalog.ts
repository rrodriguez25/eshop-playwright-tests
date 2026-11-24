import type { CatalogApiService, NewCatalogItem } from '../../api/CatalogApiService';
import { uniqueName } from '../setup/unique';

/** A catalog item this test created, with the id eShop assigned to it. */
export interface CreatedCatalogItem extends NewCatalogItem {
  id: number;
}

/**
 * Builds a valid new catalog item with a unique name, using the first existing type and brand.
 * Pass `overrides` for the fields a test cares about.
 */
export async function buildCatalogItem(
  catalog: CatalogApiService,
  overrides: Partial<NewCatalogItem> = {},
): Promise<NewCatalogItem> {
  const [type] = await catalog.getTypes();
  const [brand] = await catalog.getBrands();
  if (!type || !brand) throw new Error('buildCatalogItem: eShop has no catalog types or brands');

  return {
    name: uniqueName('test-item'),
    description: 'Created by automated test',
    price: 9.99,
    catalogTypeId: Number(type.id),
    catalogBrandId: Number(brand.id),
    availableStock: 10,
    restockThreshold: 2,
    maxStockThreshold: 50,
    ...overrides,
  };
}

/** Creates a catalog item through the API and returns it with its id. */
export async function createCatalogItem(
  catalog: CatalogApiService,
  overrides: Partial<NewCatalogItem> = {},
): Promise<CreatedCatalogItem> {
  const item = await buildCatalogItem(catalog, overrides);
  const id = await catalog.createItem(item);
  return { ...item, id };
}
