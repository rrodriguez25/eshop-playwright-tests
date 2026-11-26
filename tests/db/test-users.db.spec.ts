import { expect, test } from '../../fixtures/test';
import { findIdentityUserByUserName } from '../../helpers/db/identity';
import { createTestUser, deleteTestUser } from '../../helpers/setup/test-users';

test.describe('Test users', () => {
  test('are created in identitydb and deleted again', async ({ db }) => {
    const user = await createTestUser(db.identity);

    const created = await findIdentityUserByUserName(db.identity, user.username);
    await deleteTestUser(db.identity, user);
    const afterDelete = await findIdentityUserByUserName(db.identity, user.username);

    expect(created).toEqual({ id: user.id, userName: user.username, email: user.email });
    expect(afterDelete, 'user should be gone after deleteTestUser').toBeUndefined();
  });
});
