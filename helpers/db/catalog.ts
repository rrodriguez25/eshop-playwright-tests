import type { Queryable } from '../../db/Database';

/** A row of catalogdb's "Catalog" table, with camelCase names and `price` as a number. */
export interface CatalogItemRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  catalogTypeId: number;
  catalogBrandId: number;
  availableStock: number;
  restockThreshold: number;
  maxStockThreshold: number;
  onReorder: boolean;
}

const CATALOG_ITEM_COLUMNS = `
  "Id" as "id",
  "Name" as "name",
  "Description" as "description",
  "Price"::float8 as "price",
  "CatalogTypeId" as "catalogTypeId",
  "CatalogBrandId" as "catalogBrandId",
  "AvailableStock" as "availableStock",
  "RestockThreshold" as "restockThreshold",
  "MaxStockThreshold" as "maxStockThreshold",
  "OnReorder" as "onReorder"`;

export function findCatalogItemById(db: Queryable, id: number): Promise<CatalogItemRow | undefined> {
  return db.queryOne<CatalogItemRow>(`select ${CATALOG_ITEM_COLUMNS} from "Catalog" where "Id" = $1`, [id]);
}

export function findCatalogItemByName(db: Queryable, name: string): Promise<CatalogItemRow | undefined> {
  return db.queryOne<CatalogItemRow>(`select ${CATALOG_ITEM_COLUMNS} from "Catalog" where "Name" = $1`, [name]);
}
