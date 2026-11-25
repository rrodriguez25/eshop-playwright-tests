import { expect, test } from '../../fixtures/test';
import { uniqueName } from '../../helpers/setup/unique';

test.describe('Identity login', () => {
  // An unknown username never counts toward a real account's lockout, so this is safe to repeat.
  test('rejects an unknown user at the credentials step', async ({ identity }) => {
    const username = uniqueName('unknown-user');

    await expect(identity.logIn({ username, password: 'Not-the-password1$' }))
      .rejects.toThrow(`Login as ${username} failed at submit credentials: Identity rejected the username or password`);
  });
});
