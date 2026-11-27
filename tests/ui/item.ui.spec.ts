import { expect, knownBug, test } from '../../fixtures/test';

// The item route takes an int; no catalog item has the largest one.
const MISSING_ITEM_ID = 2147483647;

test.describe('Item page', () => {
  test('shows a not-found message for a missing item', async ({ itemPage }) => {
    await itemPage.goto({ itemId: MISSING_ITEM_ID });

    // Known bug: eShop answers 404 with an empty body, so the not-found message never renders.
    await knownBug('issue-2026-11-25-49350', async () => {
      await expect(itemPage.notFoundHeading).toBeVisible();
    });
  });
});
