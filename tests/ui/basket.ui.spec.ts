import { expect, test } from '../../fixtures/test';
import { HeaderBar } from '../../pages/components/header-bar';
import { ItemPage } from '../../pages/item-page';

test.describe('Adding to the shopping bag', () => {
  // testUser logs the browser in as a user this test owns, so the bag starts empty.
  test('shows the item in the bag on the item page and in the header', async ({ itemPage, catalogItem, testUser: _ }) => {
    await itemPage.goto({ itemId: catalogItem.id });
    await itemPage.verifyPageIsOpen({ itemId: catalogItem.id });

    await itemPage.addToBagButton.click();

    await expect(itemPage.inBagNotice).toHaveText(`1 ${ItemPage.TEXTS.inBag} ${ItemPage.TEXTS.shoppingBag}`);
    await expect(itemPage.header.shoppingBagLink).toHaveAccessibleName(`${HeaderBar.TEXTS.shoppingBag}, 1 item`);
  });
});
