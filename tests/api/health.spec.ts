import { expect, test } from '../../fixtures/test';

test.describe('Health', { tag: '@smoke' }, () => {
  test('reports healthy', async ({ api }) => {
    const response = await api.health();

    expect(response.status()).toBe(200);
  });
});
