import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../utils/logger';

// Import models at module level to ensure they are registered
import { Game } from './models/Game';
import { Player } from './models/Player';
import { GameState } from './models/GameState';

/**
 * Create a Sequelize instance
 */
export const createSequelizeInstance = async (
  databasePath: string = 'games.db'
): Promise<Sequelize> => {
  const { info, error } = createLogger({
    scope: 'createSequelizeInstance',
  });

  info(`Creating Sequelize instance with database path: ${databasePath}`);

  const sequelizeInstance = new Sequelize({
    dialect: 'sqlite',
    storage: databasePath,
    logging: false,
    models: [Game, Player, GameState], // Register models directly
  });

  try {
    await sequelizeInstance.authenticate();
    info('Database connection established successfully');
  } catch (err) {
    error('Unable to connect to the database:', err);
    throw err;
  }

  return sequelizeInstance;
};

/**
 * Sync all models with the database
 */
export const syncDatabase = async (sequelize: Sequelize): Promise<void> => {
  const { info, error } = createLogger({
    scope: 'syncDatabase',
  });
  try {
    await sequelize.sync({ alter: true }); // Use alter to update existing tables
    info('Database schema synchronized successfully');
  } catch (err) {
    error('Error synchronizing database schema:', err);
    throw err;
  }
};
