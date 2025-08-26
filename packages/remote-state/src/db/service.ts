import { createLogger } from '../logger';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { Action } from './models/Action';
import { GameState } from './models/GameState';

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
 * Helper function to safely parse JSON strings
 */
const safeJsonParse = (jsonString: string | null | undefined): unknown => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (_error) {
    return null;
  }
};

/**
 * Helper function to safely stringify JSON
 */
const safeJsonStringify = (obj: unknown): string | null => {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch (_error) {
    return null;
  }
};

/**
 * Create a new game
 */
export const createGame = async (
  gameData: Omit<GameData, 'createdAt' | 'updatedAt'>
): Promise<GameData> => {
  info(`Creating new game: ${gameData.name}`);

  const now = new Date();

  // Create the game
  const newGame = await Game.create({
    id: gameData.id,
    name: gameData.name,
    status: gameData.status,
    createdAt: now,
    updatedAt: now,
  });

  // Create initial game state
  await GameState.create({
    gameId: gameData.id,
    state: null,
    lastActionId: null,
    updatedAt: now,
  });

  return {
    id: newGame.id,
    name: newGame.name,
    status: newGame.status,
    createdAt: newGame.createdAt,
    updatedAt: newGame.updatedAt,
  };
};

/**
 * Get a game by ID
 */
export const getGame = async (gameId: string): Promise<GameData | null> => {
  info(`Retrieving game: ${gameId}`);

  const result = await Game.findByPk(gameId);

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    status: result.status,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
};

/**
 * Update game status
 */
export const updateGameStatus = async (gameId: string, status: string): Promise<void> => {
  info(`Updating game status: ${gameId} -> ${status}`);

  await Game.update(
    {
      status,
      updatedAt: new Date(),
    },
    {
      where: {
        id: gameId,
      },
    }
  );
};

/**
 * Add a player to a game
 */
