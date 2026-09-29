import { createLogger } from '../utils/logger.js';
import { createSequelizeInstance, syncDatabase } from './sequelize.js';

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
export const initializeDatabase = async (options: DatabaseOptions = {}) => {
  const { databasePath = 'games.db', sync = true } = options;
  const { info, error } = createLogger({
    scope: 'initializeDatabase',
  });

  info(`Initializing database with path: ${databasePath}`);

  try {
    // Create the sequelize instance
    const database = await createSequelizeInstance(databasePath);

    // Sync the database schema
    if (sync) {
      await syncDatabase(database);
    }

    info('Database initialization completed successfully');

    return database;
  } catch (err) {
    error('Error initializing database:', err);
    throw err;
  }
};
