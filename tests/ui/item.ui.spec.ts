import { expect, knownBug, test } from '../../fixtures/test';

// The item route takes an int; no catalog item has the largest one.
const MISSING_ITEM_ID = 2147483647;

test.describe('Item page', () => {
  test('shows a not-found message for a missing item', async ({ itemPage }) => {
    await itemPage.goto({ itemId: MISSING_ITEM_ID });

    await knownBug('item-404-empty-body', async () => {
      await expect(itemPage.notFoundHeading).toBeVisible();
    });
  });
});
