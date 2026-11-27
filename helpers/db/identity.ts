import { pbkdf2, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { table } from '../../db/sql';
import type { Database, Queryable } from '../../db/database';

const pbkdf2Async = promisify(pbkdf2);

/**
 * A user for identitydb's "AspNetUsers" table: ASP.NET Identity's columns plus eShop's profile
 * and payment fields (`src/Identity.API/Models/ApplicationUser.cs`), all required there.
 */
export interface NewIdentityUser {
  id: string;
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  cardHolderName: string;
  cardNumber: string;
  /** eShop's card type id; seeded users use 1. */
  cardType: number;
  securityNumber: string;
  /** MM/YY. */
  expiration: string;
}

export interface IdentityUserRow {
  id: string;
  userName: string;
  email: string;
}

/**
 * Inserts a user Identity can log in, as `UserManager.CreateAsync` would: normalized names,
 * a confirmed email, lockout enabled, a v3 password hash and fresh security stamps.
 */
export async function insertIdentityUser(db: Queryable, user: NewIdentityUser): Promise<void> {
  await db.execute(
    `insert into "AspNetUsers" (
       "Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed",
       "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumber", "PhoneNumberConfirmed",
       "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount",
       "Name", "LastName", "Street", "City", "State", "Country", "ZipCode",
       "CardHolderName", "CardNumber", "CardType", "SecurityNumber", "Expiration")
     values ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, false, false, true, 0,
       $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
    [
      user.id, user.userName, normalize(user.userName), user.email, normalize(user.email),
      await hashPassword(user.password), securityStamp(), randomUUID(), user.phoneNumber,
      user.name, user.lastName, user.street, user.city, user.state, user.country, user.zipCode,
      user.cardHolderName, user.cardNumber, user.cardType, user.securityNumber, user.expiration,
    ],
  );
}

export function findIdentityUserByUserName(db: Queryable, userName: string): Promise<IdentityUserRow | undefined> {
  return db.queryOne<IdentityUserRow>(
    `select "Id" as "id", "UserName" as "userName", "Email" as "email"
     from "AspNetUsers" where "NormalizedUserName" = $1`,
    [normalize(userName)],
  );
}

/** Tables that reference a user's id in "UserId"; deleted before the user. */
const USER_CHILD_TABLES = ['AspNetUserClaims', 'AspNetUserLogins', 'AspNetUserTokens', 'AspNetUserRoles'] as const;

/** Deletes a user by id, with their claims, logins, tokens and roles. Returns the number of users deleted. */
export function deleteIdentityUser(db: Database, id: string): Promise<number> {
  return db.transaction(async tx => {
    for (const childTable of USER_CHILD_TABLES) {
      await tx.execute(`delete from ${table(childTable)} where "UserId" = $1`, [id]);
    }
    return tx.execute('delete from "AspNetUsers" where "Id" = $1', [id]);
  });
}

/** ASP.NET Identity's `UpperInvariantLookupNormalizer`. */
function normalize(value: string): string {
  return value.toUpperCase();
}

/**
 * ASP.NET Identity's v3 password hash, the format eShop's `PasswordHasher` writes and checks:
 * 0x01, then PRF (2 = HMAC-SHA512), iteration count and salt length as big-endian uint32, then the
 * salt and a 32-byte PBKDF2 subkey, base64-encoded.
 */
async function hashPassword(password: string): Promise<string> {
  const prf = 2;
  const iterations = 100_000;
  const salt = randomBytes(16);
  const subkey = await pbkdf2Async(password, salt, iterations, 32, 'sha512');
  const header = Buffer.alloc(13);
  header.writeUInt8(0x01, 0);
  header.writeUInt32BE(prf, 1);
  header.writeUInt32BE(iterations, 5);
  header.writeUInt32BE(salt.length, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

/** A security stamp as Identity makes one: 20 random bytes in base32 (32 characters). */
function securityStamp(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return output;
}
