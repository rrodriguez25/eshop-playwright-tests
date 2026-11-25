import pg from 'pg';
import { Database } from './database';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** eShop's databases, keyed by the short name tests use. */
export const DATABASES = {
  catalog: 'catalogdb',
  identity: 'identitydb',
  ordering: 'orderingdb',
  webhooks: 'webhooksdb',
} as const;

export type DatabaseKey = keyof typeof DATABASES;

/**
 * Entry point to eShop's PostgreSQL databases. Opens a small connection pool per database the
 * first time that database is used, so a test that only touches `catalog` never connects to the
 * others. Call `close()` when done; the `db` fixture does this at the end of each worker.
 */
export class DbClient {
  private readonly databases = new Map<DatabaseKey, Database>();
  private readonly pools: pg.Pool[] = [];

  constructor(private readonly config: DbConfig) {}

  get catalog(): Database {
    return this.database('catalog');
  }

  get identity(): Database {
    return this.database('identity');
  }

  get ordering(): Database {
    return this.database('ordering');
  }

  get webhooks(): Database {
    return this.database('webhooks');
  }

  database(key: DatabaseKey): Database {
    let database = this.databases.get(key);
    if (!database) {
      const pool = new pg.Pool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: DATABASES[key],
        ssl: false,
        max: 4,
        connectionTimeoutMillis: 10_000,
      });
      this.pools.push(pool);
      database = new Database(DATABASES[key], pool);
      this.databases.set(key, database);
    }
    return database;
  }

  async close(): Promise<void> {
    await Promise.all(this.pools.map(pool => pool.end()));
    this.pools.length = 0;
    this.databases.clear();
  }
}
