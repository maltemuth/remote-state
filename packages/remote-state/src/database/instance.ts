import { RemoteStateServerConfiguration } from '../core/server';
import { createLogger } from '../utils/logger';
import { createSequelizeInstance, syncDatabase } from './sequelize';

/**
 * Database initialization options
 */
export interface DatabaseOptions {
  databasePath?: string;
  sync?: boolean;
}

/**
 * Initialize the database
 */
export const initializeDatabase = async (
  options: DatabaseOptions = {},
  configuration?: RemoteStateServerConfiguration
) => {
  const { databasePath = 'games.db', sync = true } = options;
  const { info, error } = createLogger({
    scope: 'initializeDatabase',
    logLevel: configuration?.minimumLogLevel,
  });

  info(`Initializing database with path: ${databasePath}`);

  try {
    // Create the sequelize instance
    const database = await createSequelizeInstance(databasePath, configuration);

    // Sync the database schema
    if (sync) {
      await syncDatabase(database, configuration);
    }

    info('Database initialization completed successfully');

    return database;
  } catch (err) {
    error('Error initializing database:', err);
    throw err;
  }
};
