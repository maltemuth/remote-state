/**
 * The database's schema version (0048): a new database gets the schema and its
 * version, reopening it works, and databases from other versions are refused.
 */

import { describe, expect, it } from '@jest/globals';
import { createRemoteState, silentLogger, UnsupportedDatabaseError } from '../../src/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { SCHEMA_VERSION } from '../../src/database/orm.js';
import { counterGame, initialCounterState } from '../helpers/counterGame.js';

describe('database', () => {
  const databaseNamed = tempDatabases('database');
  const open = (database: string) =>
    createRemoteState(counterGame(), { database, logger: silentLogger, socket: false });
  /** Run SQL on a database file directly, without the library */
  const sql = <T>(database: string, statement: string) =>
    withOrm(database, em => em.getConnection().execute<T>(statement));
  const userVersion = async (database: string) =>
    (await sql<{ user_version: number }[]>(database, 'pragma user_version'))[0].user_version;

  it('creates the schema in a new database, and reopens it', async () => {
    const database = databaseNamed('new.db');
    const first = await open(database);
    const gameId = await first.createGame(initialCounterState());
    await first.close();
    expect(await userVersion(database)).toBe(SCHEMA_VERSION);

    const second = await open(database);
    try {
      await expect(second.admit({ gameId, identity: { id: 'alice' } })).resolves.toEqual(
        expect.any(String)
      );
    } finally {
      await second.close();
    }
  });

  it('refuses a database with tables but no version, as earlier versions created', async () => {
    const database = databaseNamed('migrated.db');
    await sql(database, 'create table mikro_orm_migrations (id integer primary key, name text)');
    await expect(open(database)).rejects.toThrow(UnsupportedDatabaseError);
    await expect(open(database)).rejects.toThrow(/Delete it/);
  });

  it('refuses a database with another version', async () => {
    const database = databaseNamed('other.db');
    await sql(database, `pragma user_version = ${SCHEMA_VERSION + 1}`);
    await expect(open(database)).rejects.toThrow(UnsupportedDatabaseError);
  });
});
