import { test, expect } from '../../fixtures/test';
import type { DatabaseKey } from '../../db/DbClient';
import { DATABASES } from '../../db/DbClient';
import { countRows, currentDatabase, migrationCount, probeWrite } from '../../helpers/db/health';
import { uniqueName } from '../../helpers/setup/unique';

/** For each database, a table eShop always fills on startup, or none if it starts empty. */
const seededTables: Record<DatabaseKey, { schema: string; table: string } | undefined> = {
  catalog: { schema: 'public', table: 'Catalog' },
  identity: { schema: 'public', table: 'AspNetUsers' },
  ordering: { schema: 'ordering', table: 'cardtypes' },
  webhooks: undefined,
};

test.describe('Database sanity', () => {
  for (const key of Object.keys(DATABASES) as DatabaseKey[]) {
    test(`connects to ${DATABASES[key]} and reads data`, async ({ db }) => {
      const database = db.database(key);

      expect(await currentDatabase(database)).toBe(DATABASES[key]);
      expect(await migrationCount(database), 'EF migrations applied').toBeGreaterThan(0);

      const seeded = seededTables[key];
      if (seeded) {
        expect(await countRows(database, seeded.table, seeded.schema), `rows in ${seeded.table}`).toBeGreaterThan(0);
      }
    });
  }

  test('writes and reads back inside a transaction that rolls back', async ({ db }) => {
    const value = uniqueName('write-probe');

    const result = await probeWrite(db.catalog, value);

    expect(result).toEqual({ inserted: 1, readBack: value });
  });
});
