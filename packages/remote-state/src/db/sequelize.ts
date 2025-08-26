import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../logger';

const { info, error } = createLogger({
  scope: 'database',
});

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
      logging: false, // Set to console.log to see SQL queries
    });

    try {
      // Import and register models before authentication
      const { Game } = await import('./models/Game');
      const { Player } = await import('./models/Player');
      const { Action } = await import('./models/Action');
      const { GameState } = await import('./models/GameState');

      // Add models to sequelize instance
      sequelizeInstance.addModels([Game, Player, Action, GameState]);

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
    // Import models here to ensure they are registered
    // In newer Sequelize versions, models are automatically discovered
    // when imported and used with sync()
    await import('./models/Game');
    await import('./models/Player');
    await import('./models/Action');
    await import('./models/GameState');

    await sequelize.sync({ alter: true }); // Use alter to update existing tables
    info('Database schema synchronized successfully');
  } catch (err) {
    error('Error synchronizing database schema:', err);
    throw err;
  }
};
