import { createLogger } from '../utils/logger';
import { GameState } from './models/GameState';
import { Game } from './models/Game';
import { Player } from './models/Player';
import { Sequelize } from 'sequelize';
import { Transaction } from 'sequelize';
import * as crypto from 'crypto';

const { debug } = createLogger({
  scope: 'database',
});

/**
 * Create a game, its admin player and the initial state in one transaction
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
  return await database.transaction(async (transaction: Transaction) => {
    debug(`Creating new game: ${gameData.name}`);
    const game = await Game.create(
      {
        name: gameData.name,
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

    await GameState.create(
      {
        gameId: game.id,
        sequence: 0,
        playerId: admin.id,
        actionData: JSON.stringify({}),
        actionType: 'initial',
        state: JSON.stringify(initialState),
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
const getGame = async (gameId: string): Promise<Game | null> => {
  debug(`Retrieving game: ${gameId}`);
  return await Game.findByPk(gameId);
};

/**
 * Add a player to a game
 */
const addPlayerToGame = async (
  game: Pick<Game, 'id'>,
  player: Pick<Player, 'name' | 'role'>
): Promise<Player> => {
  debug(`Adding player ${player.name} to game ${game.id}`);

  // Name and role are checked by the Player model's validators
  const newPlayer = await Player.create({
    gameId: game.id,
    name: player.name,
    role: player.role,
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

  return await Player.findOne({ where: { token } });
};

/**
 * Record that a player was just active
 */
const touchPlayer = async (playerId: string): Promise<void> => {
  await Player.update({ lastActivityAt: new Date() }, { where: { id: playerId } });
};

/**
 * Resolve a token to a player of the given game, or null if it does not belong to it
 */
const authenticatePlayer = async (token: string, gameId: string): Promise<Player | null> => {
  if (!token || !gameId) {
    return null;
  }
  const player = await getPlayerByToken(token);
  return player && player.gameId === gameId ? player : null;
};

interface ActionData<S, A> {
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
}

/**
 * Append the state resulting from an action. Callers must serialize calls per game
 * (see core/gameLock); the unique (gameId, sequence) index rejects any that slip through.
 * @returns the id of the new state
 */
const recordAction = async <S, A>(
  database: Sequelize,
  actionData: ActionData<S, A>
): Promise<string> => {
  debug(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

  return await database.transaction(async (transaction: Transaction) => {
    const latest: number | null = await GameState.max('sequence', {
      where: { gameId: actionData.gameId },
      transaction,
    });
    const newGameState = await GameState.create(
      {
        gameId: actionData.gameId,
        sequence: (latest ?? -1) + 1,
        playerId: actionData.playerId,
        state: JSON.stringify(actionData.gameState),
        actionType: actionData.actionType,
        actionData: JSON.stringify(actionData.actionData),
      },
      { transaction }
    );
    return newGameState.id;
  });
};

export interface CurrentGameState<S> {
  gameId: string;
  stateId: string;
  sequence: number;
  state: S;
  timestamp: Date;
}

/**
 * Get the latest state of a game
 */
const getCurrentGameState = async <S>(gameId: string): Promise<CurrentGameState<S> | null> => {
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

  return {
    gameId: result.gameId,
    stateId: result.id,
    sequence: result.sequence,
    state: JSON.parse(result.state) as S,
    timestamp: result.createdAt,
  };
};

/**
 * Create a database service typed to one game's state and action types
 */
export const createDatabaseService = <StateType, ActionType>(db: Sequelize) => {
  return {
    getGame,
    addPlayerToGame,
    getPlayerByToken,
    authenticatePlayer,
    touchPlayer,

    recordAction: (actionData: ActionData<StateType, ActionType>) =>
      recordAction<StateType, ActionType>(db, actionData),

    getCurrentGameState: getCurrentGameState<StateType>,

    createGameWithOwnerAndInitialState: (
      game: Pick<Game, 'name'>,
      admin: Pick<Player, 'name'>,
      initialState: StateType
    ) => createGameWithOwnerAndInitialState<StateType>(db, game, admin, initialState),
  };
};

export type DatabaseService<StateType, ActionType> = ReturnType<
  typeof createDatabaseService<StateType, ActionType>
>;
