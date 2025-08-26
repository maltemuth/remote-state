import { createLogger } from '../logger';
import { createSequelizeInstance, syncDatabase } from './sequelize';

const { info, error } = createLogger({
  scope: 'database',
});

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

  info(`Initializing database with path: ${databasePath}`);

  try {
    // Create the sequelize instance
    await createSequelizeInstance(databasePath);

    // Sync the database schema
    if (sync) {
      await syncDatabase();
      info('Database schema synchronized successfully');
    }

    info('Database initialization completed successfully');

    return true;
  } catch (err) {
    error('Error initializing database:', err);
    throw err;
  }
};

/**
 * Get the default database instance
 */
export const getDatabaseInstance = async () => {
  return createSequelizeInstance();
};

/**
 * Close the database connection
 */
export const closeDatabase = async () => {
  info('Closing database connection');
  const sequelize = await createSequelizeInstance();
  await sequelize.close();
};
