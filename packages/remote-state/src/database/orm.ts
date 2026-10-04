/**
 * Opens the SQLite database through MikroORM and applies pending schema migrations.
 * MikroORM's own output, including the migrator's, goes to the server's logger.
 */

import { MikroORM } from '@mikro-orm/sqlite';
import { Migrator } from '@mikro-orm/migrations';
import { type Logger } from '../logging/logger.js';
import { entities } from './entities/index.js';
import { migrations } from './migrations/index.js';

export type Orm = MikroORM;

/**
 * Open the database and apply any pending migrations
 * @param databasePath - SQLite file path, or `:memory:`
 */
export const initializeDatabase = async (databasePath: string, logger: Logger): Promise<Orm> => {
  logger.debug(`Opening database ${databasePath}`);
  const orm = await MikroORM.init({
    dbName: databasePath,
    entities,
    extensions: [Migrator],
    // Listed explicitly so nothing is looked up on disk at runtime
    migrations: { migrationsList: migrations, snapshot: false },
    debug: false,
    colors: false,
    logger: message => logger.debug(message),
  });

  try {
    await orm.migrator.up();
  } catch (err) {
    await orm.close();
    throw err;
  }
  return orm;
};
