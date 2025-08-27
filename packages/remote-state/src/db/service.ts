import { createLogger } from '../logger';
import { GameState } from './models/GameState';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { Op } from 'sequelize';

const { info } = createLogger({
  scope: 'db-service',
});

/**
 * Helper function to safely parse JSON strings
 */
const safeJsonParse = <ExpectedType = unknown>(
  jsonString: string | null | undefined
): ExpectedType => {
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
export const createGame = async (gameData: {
  id: string;
  name: string;
  status: string;
}): Promise<{ id: string; name: string; status: string; createdAt: Date; updatedAt: Date }> => {
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
  try {
    await GameState.create({
      id: `state-${gameData.id}`,
      gameId: gameData.id,
      state: null,
      playerId: 'system',
      actionType: 'initial',
      actionData: null,
      validationResult: null,
    });
  } catch (error) {
    // If the GameState table doesn't have the new fields yet, create a minimal record
    info(`Creating minimal game state due to schema mismatch: ${error}`);
    await GameState.create({
      id: `state-${gameData.id}`,
      gameId: gameData.id,
      state: null,
      playerId: 'system',
      actionType: 'initial',
      actionData: null,
      validationResult: null,
    });
  }

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
export const getGame = async (
  gameId: string
): Promise<{
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
} | null> => {
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
export const addPlayerToGame = async (playerData: {
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
}): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
}> => {
  info(`Adding player ${playerData.name} to game ${playerData.gameId}`);

  const newPlayer = await Player.create({
    id: playerData.id,
    gameId: playerData.gameId,
    name: playerData.name,
    role: playerData.role,
    token: playerData.token,
    tokenType: playerData.tokenType,
  });

  return {
    id: newPlayer.id,
    gameId: newPlayer.gameId,
    name: newPlayer.name,
    role: newPlayer.role,
    token: newPlayer.token || undefined,
    tokenType: newPlayer.tokenType || undefined,
    createdAt: newPlayer.createdAt,
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
export const createGameOwner = async (
  gameId: string,
  playerName: string
): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
}> => {
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
): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
}> => {
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
export const getPlayerByToken = async (
  token: string
): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
} | null> => {
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
    role: result.role,
    token: result.token || undefined,
    tokenType: result.tokenType || undefined,
    createdAt: result.createdAt,
  };
};

/**
 * Validate player token and get player data
 */
export const validatePlayerToken = async (
  token: string
): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
} | null> => {
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
export const getGameOwner = async (
  gameId: string
): Promise<{
  id: string;
  gameId: string;
  name: string;
  role: string;
  token?: string;
  tokenType?: string;
  createdAt: Date;
} | null> => {
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
    role: result.role,
    token: result.token || undefined,
    tokenType: result.tokenType || undefined,
    createdAt: result.createdAt,
  };
};

/**
 * Get players for a game
 */
export const getPlayersForGame = async (
  gameId: string
): Promise<
  {
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  }[]
> => {
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
    role: result.role,
    token: result.token || undefined,
    tokenType: result.tokenType || undefined,
    createdAt: result.createdAt,
  }));
};

/**
 * Record an action and game state
 */
