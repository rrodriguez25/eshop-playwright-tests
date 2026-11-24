import type { Database, Queryable } from '../../db/Database';
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

export interface WriteProbeResult {
  /** Rows the insert reported as written. */
  inserted: number;
  /** The value read back inside the same transaction. */
  readBack: string | undefined;
}

/**
 * Proves the connection can write: inserts `value` into a temporary table, reads it back, then
 * rolls the transaction back so nothing persists and eShop's own tables are never touched.
 */
export async function probeWrite(db: Database, value: string): Promise<WriteProbeResult> {
  let result: WriteProbeResult | undefined;
  const rollback = new Error('probeWrite rollback');

  try {
    await db.transaction(async tx => {
      await tx.execute('create temp table write_probe (value text) on commit drop');
      const inserted = await tx.execute('insert into write_probe (value) values ($1)', [value]);
      const row = await tx.queryOne<{ value: string }>('select value from write_probe');
      result = { inserted, readBack: row?.value };
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  if (!result) throw new Error('probeWrite: transaction ended without a result');
  return result;
}
