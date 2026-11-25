import { expect, test } from '../../fixtures/test';
import { staticUser } from '../../helpers/setup/static-users';

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

test.describe('Per-worker login', () => {
  // A worker logs in several users with one client. If the first user's Identity cookie carried
  // over, the second login would skip Identity's form and fail at its first step.
  test('logs a second user in after the first', async ({ identity, staticCredentials }) => {
    await identity.logIn(staticCredentials('alice'));

    await expect(identity.logIn(staticCredentials('bob'))).resolves.toBeDefined();
  });
});

test.describe('Header without a user', () => {
  test('shows the sign-in link', async ({ homePage }) => {
    await homePage.goto();

    await homePage.verifyPageIsOpen();
    await expect(homePage.header.signInLink).toBeVisible();
  });
});
