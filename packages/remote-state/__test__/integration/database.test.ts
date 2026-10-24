/**
 * The database's schema version (0048): a new database gets the schema and its
 * version, reopening it works, databases from other versions are refused, and
 * other failures arrive as the driver raised them. Commits go to a write-ahead log
 * and aren't synced one by one (0054).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRemoteState, silentLogger, UnsupportedDatabaseError } from '../../src/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { initializeDatabase, SCHEMA_VERSION } from '../../src/database/orm.js';
import { counterRules, initialCounterState } from '../helpers/counterRules.js';

describe('database', () => {
  const databaseNamed = tempDatabases('database');
  const open = (database: string) =>
    createRemoteState(counterRules(), { database, logger: silentLogger, socket: false });
  /** Run SQL on a database file directly, without the library */
  const sql = <T>(database: string, statement: string) =>
    withOrm(database, em => em.getConnection().execute<T>(statement));
  const userVersion = async (database: string) =>
    (await sql<{ user_version: number }[]>(database, 'pragma user_version'))[0].user_version;

  it('creates the schema in a new database, and reopens it', async () => {
    const database = databaseNamed('new.db');
    const first = await open(database);
    const spaceId = await first.createSpace(initialCounterState());
    await first.close();
    assert.equal(await userVersion(database), SCHEMA_VERSION);

    const second = await open(database);
    try {
      assert.equal(typeof (await second.admit({ spaceId, identity: { id: 'alice' } })), 'string');
    } finally {
      await second.close();
    }
  });

  it('refuses a database with tables but no version, as earlier versions created', async () => {
    const database = databaseNamed('migrated.db');
    await sql(database, 'create table mikro_orm_migrations (id integer primary key, name text)');
    await assert.rejects(open(database), UnsupportedDatabaseError);
    await assert.rejects(open(database), /Delete it/);
  });

  it('refuses a database with another version, and leaves its journal as it was', async () => {
    const database = databaseNamed('other.db');
    await sql(database, `pragma user_version = ${SCHEMA_VERSION + 1}`);
    await assert.rejects(open(database), UnsupportedDatabaseError);
    assert.deepEqual(await sql(database, 'pragma journal_mode'), [{ journal_mode: 'delete' }]);
  });

  it('writes ahead to a log, without syncing every commit', async () => {
    const database = databaseNamed('wal.db');
    const orm = await initializeDatabase(database, silentLogger);
    try {
      const native = await orm.em.getConnection().getNativeClient();
      assert.equal(native.pragma('journal_mode', { simple: true }), 'wal');
      // 1 is NORMAL; it's set per connection, so only the library's own shows it
      assert.equal(native.pragma('synchronous', { simple: true }), 1);
    } finally {
      await orm.close();
    }
    // The journal mode is kept in the file
    assert.deepEqual(await sql(database, 'pragma journal_mode'), [{ journal_mode: 'wal' }]);
  });

  it("passes on the driver's error for a file it can't open", async () => {
    await assert.rejects(
      open(databaseNamed('missing/directory/spaces.db')),
      /unable to open database file|directory does not exist/
    );
  });
});
