import { test, expect } from '../../fixtures/test';
import { ContractError, ContractValidator, type OpenApiDocument } from '../../api/contract';
import catalogV1 from '../../api/generated/catalog.v1.openapi.json';
import { createCatalogItem } from '../../helpers/api/catalog';

// CatalogApiService validates every response against eShop's OpenAPI document, so each call below
// fails with a ContractError if the response breaks the contract.

test.describe('Catalog API contract', { tag: '@contract' }, () => {
  test.describe('success responses', () => {
    test('GET /items (v2) matches the contract', async ({ catalog }) => {
      const page = await catalog.getItems({ pageSize: 5 });

      expect(page.data.length).toBeGreaterThan(0);
    });

    test('GET /items/{id} matches the contract', async ({ catalog }) => {
      const item = await catalog.getItem(1);

      expect(item.id).toBe(1);
    });

    test('GET /items/by matches the contract', async ({ catalog }) => {
      const items = await catalog.getItemsByIds([1, 2]);

      expect(items).toHaveLength(2);
    });

    test('GET /catalogtypes matches the contract', async ({ catalog }) => {
      expect((await catalog.getTypes()).length).toBeGreaterThan(0);
    });

    test('GET /catalogbrands matches the contract', async ({ catalog }) => {
      expect((await catalog.getBrands()).length).toBeGreaterThan(0);
    });

    test('POST, PUT and DELETE /items match the contract', async ({ catalog }) => {
      const { id } = await createCatalogItem(catalog);

      await catalog.updateItem(id, { price: 12.5 });
      await catalog.deleteItem(id);

      await expect(catalog.getItem(id)).rejects.toThrow();
    });
  });

  test.describe('error responses', () => {
    test('GET /items/{id} with an invalid id returns the documented 400', async ({ catalog }) => {
      await expect(catalog.getItem(0)).rejects.toThrow('GET /api/catalog/items/0 -> 400');
    });

    test('GET /items/{id} for a missing item returns the documented 404', async ({ catalog }) => {
      await expect(catalog.getItem(999_999_999)).rejects.toThrow('GET /api/catalog/items/999999999 -> 404');
    });

    test('DELETE /items/{id} for a missing item returns the documented 404', async ({ catalog }) => {
      await expect(catalog.deleteItem(999_999_999)).rejects.toThrow('DELETE /api/catalog/items/999999999 -> 404');
    });

    test('POST /items without a name returns the documented 400', async ({ catalog }) => {
      test.fail(true, 'eShop bug: a missing name fails in the database and returns an undocumented 500');

      await expect(catalog.createItem({ name: undefined } as never, 1)).rejects.toThrow('POST /api/catalog/items -> 400');
    });
  });
});

test.describe('Contract validator', { tag: '@contract' }, () => {
  const validator = new ContractValidator('catalog-v1', catalogV1 as unknown as OpenApiDocument);
  const getItem = { method: 'get', path: '/api/catalog/items/{id}' } as const;
  const validItem = {
    id: 1, name: 'Item', description: null, price: 9.99, pictureFileName: null,
    catalogTypeId: 1, catalogType: null, catalogBrandId: 1, catalogBrand: null,
    availableStock: 1, restockThreshold: 0, maxStockThreshold: 10, onReorder: false,
  };
  const check = (status: number, body: unknown, contentType = 'application/json; charset=utf-8') =>
    () => validator.check(getItem, status, contentType, typeof body === 'string' ? body : JSON.stringify(body));

  test('accepts a response that matches the contract', () => {
    expect(check(200, validItem)).not.toThrow();
  });

  test('rejects a missing non-nullable property', () => {
    const { price: _price, ...withoutPrice } = validItem;

    expect(check(200, withoutPrice)).toThrow(ContractError);
    expect(check(200, withoutPrice)).toThrow("must have required property 'price'");
  });

  test('rejects a number sent as a string', () => {
    expect(check(200, { ...validItem, price: '9.99' })).toThrow('/price must be number');
  });

  test('rejects an int32 value out of range', () => {
    expect(check(200, { ...validItem, id: 2 ** 31 })).toThrow('/id must match format "int32"');
  });

  test('rejects a status the contract does not document', () => {
    expect(check(500, {})).toThrow('status is not in the contract');
  });

  test('accepts a problem details body on an error the contract documents without a body', () => {
    const problem = { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5', title: 'Not Found', status: 404, traceId: '00-1' };

    expect(check(404, problem, 'application/problem+json')).not.toThrow();
  });

  test('rejects a malformed problem details body', () => {
    expect(check(404, { title: 'Not Found', status: 500 }, 'application/problem+json')).toThrow('reports status 500');
    expect(check(404, { title: 42 }, 'application/problem+json')).toThrow('/title must be string');
  });

  test('rejects any other body where the contract documents none', () => {
    expect(check(404, { error: 'missing' })).toThrow('the contract documents none');
  });

  test('rejects an undocumented content type', () => {
    expect(check(200, validItem, 'text/html')).toThrow('content type "text/html" is not in the contract');
  });
});
