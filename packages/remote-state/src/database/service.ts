import { createLogger } from '../utils/logger';
import { safeJsonParse, safeJsonStringify } from '../utils/json';
import { GameState } from './models/GameState';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { AddPlayerDataSchema, GameDataSchema } from './validation';
import { Sequelize } from 'sequelize';
import { Transaction } from 'sequelize';
import * as crypto from 'crypto';

const { debug, error } = createLogger({
  scope: 'database',
});

/**
 * Create a new game
 */
const createGameWithOwnerAndInitialState = async <StateType>(
  database: Sequelize,
  gameData: Pick<Game, 'name'>,
  ownerData: Pick<Player, 'name'>,
  initialState: StateType
): Promise<{
  game: Game;
  admin: Player;
}> => {
  // Validate input
  const validatedData = GameDataSchema.parse(gameData);

  return await database.transaction(async (transaction: Transaction) => {
    debug(`Creating new game: ${validatedData.name}`);
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
        token: generateToken(64),
        tokenType: 'secure',
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
const getGame = async (gameId: string): Promise<Game> => {
  debug(`Retrieving game: ${gameId}`);

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
  player: Pick<Player, 'name' | 'role'>
): Promise<Player> => {
  // Validate input
  const validatedData = AddPlayerDataSchema.parse({
    id: game.id,
    name: player.name,
    role: player.role,
  });

  debug(`Adding player ${validatedData.name} to game ${validatedData.id}`);

  const newPlayer = await Player.create({
    gameId: validatedData.id,
    name: validatedData.name,
    role: validatedData.role,
    token: generateToken(64),
    tokenType: 'secure',
  });

  return newPlayer;
};

/**
 * Generate a cryptographically secure random token
 * @param length - The desired length of the token (default: 32)
 * @param logger - Logger instance for logging
 * @returns A secure random token
 */
const generateToken = (length: number = 32): string => {
  debug(`Generating secure token with length: ${length}`);

  // Calculate the number of bytes needed to achieve the desired length
  // Each byte can be represented as 2 hex characters, so we need length/2 bytes
  const byteLength = Math.ceil(length / 2);

  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(byteLength);

  // Convert to hexadecimal and truncate to desired length
  const token = randomBytes.toString('hex').substring(0, length);

  return token;
};

/**
 * Get player by token
 */
const getPlayerByToken = async (token: string): Promise<Player | null> => {
  debug(`Retrieving player by token`);

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

const findPlayer = async (playerId: string) => await Player.findByPk(playerId);

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
const recordAction = async <S, A>(actionData: ActionData<S, A>): Promise<void> => {
  debug(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  const _newGameState = await GameState.create({
    gameId: actionData.gameId,
    playerId: actionData.playerId,
    state: safeJsonStringify(actionData.gameState),
    actionType: actionData.actionType,
    actionData: safeJsonStringify(actionData.actionData),
  }).catch(e => error(e));

  return;
};

/**
 * Get current game state
 */
const getCurrentGameState = async <S>(
  gameId: string
): Promise<{ gameId: string; state: S; timestamp: Date; stateId: string } | null> => {
  debug(`Retrieving current game state for game: ${gameId}`);

  const result = await GameState.findOne({
    where: {
      gameId: gameId,
    },
    order: [['sequence', 'DESC']],
  });

  if (!result) {
    return null;
  }

  const parsedState = safeJsonParse<S>(result.state);
  return {
    gameId: result.gameId,
    state: parsedState,
    timestamp: result.createdAt,
    stateId: result.id,
  };
};

/**
 * Create a typed database service instance
 * @param actionType - The Action type for this service
 * @param stateType - The State type for this service

 * @returns A typed database service instance
 */
export const createDatabaseService = <StateType, ActionType, _PlayerStateType>(db: Sequelize) => {
  // Return service with properly typed functions
  return {
    getGame,
    addPlayerToGame,
    getPlayerByToken,

    // Action operations (typed)
    recordAction: recordAction<StateType, ActionType>,

    getCurrentGameState: getCurrentGameState<StateType>,

    findPlayer,

    createGameWithOwnerAndInitialState: (
      game: Pick<Game, 'name'>,
      admin: Pick<Player, 'name'>,
      initialState: StateType
    ) => createGameWithOwnerAndInitialState<StateType>(db, game, admin, initialState),
  };
};

/**
 * Service factory interface with typed Action and State generics
 */
export type DatabaseService<StateType, ActionType, PlayerStateType> = ReturnType<
  typeof createDatabaseService<StateType, ActionType, PlayerStateType>
>;
