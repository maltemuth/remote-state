/**
 * Database files for tests: in a fresh temporary directory per test file, removed
 * after its tests, and read directly through MikroORM, without the library.
 */

import { after } from 'node:test';
import { type EntityManager, MikroORM } from '@mikro-orm/sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { entities } from '../../src/database/entities/index.js';

/**
 * Call at the top of a `describe`, after the `after` hook that closes the servers using
 * the databases: `after` hooks run in the order they're declared, and Windows can't
 * remove a database file that's still open. Returns a path in the directory per
 * file name.
 */
export const tempDatabases = (name: string) => {
  const directory = mkdtempSync(join(tmpdir(), `remote-state-${name}-`));
  after(() => rmSync(directory, { recursive: true, force: true }));
  return (file = 'spaces.db') => join(directory, file);
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
