import { randomUUID } from 'node:crypto';
import type { Database } from '../../db/database';
import { deleteIdentityUser, insertIdentityUser, type NewIdentityUser } from '../db/identity';
import { uniqueName } from './unique';

/** A user created for one test. Logs in with `username` and `password`. */
export interface TestUser {
  id: string;
  username: string;
  password: string;
  email: string;
  name: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Creates a user that exists only for the calling test, for tests that change a user's basket,
 * orders or profile, or that need failed logins. eShop's Identity has no registration, so the user
 * is written to identitydb directly.
 *
 * `password` is the static users' shared `USER_PASSWORD`, passed in by the caller (helpers don't
 * read config), so a person can sign in as any user with one password.
 */
export async function createTestUser(db: Database, password: string): Promise<TestUser> {
  const username = uniqueName('test-user');
  const user: NewIdentityUser = {
    id: randomUUID(),
    userName: username,
    email: `${username}@example.com`,
    password,
    phoneNumber: '4255550123',
    name: 'Test',
    lastName: 'Shopper',
    street: '1 Microsoft Way',
    city: 'Redmond',
    state: 'WA',
    country: 'U.S.',
    zipCode: '98052',
    cardHolderName: 'Test Shopper',
    cardNumber: 'XXXXXXXXXXXX4242',
    cardType: 1,
    securityNumber: '123',
    expiration: cardExpiration(),
  };
  await insertIdentityUser(db, user);
  return {
    id: user.id,
    username,
    password: user.password,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    street: user.street,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    country: user.country,
  };
}

/**
 * Deletes the user from Identity. What the user made in other services stays: their basket in
 * Redis and any orders in orderingdb, both keyed by `id`.
 */
export async function deleteTestUser(db: Database, user: TestUser): Promise<void> {
  await deleteIdentityUser(db, user.id);
}

/** A card expiry two years from now, as MM/YY. */
function cardExpiration(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String((date.getFullYear() + 2) % 100).padStart(2, '0');
  return `${month}/${year}`;
}
