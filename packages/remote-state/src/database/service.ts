import { createLogger, Logger } from '../utils/logger';
import { safeJsonParse, safeJsonStringify } from '../utils/json';
import { GameState } from './models/GameState';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { AddPlayerDataSchema, GameDataSchema } from './validation';
import { Sequelize } from 'sequelize';
import { Transaction } from 'sequelize';
import { RemoteStateServerConfiguration } from '../core/server';

/**
 * Create a new game
 */
const createGameWithOwnerAndInitialState = async <StateType>(
  database: Sequelize,
  gameData: Pick<Game, 'name'>,
  ownerData: Pick<Player, 'name'>,
  initialState: StateType,
  logger: Logger
): Promise<{
  game: Game;
  admin: Player;
}> => {
  // Validate input
  const validatedData = GameDataSchema.parse(gameData);

  return await database.transaction(async (transaction: Transaction) => {
    logger.info(`Creating new game: ${validatedData.name}`);
    const game = await Game.create(
      {
        name: validatedData.name,
      },
      { transaction }
    );

    const admin = await Player.create(
      {
        name: ownerData.name,
        role: 'admin',
        gameId: game.id,
        token: generateToken(64, logger),
        tokenType: 'insecure',
      },
      { transaction }
    );

    const _state = await GameState.create(
      {
        gameId: game.id,
        playerId: admin.id,
        actionData: safeJsonStringify({}),
        actionType: 'initial',
        state: safeJsonStringify(initialState),
      },
      { transaction }
    );

    return {
      game,
      admin,
    };
  });
};

/**
 * Get a game by ID
 */
const getGame = async (gameId: string, { info }: Logger): Promise<Game> => {
  info(`Retrieving game: ${gameId}`);

  const result = await Game.findByPk(gameId);

  if (!result) {
    return null;
  }

  return result;
};

/**
 * Add a player to a game
 */
const addPlayerToGame = async (
  game: Pick<Game, 'id'>,
  player: Pick<Player, 'name' | 'role'>,
  logger: Logger
): Promise<Player> => {
  // Validate input
  const validatedData = AddPlayerDataSchema.parse({
    id: game.id,
    name: player.name,
    role: player.role,
  });

  logger.info(`Adding player ${validatedData.name} to game ${validatedData.id}`);

  const newPlayer = await Player.create({
    gameId: validatedData.id,
    name: validatedData.name,
    role: validatedData.role,
    token: generateToken(64, logger),
    tokenType: 'insecure',
  });

  return newPlayer;
};

/**
 * Generate a secure random token
 * @deprecated
 */
const generateToken = (length: number = 32, { warn }: Logger): string => {
  warn('Insecure token generator called.');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Get player by token
 */
const getPlayerByToken = async (token: string, { info }: Logger): Promise<Player | null> => {
  info(`Retrieving player by token`);

  const result = await Player.findOne({
    where: {
      token: token,
    },
  });

  if (!result) {
    return null;
  }

  return result;
};

interface ActionData<S, A> {
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
}

/**
 * Record an action and game state
 */
const recordAction = async <S, A>(
  actionData: ActionData<S, A>,
  { info }: Logger
): Promise<void> => {
  info(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const _newGameState = await GameState.create({
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    state: safeJsonStringify(actionData.gameState),
    actionType: actionData.actionType,
    actionData: safeJsonStringify(actionData.actionData),
  });

  return;
};

/**
 * Get current game state
 */
const getCurrentGameState = async <S>(
  gameId: string,
  { info }: Logger
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

  const parsedState = safeJsonParse<S>(result.state);
  return {
    gameId: result.gameId,
    state: parsedState,
    timestamp: result.createdAt,
  };
};

/**
 * Create a typed database service instance
 * @param actionType - The Action type for this service
 * @param stateType - The State type for this service

 * @returns A typed database service instance
 */
export const createDatabaseService = <StateType, ActionType>(
  db: Sequelize,
  configuration?: RemoteStateServerConfiguration
) => {
  const logger = createLogger({
    scope: 'db-service',
    logLevel: configuration?.minimumLogLevel,
  });

  // Return service with properly typed functions
  return {
    getGame: (gameId: string) => getGame(gameId, logger),

    // Player operations
    addPlayerToGame: (game: Pick<Game, 'id'>, player: Pick<Player, 'name' | 'role'>) =>
      addPlayerToGame(game, player, logger),
    getPlayerByToken: (token: string) => getPlayerByToken(token, logger),

    // Action operations (typed)
    recordAction: (actionData: ActionData<StateType, ActionType>) =>
      recordAction(actionData, logger),

    getCurrentGameState: <StateType>(gameId: string) =>
      getCurrentGameState<StateType>(gameId, logger),

    createGameWithOwnerAndInitialState: (
      game: Pick<Game, 'name'>,
      admin: Pick<Player, 'name'>,
      initialState: StateType
    ) => createGameWithOwnerAndInitialState<StateType>(db, game, admin, initialState, logger),
  };
};

/**
 * Service factory interface with typed Action and State generics
 */
export type DatabaseService<ActionType, StateType> = ReturnType<
  typeof createDatabaseService<ActionType, StateType>
>;
