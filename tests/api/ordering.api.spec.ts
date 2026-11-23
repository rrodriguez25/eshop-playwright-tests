import { test, expect } from '../../fixtures/test';

test.describe('Ordering API', () => {
  test.describe('auth contract — all endpoints require Bearer token', () => {
    test('GET /api/orders returns 401 without token', async ({ ordering }) => {
      const status = await ordering.getOrdersStatus();
      expect(status).toBe(401);
    });

    test('GET /api/orders/cardtypes returns 401 without token', async ({ ordering }) => {
      const status = await ordering.getCardTypesStatus();
      expect(status).toBe(401);
    });
  });
});
