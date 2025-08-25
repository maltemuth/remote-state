import { eq, desc, and } from 'drizzle-orm';
import { db } from './index';
import { games, players, actions, gameStates } from './schema';
import { createLogger } from '../logger';
import { createInitialGameState } from '../games';

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
  role: 'spectator' | 'player' | 'admin';
  token?: string;
  tokenType?: 'owner' | 'identity';
  joinedAt: Date;
}

/**
 * Action data type
 */
export interface ActionData<A, S, R> {
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
  timestamp: Date;
  validationResult: R;
}

/**
 * Game state data type
 */
export interface GameStateData<S> {
  gameId: string;
  state: S;
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
    token: playerData.token,
    tokenType: playerData.tokenType,
    joinedAt: now,
  };

  await db.insert(players).values(newPlayer);
  return newPlayer;
};

/**
 * Generate a secure random token
 */
export const generateToken = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Create a game owner with token
 */
export const createGameOwner = async (gameId: string, playerName: string): Promise<PlayerData> => {
  info(`Creating game owner for game ${gameId}: ${playerName}`);

  const playerId = `owner-${Date.now()}`;
  const token = generateToken();

  const owner = await addPlayerToGame({
    id: playerId,
    gameId,
    name: playerName,
    role: 'admin',
    token,
    tokenType: 'owner',
  });

  return owner;
};

/**
 * Create a joining player with token
 */
export const createJoiningPlayer = async (
  gameId: string,
  playerName: string
): Promise<PlayerData> => {
  info(`Creating joining player for game ${gameId}: ${playerName}`);

  const playerId = `player-${Date.now()}`;
  const token = generateToken();

  const player = await addPlayerToGame({
    id: playerId,
    gameId,
    name: playerName,
    role: 'player',
    token,
    tokenType: 'identity',
  });

  return player;
};

/**
 * Get player by token
 */
export const getPlayerByToken = async (token: string): Promise<PlayerData | null> => {
  info(`Retrieving player by token`);

  const result = await db.select().from(players).where(eq(players.token, token)).limit(1);
  return result[0] || null;
};

/**
 * Validate player token and get player data
 */
export const validatePlayerToken = async (token: string): Promise<PlayerData | null> => {
  info(`Validating player token`);

  const player = await getPlayerByToken(token);
  if (!player) {
    return null;
  }

  return player;
};

/**
 * Get game owner by game ID
 */
export const getGameOwner = async (gameId: string): Promise<PlayerData | null> => {
  info(`Retrieving game owner for game: ${gameId}`);

  const result = await db
    .select()
    .from(players)
    .where(and(eq(players.gameId, gameId), eq(players.tokenType, 'owner')))
    .limit(1);
  return result[0] || null;
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
  actionData: Omit<ActionData<any, any, any>, 'timestamp'>
): Promise<ActionData<any, any, any>> => {
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
export const getActionsForGame = async (gameId: string): Promise<ActionData<any, any, any>[]> => {
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
  gameStateData: Omit<GameStateData<any>, 'updatedAt'>
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
export const getCurrentGameState = async (gameId: string): Promise<GameStateData<any> | null> => {
  info(`Retrieving current game state for game: ${gameId}`);

  const result = await db.select().from(gameStates).where(eq(gameStates.gameId, gameId)).limit(1);
  return result[0] || null;
};

/**
 * Create initial tic-tac-toe game state
 */
export const createTicTacToeGameState = async (gameId: string): Promise<void> => {
  info(`Creating initial tic-tac-toe game state for game: ${gameId}`);

  const initialState = createInitialGameState(gameId);

  await db
    .insert(gameStates)
    .values({
      gameId,
      state: initialState,
      lastActionId: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: gameStates.gameId,
      set: {
        state: initialState,
        lastActionId: null,
        updatedAt: new Date(),
      },
    });
};

/**
 * Update game state with typed validation
 */
export const updateGameStateWithValidation = async (
  gameId: string,
  action: any,
  token: string
): Promise<{ success: boolean; state?: any; error?: string }> => {
  info(`Updating game state with validation for game: ${gameId}`);

  try {
    // Get current game state
    const currentState = await getCurrentGameState(gameId);
    if (!currentState?.state) {
      return { success: false, error: 'Game state not found' };
    }

    // Get player by token
    const player = await validatePlayerToken(token);
    if (!player) {
      return { success: false, error: 'Invalid token' };
    }

    // For tic-tac-toe, use the game engine
    const { executeAction } = await import('../games/tic-tac-toe/engine');

    const gameAction = {
      ...action,
      playerId: player.id,
      timestamp: new Date(),
    };

    const result = executeAction(currentState.state, gameAction);

    if (result.success) {
      // Update the game state in database
      await updateGameState({
        gameId,
        state: result.state,
        lastActionId: action.id || `action-${Date.now()}`,
      });

      return { success: true, state: result.state };
    } else {
      return { success: false, error: result.validationResult.message };
    }
  } catch (error) {
    error(`Error updating game state with validation: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
};
