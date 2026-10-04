/**
 * Opens the SQLite database through MikroORM and applies pending schema migrations.
 */

import { MikroORM } from '@mikro-orm/sqlite';
import { Migrator } from '@mikro-orm/migrations';
import { createLogger } from '../utils/logger.js';
import { entities } from './entities/index.js';
import { migrations } from './migrations/index.js';

export type Orm = MikroORM;

/**
 * Open the database and apply any pending migrations
 * @param databasePath - SQLite file path, or `:memory:`
 */
export const initializeDatabase = async (databasePath: string): Promise<Orm> => {
  const { info } = createLogger({ scope: 'initializeDatabase' });
  info(`Initializing database with path: ${databasePath}`);

  const orm = await MikroORM.init({
    dbName: databasePath,
    entities,
    extensions: [Migrator],
    // Listed explicitly so nothing is looked up on disk at runtime
    migrations: { migrationsList: migrations, snapshot: false },
    debug: false,
  });

  try {
    await orm.migrator.up();
  } catch (err) {
    await orm.close();
    throw err;
  }

  info('Database initialization completed successfully');
  return orm;
};
