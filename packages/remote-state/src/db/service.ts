import { eq, desc } from 'drizzle-orm';
import { db } from './index';
import { games, players, actions, gameStates } from './schema';
import { createLogger } from '../logger';

const { info } = createLogger({
  scope: 'db-service',
});

/**
 * Game data type
 */
export interface GameData {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Player data type
 */
export interface PlayerData {
  id: string;
  gameId: string;
  name: string;
  role: string;
  joinedAt: Date;
}

/**
 * Action data type
 */
export interface ActionData {
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: any;
  gameState: any;
  timestamp: Date;
  validationResult: any;
}

/**
 * Game state data type
 */
export interface GameStateData {
  gameId: string;
  state: any;
  lastActionId: string | null;
  updatedAt: Date;
}

/**
 * Create a new game
 */
export const createGame = async (
  gameData: Omit<GameData, 'createdAt' | 'updatedAt'>
): Promise<GameData> => {
  info(`Creating new game: ${gameData.name}`);

  const now = new Date();
  const newGame = {
    id: gameData.id,
    name: gameData.name,
    status: gameData.status,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(games).values(newGame);

  // Create initial game state
  await db.insert(gameStates).values({
    gameId: gameData.id,
    state: null,
    lastActionId: null,
    updatedAt: now,
  });

  return newGame;
};

/**
 * Get a game by ID
 */
export const getGame = async (gameId: string): Promise<GameData | null> => {
  info(`Retrieving game: ${gameId}`);

  const result = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return result[0] || null;
};

/**
 * Update game status
 */
export const updateGameStatus = async (gameId: string, status: string): Promise<void> => {
  info(`Updating game status: ${gameId} -> ${status}`);

  await db.update(games).set({ status, updatedAt: new Date() }).where(eq(games.id, gameId));
};

/**
 * Add a player to a game
 */
export const addPlayerToGame = async (
  playerData: Omit<PlayerData, 'joinedAt'>
): Promise<PlayerData> => {
  info(`Adding player ${playerData.name} to game ${playerData.gameId}`);

  const now = new Date();
  const newPlayer = {
    id: playerData.id,
    gameId: playerData.gameId,
    name: playerData.name,
    role: playerData.role,
    joinedAt: now,
  };

  await db.insert(players).values(newPlayer);
  return newPlayer;
};

/**
 * Get players for a game
 */
export const getPlayersForGame = async (gameId: string): Promise<PlayerData[]> => {
  info(`Retrieving players for game: ${gameId}`);

  return await db.select().from(players).where(eq(players.gameId, gameId));
};

/**
 * Record an action
 */
export const recordAction = async (
  actionData: Omit<ActionData, 'timestamp'>
): Promise<ActionData> => {
  info(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const now = new Date();
  const newAction = {
    id: actionData.id,
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    actionType: actionData.actionType,
    actionData: actionData.actionData,
    gameState: actionData.gameState,
    timestamp: now,
    validationResult: actionData.validationResult,
  };

  await db.insert(actions).values(newAction);
  return newAction;
};

/**
 * Get actions for a game
 */
export const getActionsForGame = async (gameId: string): Promise<ActionData[]> => {
  info(`Retrieving actions for game: ${gameId}`);

  return await db
    .select()
    .from(actions)
    .where(eq(actions.gameId, gameId))
    .orderBy(desc(actions.timestamp));
};

/**
 * Update game state
 */
export const updateGameState = async (
  gameStateData: Omit<GameStateData, 'updatedAt'>
): Promise<void> => {
  info(`Updating game state for game: ${gameStateData.gameId}`);

  await db
    .insert(gameStates)
    .values({
      gameId: gameStateData.gameId,
      state: gameStateData.state,
      lastActionId: gameStateData.lastActionId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: gameStates.gameId,
      set: {
        state: gameStateData.state,
        lastActionId: gameStateData.lastActionId,
        updatedAt: new Date(),
      },
    });
};

/**
 * Get current game state
 */
export const getCurrentGameState = async (gameId: string): Promise<GameStateData | null> => {
  info(`Retrieving current game state for game: ${gameId}`);

  const result = await db.select().from(gameStates).where(eq(gameStates.gameId, gameId)).limit(1);
  return result[0] || null;
};
