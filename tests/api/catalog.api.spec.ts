import { test, expect } from '../../fixtures/test';
import { uniqueName } from '../../helpers/unique';
import type { NewCatalogItem } from '../../api/CatalogApiService';

test.describe('Catalog API', () => {

  test.describe('GET /api/catalog/items', () => {
    test('returns paginated items with correct shape', async ({ catalog }) => {
      const result = await catalog.getItems();
      expect(result.pageIndex).toBe(0);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.count).toBeGreaterThan(0);
      expect(result.data[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String), price: expect.any(Number) });
    });

    test('filters by name prefix', async ({ catalog }) => {
      const result = await catalog.getItems({ name: 'Adventurer' });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(i => i.name.startsWith('Adventurer'))).toBe(true);
    });

    test('respects pageSize', async ({ catalog }) => {
      const result = await catalog.getItems({ pageSize: 2 });
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    test('filters by type ids and returns only matching items', async ({ catalog }) => {
      const types = await catalog.getTypes();
      const ids = types.slice(0, 2).map(t => Number(t.id));
      const result = await catalog.getItems({ type: ids });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(i => ids.includes(Number(i.catalogTypeId)))).toBe(true);
    });

    test('filters by name and type and brand combined', async ({ catalog }) => {
      const types = await catalog.getTypes();
      const brands = await catalog.getBrands();
      const result = await catalog.getItems({
        name: '.NET',
        type: [Number(types[0]!.id)],
        brand: [Number(brands[0]!.id)],
      });
      expect(result).toMatchObject({ pageIndex: 0, data: expect.any(Array) });
    });
  });

  test.describe('GET /api/catalog/items/by', () => {
    test('getItemsByIds returns matching items', async ({ catalog }) => {
      const items = await catalog.getItemsByIds([1, 2, 3]);
      expect(items.length).toBe(3);
      expect(items.map(i => Number(i.id)).sort()).toEqual([1, 2, 3]);
    });

    test('getItemsByIds with empty array returns empty list', async ({ catalog }) => {
      const items = await catalog.getItemsByIds([]);
      expect(items).toEqual([]);
    });
  });

  test.describe('GET /api/catalog/items/:id', () => {
    test('returns item by id', async ({ catalog }) => {
      const item = await catalog.getItem(1);
      expect(item.id).toBe(1);
      expect(item.name).toBeTruthy();
      expect(item.price).toBeGreaterThan(0);
    });
  });

  test.describe('GET /api/catalog/catalogtypes and /catalogbrands', () => {
    test('returns non-empty types list', async ({ catalog }) => {
      const types = await catalog.getTypes();
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toMatchObject({ id: expect.any(Number), type: expect.any(String) });
    });

    test('returns non-empty brands list', async ({ catalog }) => {
      const brands = await catalog.getBrands();
      expect(brands.length).toBeGreaterThan(0);
      expect(brands[0]).toMatchObject({ id: expect.any(Number), brand: expect.any(String) });
    });
  });

  test.describe('POST + DELETE /api/catalog/items — test data lifecycle', () => {
    test.describe.configure({ mode: 'serial' });
    let createdId: number | undefined;
    const itemName = uniqueName('test-item');
    let typeId: number;
    let brandId: number;

    test.beforeAll(async ({ catalog }) => {
      const types = await catalog.getTypes();
      const brands = await catalog.getBrands();
      typeId = Number(types[0]!.id);
      brandId = Number(brands[0]!.id);
      const newItem: NewCatalogItem = {
        name: itemName,
        description: 'Created by automated test',
        price: 9.99,
        catalogTypeId: typeId,
        catalogBrandId: brandId,
        availableStock: 10,
        restockThreshold: 2,
        maxStockThreshold: 50,
      };
      createdId = await catalog.createItem(newItem);
    });

    test.afterAll(async ({ catalog }) => {
      if (createdId !== undefined) {
        await catalog.deleteItem(createdId);
      }
    });

    test('createItem returns a positive integer id', () => {
      expect(createdId).toBeGreaterThan(0);
    });

    test('created item is fetchable by id', async ({ catalog }) => {
      const item = await catalog.getItem(createdId!);
      expect(item.name).toBe(itemName);
      expect(item.price).toBe(9.99);
    });

    test('updateItem changes a field on the item', async ({ catalog }) => {
      await catalog.updateItem(createdId!, { price: 19.99 });
      const updated = await catalog.getItem(createdId!);
      expect(updated.price).toBe(19.99);
    });

    test('updateItem does not wipe fields when patch has explicit undefined', async ({ catalog }) => {
      const before = await catalog.getItem(createdId!);
      const patch = { description: 'explicit-patch-only', price: undefined } as Partial<NewCatalogItem>;
      await catalog.updateItem(createdId!, patch);
      const after = await catalog.getItem(createdId!);
      expect(Number(after.price)).toBe(Number(before.price));
    });
  });

  test.describe('DELETE edge cases', () => {
    test('deleteItem on non-existent id throws', async ({ catalog }) => {
      await expect(catalog.deleteItem(999999999)).rejects.toThrow();
    });
  });

});
