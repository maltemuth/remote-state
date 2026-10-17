/**
 * Database files for tests: in a fresh temporary directory per test file, removed
 * after its tests, and read directly through MikroORM, without the library.
 */

import { afterAll } from '@jest/globals';
import { type EntityManager, MikroORM } from '@mikro-orm/sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { entities } from '../../src/database/entities/index.js';

/**
 * Call at the top of a `describe`, after the `afterAll` that closes the servers using
 * the databases: Jest runs `afterAll` hooks in the order they're declared, and Windows
 * can't remove a database file that's still open. Returns a path in the directory per
 * file name.
 */
export const tempDatabases = (name: string) => {
  const directory = mkdtempSync(join(tmpdir(), `remote-state-${name}-`));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  return (file = 'games.db') => join(directory, file);
};

/** Run `work` on a database file, closing it afterwards */
export const withOrm = async <T>(database: string, work: (em: EntityManager) => Promise<T>) => {
  const orm = await MikroORM.init({ dbName: database, entities });
  try {
    return await work(orm.em.fork());
  } finally {
    await orm.close();
  }
};
