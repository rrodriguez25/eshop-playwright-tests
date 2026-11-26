import { expect, test } from '../../fixtures/test';
import { staticUserKeys } from '../../helpers/setup/static-users';

// Runs before the UI tests, once per run and without retries: a wrong password then costs each
// static user one failed attempt, far from Identity's lockout after five.
test.describe('Static users', () => {
  for (const key of staticUserKeys) {
    test(`${key} logs in with USER_PASSWORD`, async ({ identity, staticCredentials }) => {
      await expect(
        identity.logIn(staticCredentials(key)),
        `${key} should log in with USER_PASSWORD from .env (seeded users: see eShop's UsersSeed.cs)`,
      ).resolves.toBeDefined();
    });
  }
});
