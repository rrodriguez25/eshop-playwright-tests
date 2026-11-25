import { expect, test } from '../../fixtures/test';
import { staticUser } from '../../helpers/setup/static-users';

// Alice and bob in one file also prove that a second user logged in by the same worker gets their
// own session, not the first user's.

test.describe('Logged-in header as alice', () => {
  test.use({ user: 'alice' });

  test('shows alice in the account menu', async ({ homePage }) => {
    await homePage.goto();

    await homePage.verifyPageIsOpen();
    await homePage.header.verifyLoggedInAs(staticUser('alice').username);
  });
});

test.describe('Logged-in header as bob', () => {
  test.use({ user: 'bob' });

  test('shows bob in the account menu', async ({ homePage }) => {
    await homePage.goto();

    await homePage.verifyPageIsOpen();
    await homePage.header.verifyLoggedInAs(staticUser('bob').username);
  });
});

test.describe('Header without a user', () => {
  test('shows the sign-in link', async ({ homePage }) => {
    await homePage.goto();

    await homePage.verifyPageIsOpen();
    await expect(homePage.header.signInLink).toBeVisible();
  });
});
