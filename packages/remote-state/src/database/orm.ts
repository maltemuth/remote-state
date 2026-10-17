/**
 * Opens the SQLite database through MikroORM. A new database gets the schema,
 * generated from the entities, and the schema's version; a database with another
 * version is refused, since databases aren't upgraded before 1.0 (decision 0048).
 * Commits are written ahead to a log and not synced to disk one by one (WAL with
 * `synchronous = NORMAL`, decision 0054). MikroORM's own output goes to the
 * server's logger.
 */

import { MikroORM } from '@mikro-orm/sqlite';
import { type Logger } from '../logging/logger.js';
import { entities } from './entities/index.js';

export type Orm = MikroORM;

/** Stored as SQLite's `user_version`; raise it whenever the entities' tables change */
export const SCHEMA_VERSION = 3;

/** The database was created by a version of the library with another schema */
export class UnsupportedDatabaseError extends Error {
  constructor(databasePath: string) {
    super(
      `${databasePath} was created by another version of Remote State, and databases ` +
        "aren't upgraded before 1.0. Delete it, or use the version that created it."
    );
    this.name = 'UnsupportedDatabaseError';
  }
}

const prepareSchema = async (orm: Orm, databasePath: string, logger: Logger) => {
  const connection = orm.em.getConnection();
  const [{ user_version: version }] =
    await connection.execute<{ user_version: number }[]>('pragma user_version');
  if (version === SCHEMA_VERSION) return;

  const [{ tables }] = await connection.execute<{ tables: number }[]>(
    "select count(*) as tables from sqlite_master where type = 'table'"
  );
  if (version !== 0 || tables > 0) throw new UnsupportedDatabaseError(databasePath);

  // In one transaction, so a database never has tables without a version
  const schema = await orm.schema.getCreateSchemaSQL({ wrap: false });
  await connection.executeDump(
    `begin;\n${schema}\npragma user_version = ${SCHEMA_VERSION};\ncommit;`
  );
  logger.debug(`Created the schema, version ${SCHEMA_VERSION}, in ${databasePath}`);
};

/**
 * Open the database, creating the schema in a new one
 * @param databasePath - SQLite file path, or `:memory:`
 */
export const initializeDatabase = async (databasePath: string, logger: Logger): Promise<Orm> => {
  logger.debug(`Opening database ${databasePath}`);
  const orm = await MikroORM.init({
    dbName: databasePath,
    entities,
    colors: false,
    logger: message => logger.debug(message),
  });

  try {
    await prepareSchema(orm, databasePath, logger);
    // After the schema check, so a database that's refused is left as it was
    const database = await orm.em.getConnection().getNativeClient();
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
  } catch (err) {
    await orm.close();
    throw err;
  }
  return orm;
};
