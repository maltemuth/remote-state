import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { createLogger } from '../logger';

const { info } = createLogger({
  scope: 'database',
});

// Initialize SQLite database
const sqlite = new Database('games.db');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

/**
 * Initialize the database schema
 */
export const initializeDatabase = () => {
  info('Initializing database schema');

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      joined_at INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games (id)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_data TEXT,
      game_state TEXT,
      timestamp INTEGER NOT NULL,
      validation_result TEXT,
      FOREIGN KEY (game_id) REFERENCES games (id),
      FOREIGN KEY (player_id) REFERENCES players (id)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS game_states (
      game_id TEXT PRIMARY KEY,
      state TEXT,
      last_action_id TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games (id),
      FOREIGN KEY (last_action_id) REFERENCES actions (id)
    )
  `);

  info('Database schema initialized successfully');
};

/**
 * Close the database connection
 */
export const closeDatabase = () => {
  info('Closing database connection');
  sqlite.close();
};

// Initialize database on module load
initializeDatabase();
