import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../utils/logger.js';

// Import models at module level to ensure they are registered
import { Game } from './models/Game.js';
import { Player } from './models/Player.js';
import { GameState } from './models/GameState.js';

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
    // Creates missing tables only. `alter: true` is unsafe on SQLite: Sequelize rebuilds the
    // table and turns the composite (gameId, sequence) index into per-column UNIQUE constraints.
    await sequelize.sync();
    info('Database schema synchronized successfully');
  } catch (err) {
    error('Error synchronizing database schema:', err);
    throw err;
  }
};
