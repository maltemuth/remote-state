import * as crypto from 'crypto';
import { createLogger } from '../utils/logger.js';
import { Game, GameState, Player, type PlayerRole } from './entities/index.js';
import { type Orm } from './orm.js';

const { debug } = createLogger({
  scope: 'database',
});

const requireName = (name: unknown, what: string): string => {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${what} name must be a non-empty string`);
  }
  return name;
};

const roles: readonly PlayerRole[] = ['admin', 'player'];

/**
 * Generate a cryptographically secure random token of `length` hex characters
 */
const generateToken = (length: number = 64): string =>
  crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .substring(0, length);

interface ActionData<S, A> {
  gameId: string;
  playerId: string;
  actionType: string;
  actionData: A;
  gameState: S;
}

export interface CurrentGameState<S> {
  gameId: string;
  stateId: string;
  sequence: number;
  state: S;
  timestamp: Date;
}

/**
 * Create a database service typed to one game's state and action types. Every call
 * works in its own entity manager fork, so no entity state is shared between requests.
 */
export const createDatabaseService = <StateType, ActionType>(orm: Orm) => {
  const em = () => orm.em.fork();

  /**
   * Create a game, its admin player and the initial state in one transaction
   */
  const createGameWithOwnerAndInitialState = async (
    gameData: { name: string },
    ownerData: { name: string },
    initialState: StateType
  ): Promise<{ game: Game; admin: Player }> => {
    const name = requireName(gameData.name, 'Game');
    const ownerName = requireName(ownerData.name, 'Player');
    debug(`Creating new game: ${name}`);

    return await em().transactional(async tem => {
      const game = tem.create(Game, { name });
      const admin = tem.create(Player, {
        game,
        name: ownerName,
        role: 'admin',
        token: generateToken(),
      });
      tem.create(GameState, {
        game,
        sequence: 0,
        player: admin,
        actionType: 'initial',
        actionData: {},
        state: initialState,
      });
      return { game, admin };
    });
  };

  const getGame = async (gameId: string): Promise<Game | null> => {
    debug(`Retrieving game: ${gameId}`);
    return await em().findOne(Game, gameId);
  };

  const addPlayerToGame = async (
    game: { id: string },
    player: { name: string; role: PlayerRole }
  ): Promise<Player> => {
    const name = requireName(player.name, 'Player');
    if (!roles.includes(player.role)) {
      throw new Error(`Player role must be one of ${roles.join(', ')}`);
    }
    debug(`Adding player ${name} to game ${game.id}`);

    const fork = em();
    const newPlayer = fork.create(Player, {
      game: game.id,
      name,
      role: player.role,
      token: generateToken(),
    });
    await fork.flush();
    return newPlayer;
  };

  const getPlayerByToken = async (token: string): Promise<Player | null> => {
    debug(`Retrieving player by token`);
    return await em().findOne(Player, { token });
  };

  /**
   * Resolve a token to a player of the given game, or null if it does not belong to it
   */
  const authenticatePlayer = async (token: string, gameId: string): Promise<Player | null> => {
    if (!token || !gameId) {
      return null;
    }
    return await em().findOne(Player, { token, game: gameId });
  };

  /**
   * Record that a player was just active
   */
  const touchPlayer = async (playerId: string): Promise<void> => {
    await em().nativeUpdate(Player, { id: playerId }, { lastActivityAt: new Date() });
  };

  /**
   * Append the state resulting from an action. Callers must serialize calls per game
   * (see core/gameLock); the unique (game, sequence) index rejects any that slip through.
   * @returns the id of the new state
   */
  const recordAction = async (actionData: ActionData<StateType, ActionType>): Promise<string> => {
    debug(`Recording action: ${actionData.actionType} for game ${actionData.gameId}`);

    return await em().transactional(async tem => {
      const latest = await tem.findOne(
        GameState,
        { game: actionData.gameId },
        { orderBy: { sequence: 'desc' }, fields: ['sequence'] }
      );
      const newGameState = tem.create(GameState, {
        game: actionData.gameId,
        sequence: (latest?.sequence ?? -1) + 1,
        player: actionData.playerId,
        actionType: actionData.actionType,
        actionData: actionData.actionData,
        state: actionData.gameState,
      });
      return newGameState.id;
    });
  };

  /**
   * Get the latest state of a game
   */
  const getCurrentGameState = async (
    gameId: string
  ): Promise<CurrentGameState<StateType> | null> => {
    debug(`Retrieving current game state for game: ${gameId}`);

    const result = await em().findOne(
      GameState,
      { game: gameId },
      { orderBy: { sequence: 'desc' } }
    );
    if (!result) {
      return null;
    }

    return {
      gameId: result.game.id,
      stateId: result.id,
      sequence: result.sequence,
      state: result.state as StateType,
      timestamp: result.createdAt,
    };
  };

  return {
    createGameWithOwnerAndInitialState,
    getGame,
    addPlayerToGame,
    getPlayerByToken,
    authenticatePlayer,
    touchPlayer,
    recordAction,
    getCurrentGameState,
  };
};

export type DatabaseService<StateType, ActionType> = ReturnType<
  typeof createDatabaseService<StateType, ActionType>
>;
