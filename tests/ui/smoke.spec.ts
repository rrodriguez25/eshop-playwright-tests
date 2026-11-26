import { claims, expect, test } from '../../fixtures/test';

test.describe('Home page', { tag: '@smoke' }, () => {
  test('loads successfully', claims('CAT-UI-HOME-OPENS', 'ui'), async ({ homePage }) => {
    const response = await homePage.goto();

    expect(response?.ok()).toBe(true);
    await homePage.verifyPageIsOpen();
  });
});

test.describe('Item page', { tag: '@smoke' }, () => {
  test('loads for an existing item', claims('CAT-UI-ITEM-OPENS', 'ui'), async ({ itemPage, catalogItem }) => {
    const response = await itemPage.goto({ itemId: catalogItem.id });

    expect(response?.ok()).toBe(true);
    await itemPage.verifyPageIsOpen({ itemId: catalogItem.id });
  });
});

test.describe('Cart page', { tag: '@smoke' }, () => {
  // Opening the cart only reads alice's basket, so the shared static user is safe here.
  test.use({ user: 'alice' });

  test('loads for a logged-in user', async ({ cartPage }) => {
    const response = await cartPage.goto();

    expect(response?.ok()).toBe(true);
    await cartPage.verifyPageIsOpen();
  });
});
