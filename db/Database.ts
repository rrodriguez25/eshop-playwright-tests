import type { Pool, PoolClient, QueryResultRow } from 'pg';

/** Anything that can run SQL: a database handle or an open transaction. */
export interface Queryable {
  /** Runs a query and returns every row. */
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a query expected to return at most one row. Throws if it returns more. */
  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Runs an insert, update or delete and returns the number of affected rows. */
  execute(sql: string, params?: unknown[]): Promise<number>;
}

type Runner = Pool | PoolClient;

async function runQuery<T extends QueryResultRow>(runner: Runner, sql: string, params: unknown[]): Promise<T[]> {
  const result = await runner.query<T>(sql, params);
  return result.rows;
}

async function runQueryOne<T extends QueryResultRow>(
  runner: Runner,
  sql: string,
  params: unknown[],
): Promise<T | undefined> {
  const rows = await runQuery<T>(runner, sql, params);
  if (rows.length > 1) {
    throw new Error(`queryOne expected at most one row but got ${rows.length}: ${sql}`);
  }
  return rows[0];
}

async function runExecute(runner: Runner, sql: string, params: unknown[]): Promise<number> {
  const result = await runner.query(sql, params);
  return result.rowCount ?? 0;
}

class Transaction implements Queryable {
  constructor(private readonly client: PoolClient) {}

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return runQuery<T>(this.client, sql, params);
  }

  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return runQueryOne<T>(this.client, sql, params);
  }

  execute(sql: string, params: unknown[] = []): Promise<number> {
    return runExecute(this.client, sql, params);
  }
}

/**
 * One eShop database. Always pass values as `params` ($1, $2, ...), never by string
 * concatenation. eShop's table names are capitalized, so quote them: `select * from "Catalog"`.
 */
export class Database implements Queryable {
  constructor(
    readonly name: string,
    private readonly pool: Pool,
  ) {}

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return runQuery<T>(this.pool, sql, params);
  }

  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return runQueryOne<T>(this.pool, sql, params);
  }

  execute(sql: string, params: unknown[] = []): Promise<number> {
    return runExecute(this.pool, sql, params);
  }

  /** Runs `work` in a transaction: commits if it resolves, rolls back if it throws. */
  async transaction<R>(work: (tx: Queryable) => Promise<R>): Promise<R> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new Transaction(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
