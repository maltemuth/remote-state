import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Games table with names
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('waiting'), // waiting, active, finished
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Players table with many-to-one relationship to Games
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  name: text('name').notNull(),
  role: text('role', { enum: ['spectator', 'player', 'admin'] })
    .notNull()
    .default('player'),
  token: text('token'), // Token for authentication/authorization
  tokenType: text('token_type', { enum: ['owner', 'identity'] }), // Type of token
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Actions table to record game actions and their resulting game state
export const actions = sqliteTable('actions', {
  id: text('id').primaryKey(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  playerId: text('player_id')
    .notNull()
    .references(() => players.id),
  actionType: text('action_type').notNull(),
  actionData: text('action_data', { mode: 'json' }).$type<any>(), // JSON string of the action payload (generic type A)
  gameState: text('game_state', { mode: 'json' }).$type<any>(), // JSON string of the resulting game state (generic type S)
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
  validationResult: text('validation_result', { mode: 'json' }).$type<any>(), // JSON string of validation result (generic type R)
});

// Game states table to track the current state of each game
export const gameStates = sqliteTable('game_states', {
  gameId: text('game_id')
    .primaryKey()
    .references(() => games.id),
  state: text('state', { mode: 'json' }).$type<any>(), // JSON string of the current game state (generic type S)
  lastActionId: text('last_action_id').references(() => actions.id),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});
