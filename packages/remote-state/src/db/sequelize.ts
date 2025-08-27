import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../logger';
import console from 'console';

const { info, error } = createLogger({
  scope: 'database',
});

// Import models at module level to ensure they are registered
import { Game } from './models/Game';
import { Player } from './models/Player';
import { GameState } from './models/GameState';

// Sequelize instance storage
let sequelizeInstance: Sequelize | null = null;

/**
 * Create a Sequelize instance
 */
export const createSequelizeInstance = async (
  databasePath: string = 'games.db'
): Promise<Sequelize> => {
  if (!sequelizeInstance) {
    info(`Creating Sequelize instance with database path: ${databasePath}`);

    sequelizeInstance = new Sequelize({
      dialect: 'sqlite',
      storage: databasePath,
      // logging: console.log, // Enable logging to see SQL queries
      models: [Game, Player, GameState], // Register models directly
    });

    try {
      await sequelizeInstance.authenticate();
      info('Database connection established successfully');
    } catch (err) {
      error('Unable to connect to the database:', err);
      throw err;
    }
  }

  return sequelizeInstance;
};

/**
 * Get the default Sequelize instance
 */
export const getSequelizeInstance = async (): Promise<Sequelize> => {
  if (!sequelizeInstance) {
    sequelizeInstance = await createSequelizeInstance();
  }
  return sequelizeInstance;
};

/**
 * Close the Sequelize connection
 */
export const closeSequelizeConnection = async (): Promise<void> => {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
    info('Database connection closed');
  }
};

/**
 * Sync all models with the database
 */
export const syncDatabase = async (): Promise<void> => {
  const sequelize = await getSequelizeInstance();

  try {
    await sequelize.sync({ alter: true }); // Use alter to update existing tables
    info('Database schema synchronized successfully');
  } catch (err) {
    error('Error synchronizing database schema:', err);
    throw err;
  }
};
