import users from '../../data/users.json';

/**
 * Users that exist in eShop before the suite runs and are shared by every test that only needs
 * someone logged in. They share one password, `USER_PASSWORD`. Never use them for a failed-login
 * test (Identity locks an account after five failures) or for a test that changes the basket,
 * orders or profile.
 */
export type StaticUserKey = keyof typeof users;

export type StaticUser = {
  username: string;
  /** What kind of user this is. eShop has no roles yet, so every static user is a customer. */
  type: string;
  /** The name the account menu shows. */
  displayName: string;
};

const staticUsers: Record<StaticUserKey, StaticUser> = users;

export const staticUserKeys = Object.keys(staticUsers).filter(isStaticUserKey);

export function staticUser(key: StaticUserKey): StaticUser {
  return staticUsers[key];
}

function isStaticUserKey(key: string): key is StaticUserKey {
  return key in staticUsers;
}
