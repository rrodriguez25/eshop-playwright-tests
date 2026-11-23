import type { Queryable } from '../../db/Database';
import { table } from '../../db/sql';

/** Name of the database the connection is actually on, as PostgreSQL reports it. */
export async function currentDatabase(db: Queryable): Promise<string> {
  const row = await db.queryOne<{ name: string }>('select current_database() as name');
  return row!.name;
}

/** Number of rows in a table. Pass the name exactly as it appears in PostgreSQL. */
export async function countRows(db: Queryable, name: string, schema = 'public'): Promise<number> {
  const row = await db.queryOne<{ count: number }>(`select count(*)::int as count from ${table(name, schema)}`);
  return row!.count;
}

/** Number of Entity Framework migrations applied, which is above zero once a service has started. */
export function migrationCount(db: Queryable): Promise<number> {
  return countRows(db, '__EFMigrationsHistory');
}
