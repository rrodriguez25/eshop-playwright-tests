import { expect, test } from '../../fixtures/test';

test.describe('Home page', { tag: '@smoke' }, () => {
  test('loads successfully', async ({ homePage, page }) => {
    const response = await homePage.goto();

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/.+/);
  });
});
