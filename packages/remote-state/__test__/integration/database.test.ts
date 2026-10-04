/**
 * The database's schema version (0048): a new database gets the schema and its
 * version, reopening it works, and databases from other versions are refused.
 */

import { afterAll, describe, expect, it } from '@jest/globals';
import { MikroORM } from '@mikro-orm/sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { createRemoteState, silentLogger, UnsupportedDatabaseError } from '../../src/index.js';
import { entities } from '../../src/database/entities/index.js';
import { SCHEMA_VERSION } from '../../src/database/orm.js';
import { counterGame, initialCounterState } from '../helpers/counterGame.js';

describe('database', () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'remote-state-database-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  const open = (database: string) =>
    createRemoteState(counterGame(), { database, logger: silentLogger, socket: false });
  /** Run SQL on a database file directly, without the library */
  const sql = async <T>(database: string, statement: string) => {
    const orm = await MikroORM.init({ dbName: database, entities, debug: false });
    try {
      return await orm.em.getConnection().execute<T>(statement);
    } finally {
      await orm.close();
    }
  };
  const userVersion = async (database: string) =>
    (await sql<{ user_version: number }[]>(database, 'pragma user_version'))[0].user_version;

  it('creates the schema in a new database, and reopens it', async () => {
    const database = joinPath(directory, 'new.db');
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
    const database = joinPath(directory, 'migrated.db');
    await sql(database, 'create table mikro_orm_migrations (id integer primary key, name text)');
    await expect(open(database)).rejects.toThrow(UnsupportedDatabaseError);
    await expect(open(database)).rejects.toThrow(/Delete it/);
  });

  it('refuses a database with another version', async () => {
    const database = joinPath(directory, 'other.db');
    await sql(database, `pragma user_version = ${SCHEMA_VERSION + 1}`);
    await expect(open(database)).rejects.toThrow(UnsupportedDatabaseError);
  });
});
