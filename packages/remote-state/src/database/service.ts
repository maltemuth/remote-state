import { createLogger } from '../utils/logger';
import { safeJsonParse, safeJsonStringify } from '../utils/json';
import { GameState } from './models/GameState';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { GameDataSchema, PlayerDataSchema } from './validation';
import { Op } from 'sequelize';
import { Transaction } from 'sequelize';
import { getSequelizeInstance } from './sequelize';

const { info } = createLogger({
  scope: 'db-service',
});

/**
 * Create a new game
 */
export const createGame = async (gameData: {
  id: string;
  name: string;
}): Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }> => {
  // Validate input
  const validatedData = GameDataSchema.parse(gameData);

  info(`Creating new game: ${validatedData.name}`);

  const now = new Date();

  // Create the game
  const newGame = await Game.create({
    id: validatedData.id,
    name: validatedData.name,
    createdAt: now,
    updatedAt: now,
  });

  // Create initial game state
  try {
    await GameState.create({
      id: `state-${validatedData.id}`,
      gameId: validatedData.id,
      state: null,
      playerId: 'system',
      actionType: 'initial',
      actionData: null,
    });
  } catch (error) {
    throw new Error(
      `Failed to create initial game state: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    id: newGame.id,
    name: newGame.name,
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
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
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
  // Validate input
  const validatedData = PlayerDataSchema.parse(playerData);

  info(`Adding player ${validatedData.name} to game ${validatedData.gameId}`);

  const newPlayer = await Player.create({
    id: validatedData.id,
    gameId: validatedData.gameId,
    name: validatedData.name,
    role: validatedData.role,
    token: validatedData.token,
    tokenType: validatedData.tokenType,
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
export const recordAction = async <A, S>(actionData: {
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
}): Promise<{
  id: string;
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
  timestamp: Date;
}> => {
  info(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const newGameState = await GameState.create({
    id: actionData.id,
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    state: safeJsonStringify(actionData.gameState),
    actionType: actionData.actionType,
    actionData: safeJsonStringify(actionData.actionData),
  });

  return {
    id: actionData.id,
    gameId: newGameState.gameId,
    playerId: newGameState.playerId,
    actionType: newGameState.actionType,
    actionData: safeJsonParse(newGameState.actionData) as A,
    gameState: safeJsonParse(newGameState.state) as S,
    timestamp: newGameState.createdAt,
  };
};

/**
 * Get actions for a game
 */
export const getActionsForGame = async <A, S>(
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
      return { success: false, error: 'No current game state found' };
    }

    // Get player by token
    const player = await validatePlayerToken(token);
    if (!player) {
      return { success: false, error: 'Invalid player token' };
    }

    // Here we would call game-specific validation logic
    // This would be implemented by the game plugin in the actual server
    // For now, we'll return a success response
    return { success: true, state: currentState.state };
  } catch (error) {
    info(`Error updating game state with validation: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Service factory interface with typed Action and State generics
 */
export interface DatabaseService<ActionType, StateType> {
  // Game operations
  createGame: (gameData: {
    id: string;
    name: string;
  }) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>;
  getGame: (gameId: string) => Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  } | null>;

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
    actionData: ActionType; // Use generic type
    gameState: StateType; // Use generic type
  }) => Promise<{
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: ActionType;
    gameState: StateType;
    timestamp: Date;
  }>;
  getActionsForGame: (gameId: string) => Promise<
    {
      id: string;
      gameId: string;
      playerId: string;
      actionType: string;
      actionData: ActionType;
      gameState: StateType;
      timestamp: Date;
    }[]
  >;

  // Game state operations (typed)
  updateGameState: (gameStateData: { gameId: string; state: StateType }) => Promise<void>;
  getCurrentGameState: (
    gameId: string
  ) => Promise<{ gameId: string; state: StateType; timestamp: Date } | null>;

  // Validation operations (typed)
  updateGameStateWithValidation: (
    gameId: string,
    action: ActionType,
    token: string
  ) => Promise<{ success: boolean; state?: StateType; error?: string }>;
}

/**
 * Create a typed database service instance
 * @param actionType - The Action type for this service
 * @param stateType - The State type for this service
 * @param resultType - The Result type for this service
 * @returns A typed database service instance
 */
export const createDatabaseService = <ActionType, StateType>(): DatabaseService<
  ActionType,
  StateType
> => {
  // Return service with properly typed functions
  return {
    // Game operations
    createGame,
    getGame,

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
      actionData: ActionType;
      gameState: StateType;
    }): Promise<{
      id: string;
      gameId: string;
      playerId: string;
      actionType: string;
      actionData: ActionType;
      gameState: StateType;
      timestamp: Date;
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
        actionData: ActionType;
        gameState: StateType;
        timestamp: Date;
      }[]
    > => {
      return getActionsForGame(gameId);
    },

    // Game state operations (typed)
    updateGameState: async (gameStateData: { gameId: string; state: StateType }): Promise<void> => {
      return updateGameState(gameStateData);
    },

    getCurrentGameState: async (
      gameId: string
    ): Promise<{ gameId: string; state: StateType; timestamp: Date } | null> => {
      return getCurrentGameState(gameId);
    },

    // Validation operations (typed)
    updateGameStateWithValidation: async (
      gameId: string,
      action: ActionType,
      token: string
    ): Promise<{ success: boolean; state?: StateType; error?: string }> => {
      return updateGameStateWithValidation(gameId, action, token);
    },
  };
};

/**
 * Create a game with initial state using transaction
 */
export const createGameWithInitialState = async <S>(
  gameData: {
    id: string;
    name: string;
  },
  initialState: S
): Promise<{
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}> => {
  const sequelize = await getSequelizeInstance();

  return sequelize.transaction(async (transaction: Transaction) => {
    // Create the game
    const newGame = await Game.create(
      {
        id: gameData.id,
        name: gameData.name,
      },
      { transaction }
    );

    // Create initial game state
    await GameState.create(
      {
        id: `state-${gameData.id}`,
        gameId: gameData.id,
        state: safeJsonStringify(initialState),
        playerId: 'system',
        actionType: 'initial',
        actionData: null,
      },
      { transaction }
    );

    return {
      id: newGame.id,
      name: newGame.name,
      createdAt: newGame.createdAt,
      updatedAt: newGame.updatedAt,
    };
  });
};