export const addPlayerToGame = async (
  playerData: Omit<PlayerData, 'joinedAt'>
): Promise<PlayerData> => {
  info(`Adding player ${playerData.name} to game ${playerData.gameId}`);

  const now = new Date();
  const newPlayer = await Player.create({
    id: playerData.id,
    gameId: playerData.gameId,
    name: playerData.name,
    role: playerData.role,
    token: playerData.token,
    tokenType: playerData.tokenType,
    joinedAt: now,
  });

  return {
    id: newPlayer.id,
    gameId: newPlayer.gameId,
    name: newPlayer.name,
    role: newPlayer.role as 'spectator' | 'player' | 'admin',
    token: newPlayer.token || undefined,
    tokenType: newPlayer.tokenType as 'owner' | 'identity' | undefined,
    joinedAt: newPlayer.joinedAt,
  };
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

  const result = await Player.findOne({
    where: {
      token: token,
    },
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    gameId: result.gameId,
    name: result.name,
    role: result.role as 'spectator' | 'player' | 'admin',
    token: result.token || undefined,
    tokenType: result.tokenType as 'owner' | 'identity' | undefined,
    joinedAt: result.joinedAt,
  };
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

  const result = await Player.findOne({
    where: {
      gameId: gameId,
      tokenType: 'owner',
    },
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    gameId: result.gameId,
    name: result.name,
    role: result.role as 'spectator' | 'player' | 'admin',
    token: result.token || undefined,
    tokenType: result.tokenType as 'owner' | 'identity' | undefined,
    joinedAt: result.joinedAt,
  };
};

/**
 * Get players for a game
 */
export const getPlayersForGame = async (gameId: string): Promise<PlayerData[]> => {
  info(`Retrieving players for game: ${gameId}`);

  const results = await Player.findAll({
    where: {
      gameId: gameId,
    },
  });

  return results.map(result => ({
    id: result.id,
    gameId: result.gameId,
    name: result.name,
    role: result.role as 'spectator' | 'player' | 'admin',
    token: result.token || undefined,
    tokenType: result.tokenType as 'owner' | 'identity' | undefined,
    joinedAt: result.joinedAt,
  }));
};

/**
 * Record an action
 */
export const recordAction = async <A, S, R>(
  actionData: Omit<ActionData<A, S, R>, 'timestamp'>
): Promise<ActionData<A, S, R>> => {
  info(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const now = new Date();
  const newAction = await Action.create({
    id: actionData.id,
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    actionType: actionData.actionType,
    actionData: safeJsonStringify(actionData.actionData),
    gameState: safeJsonStringify(actionData.gameState),
    timestamp: now,
    validationResult: safeJsonStringify(actionData.validationResult),
  });

  return {
    id: newAction.id,
    gameId: newAction.gameId,
    playerId: newAction.playerId,
    actionType: newAction.actionType,
    actionData: safeJsonParse(newAction.actionData) as A,
    gameState: safeJsonParse(newAction.gameState) as S,
    timestamp: newAction.timestamp,
    validationResult: safeJsonParse(newAction.validationResult) as R,
  };
};

/**
 * Get actions for a game
 */
export const getActionsForGame = async <A, S, R>(
  gameId: string
): Promise<ActionData<A, S, R>[]> => {
  info(`Retrieving actions for game: ${gameId}`);

  const results = await Action.findAll({
    where: {
      gameId: gameId,
    },
    order: [['timestamp', 'DESC']],
  });

  return results.map(result => ({
    id: result.id,
    gameId: result.gameId,
    playerId: result.playerId,
    actionType: result.actionType,
    actionData: safeJsonParse(result.actionData) as A,
    gameState: safeJsonParse(result.gameState) as S,
    timestamp: result.timestamp,
    validationResult: safeJsonParse(result.validationResult) as R,
  }));
};

/**
 * Update game state
 */
export const updateGameState = async <S>(
  gameStateData: Omit<GameStateData<S>, 'updatedAt'>
): Promise<void> => {
  info(`Updating game state for game: ${gameStateData.gameId}`);

  // Use upsert equivalent - try to update first, then create if not found
  const [updated] = await GameState.update(
    {
      state: safeJsonStringify(gameStateData.state),
      lastActionId: gameStateData.lastActionId,
      updatedAt: new Date(),
    },
    {
      where: {
        gameId: gameStateData.gameId,
      },
    }
  );

  // If no rows were updated, create a new record
  if (updated === 0) {
    await GameState.create({
      gameId: gameStateData.gameId,
      state: safeJsonStringify(gameStateData.state),
      lastActionId: gameStateData.lastActionId,
      updatedAt: new Date(),
    });
  }
};

/**
 * Get current game state
 */
export const getCurrentGameState = async <S>(gameId: string): Promise<GameStateData<S> | null> => {
  info(`Retrieving current game state for game: ${gameId}`);

  const result = await GameState.findByPk(gameId);

  if (!result) {
    return null;
  }

  return {
    gameId: result.gameId,
    state: safeJsonParse(result.state) as S,
    lastActionId: result.lastActionId,
    updatedAt: result.updatedAt,
  };
};

/**
 * Update game state with typed validation
 */
export const updateGameStateWithValidation = async <A, S>(
  gameId: string,
  action: A,
  token: string
): Promise<{ success: boolean; state?: S; error?: string }> => {
  info(`Updating game state with validation for game: ${gameId}`);

  try {
    // Get current game state
    const currentState = await getCurrentGameState<S>(gameId);
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
    info(`Error updating game state with validation: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
};

/**
 * Service factory interface with typed Action and State generics
 */
export interface DatabaseService<A, S, R> {
  // Game operations
  createGame: (gameData: Omit<GameData, 'createdAt' | 'updatedAt'>) => Promise<GameData>;
  getGame: (gameId: string) => Promise<GameData | null>;
  updateGameStatus: (gameId: string, status: string) => Promise<void>;

  // Player operations
  addPlayerToGame: (playerData: Omit<PlayerData, 'joinedAt'>) => Promise<PlayerData>;
  createGameOwner: (gameId: string, playerName: string) => Promise<PlayerData>;
  createJoiningPlayer: (gameId: string, playerName: string) => Promise<PlayerData>;
  getPlayerByToken: (token: string) => Promise<PlayerData | null>;
  validatePlayerToken: (token: string) => Promise<PlayerData | null>;
  getGameOwner: (gameId: string) => Promise<PlayerData | null>;
  getPlayersForGame: (gameId: string) => Promise<PlayerData[]>;

  // Action operations (typed)
  recordAction: (
    actionData: Omit<ActionData<A, S, R>, 'timestamp'>
  ) => Promise<ActionData<A, S, R>>;
  getActionsForGame: (gameId: string) => Promise<ActionData<A, S, R>[]>;

  // Game state operations (typed)
  updateGameState: (gameStateData: Omit<GameStateData<S>, 'updatedAt'>) => Promise<void>;
  getCurrentGameState: (gameId: string) => Promise<GameStateData<S> | null>;

  // Validation operations (typed)
  updateGameStateWithValidation: (
    gameId: string,
    action: A,
    token: string
  ) => Promise<{ success: boolean; state?: S; error?: string }>;
}

/**
 * Create a typed database service instance
 * @param actionType - The Action type for this service
 * @param stateType - The State type for this service
 * @param resultType - The Result type for this service
 * @returns A typed database service instance
 */
export const createDatabaseService = <A, S, R>(): DatabaseService<A, S, R> => {
  // Return service with properly typed functions
  return {
    // Game operations
    createGame,
    getGame,
    updateGameStatus,

    // Player operations
    addPlayerToGame,
    createGameOwner,
    createJoiningPlayer,
    getPlayerByToken,
    validatePlayerToken,
    getGameOwner,
    getPlayersForGame,

    // Action operations (typed)
    recordAction: async (
      actionData: Omit<ActionData<A, S, R>, 'timestamp'>
    ): Promise<ActionData<A, S, R>> => {
      return recordAction(actionData as ActionData<A, S, R>) as Promise<ActionData<A, S, R>>;
    },

    getActionsForGame: async (gameId: string): Promise<ActionData<A, S, R>[]> => {
      return getActionsForGame(gameId) as Promise<ActionData<A, S, R>[]>;
    },

    // Game state operations (typed)
    updateGameState: async (gameStateData: Omit<GameStateData<S>, 'updatedAt'>): Promise<void> => {
      return updateGameState(gameStateData as GameStateData<S>);
    },

    getCurrentGameState: async (gameId: string): Promise<GameStateData<S> | null> => {
      return getCurrentGameState(gameId) as Promise<GameStateData<S> | null>;
    },

    // Validation operations (typed)
    updateGameStateWithValidation: async (
      gameId: string,
      action: A,
      token: string
    ): Promise<{ success: boolean; state?: S; error?: string }> => {
      return updateGameStateWithValidation(
        gameId,
        action as ActionData<A, S, R>,
        token
      ) as Promise<{
        success: boolean;
        state?: S;
        error?: string;
      }>;
    },
  };
};