export const recordAction = async <A, S, R>(actionData: {
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
  validationResult: R;
}): Promise<{
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
  timestamp: Date;
  validationResult: R;
}> => {
  info(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const newGameState = await GameState.create({
    id: actionData.id,
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    state: safeJsonStringify(actionData.gameState),
    actionType: actionData.actionType,
    actionData: safeJsonStringify(actionData.actionData),
    validationResult: safeJsonStringify(actionData.validationResult),
  });

  return {
    id: actionData.id,
    gameId: newGameState.gameId,
    playerId: newGameState.playerId,
    actionType: newGameState.actionType,
    actionData: safeJsonParse(newGameState.actionData) as A,
    gameState: safeJsonParse(newGameState.state) as S,
    timestamp: newGameState.createdAt,
    validationResult: safeJsonParse(newGameState.validationResult) as R,
  };
};

/**
 * Get actions for a game
 */
export const getActionsForGame = async <A, S, R>(
  gameId: string
): Promise<
  {
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: A;
    gameState: S;
    timestamp: Date;
    validationResult: R;
  }[]
> => {
  info(`Retrieving actions for game: ${gameId}`);

  const results = await GameState.findAll({
    where: {
      gameId: gameId,
      actionType: {
        [Op.ne]: 'initial', // Exclude initial state entries
      },
    },
    order: [['createdAt', 'DESC']],
  });

  return results.map(result => ({
    id: result.id,
    gameId: result.gameId,
    playerId: result.playerId,
    actionType: result.actionType,
    actionData: safeJsonParse(result.actionData) as A,
    gameState: safeJsonParse(result.state) as S,
    timestamp: result.createdAt,
    validationResult: safeJsonParse(result.validationResult) as R,
  }));
};

/**
 * Update game state
 */
export const updateGameState = async <S>(gameStateData: {
  gameId: string;
  state: S;
}): Promise<void> => {
  info(`Updating game state for game: ${gameStateData.gameId}`);

  await GameState.upsert({
    id: `state-${gameStateData.gameId}`,
    gameId: gameStateData.gameId,
    state: safeJsonStringify(gameStateData.state),
    playerId: 'system',
    actionType: 'update',
    actionData: null,
    validationResult: null,
  });
};

/**
 * Get current game state
 */
export const getCurrentGameState = async <S>(
  gameId: string
): Promise<{ gameId: string; state: S; timestamp: Date } | null> => {
  info(`Retrieving current game state for game: ${gameId}`);

  const result = await GameState.findOne({
    where: {
      gameId: gameId,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!result) {
    return null;
  }

  const parsedState = safeJsonParse(result.state) as S;
  return {
    gameId: result.gameId,
    state: parsedState,
    timestamp: result.createdAt,
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
      return { success: false, error: 'Game-specific validation not implemented' };
    }

    // Get player by token
    const player = await validatePlayerToken(token);
    if (!player) {
      return { success: false, error: 'Game-specific validation not implemented' };
    }

    // Note: Game-specific validation and execution logic should be implemented
    // by the calling application or game-specific service. This generic service
    // provides the database operations only.

    // For a complete implementation, game-specific validation and execution
    // functions should be imported and used here based on the game type.

    return { success: false, error: 'Game-specific validation not implemented' };
  } catch (error) {
    info(`Error updating game state with validation: ${error}`);
    return { success: false, error: 'Game-specific validation not implemented' };
  }
};

/**
 * Service factory interface with typed Action and State generics
 */
export interface DatabaseService<A, S, R> {
  // Game operations
  createGame: (gameData: {
    id: string;
    name: string;
    status: string;
  }) => Promise<{ id: string; name: string; status: string; createdAt: Date; updatedAt: Date }>;
  getGame: (gameId: string) => Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  updateGameStatus: (gameId: string, status: string) => Promise<void>;

  // Player operations
  addPlayerToGame: (playerData: {
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
  }) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  }>;
  createGameOwner: (
    gameId: string,
    playerName: string
  ) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  }>;
  createJoiningPlayer: (
    gameId: string,
    playerName: string
  ) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  }>;
  getPlayerByToken: (token: string) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  } | null>;
  validatePlayerToken: (token: string) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  } | null>;
  getGameOwner: (gameId: string) => Promise<{
    id: string;
    gameId: string;
    name: string;
    role: string;
    token?: string;
    tokenType?: string;
    createdAt: Date;
  } | null>;
  getPlayersForGame: (gameId: string) => Promise<
    {
      id: string;
      gameId: string;
      name: string;
      role: string;
      token?: string;
      tokenType?: string;
      createdAt: Date;
    }[]
  >;

  // Action operations (typed)
  recordAction: (actionData: {
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: A;
    gameState: S;
    validationResult: R;
  }) => Promise<{
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: A;
    gameState: S;
    timestamp: Date;
    validationResult: R;
  }>;
  getActionsForGame: (gameId: string) => Promise<
    {
      id: string;
      gameId: string;
      playerId: string;
      actionType: string;
      actionData: A;
      gameState: S;
      timestamp: Date;
      validationResult: R;
    }[]
  >;

  // Game state operations (typed)
  updateGameState: (gameStateData: { gameId: string; state: S }) => Promise<void>;
  getCurrentGameState: (
    gameId: string
  ) => Promise<{ gameId: string; state: S; timestamp: Date } | null>;

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
    recordAction: async (actionData: {
      id: string;
      gameId: string;
      playerId: string;
      actionType: string;
      actionData: A;
      gameState: S;
      validationResult: R;
    }): Promise<{
      id: string;
      gameId: string;
      playerId: string;
      actionType: string;
      actionData: A;
      gameState: S;
      timestamp: Date;
      validationResult: R;
    }> => {
      return recordAction(actionData);
    },

    getActionsForGame: async (
      gameId: string
    ): Promise<
      {
        id: string;
        gameId: string;
        playerId: string;
        actionType: string;
        actionData: A;
        gameState: S;
        timestamp: Date;
        validationResult: R;
      }[]
    > => {
      return getActionsForGame(gameId);
    },

    // Game state operations (typed)
    updateGameState: async (gameStateData: { gameId: string; state: S }): Promise<void> => {
      return updateGameState(gameStateData);
    },

    getCurrentGameState: async (
      gameId: string
    ): Promise<{ gameId: string; state: S; timestamp: Date } | null> => {
      return getCurrentGameState(gameId);
    },

    // Validation operations (typed)
    updateGameStateWithValidation: async (
      gameId: string,
      action: A,
      token: string
    ): Promise<{ success: boolean; state?: S; error?: string }> => {
      return updateGameStateWithValidation(gameId, action, token);
    },
  };
};
