import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../../src/logger';
import { createSequelizeInstance, syncDatabase } from '../../src/db/sequelize';
import {
  createGame,
  getGame,
  updateGameStatus,
  addPlayerToGame,
  createGameOwner,
  createJoiningPlayer,
  getPlayerByToken,
  validatePlayerToken,
  getGameOwner,
  getPlayersForGame,
  recordAction,
  getActionsForGame,
  updateGameState,
  getCurrentGameState,
  updateGameStateWithValidation,
} from '../../src/db/service';

// Import Jest globals
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';

const { info: _info, error: _error } = createLogger({
  scope: 'database-service-test',
});

describe('Database Service Integration Tests', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    // Create a new Sequelize instance for testing
    sequelize = await createSequelizeInstance(':memory:');
    await syncDatabase();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('Game Operations', () => {
    test('should create a new game', async () => {
      const gameData = {
        id: 'test-game-1',
        name: 'Test Game',
        status: 'waiting',
      };

      const game = await createGame(gameData);

      expect(game).toBeDefined();
      expect(game.id).toBe(gameData.id);
      expect(game.name).toBe(gameData.name);
      expect(game.status).toBe(gameData.status);
      expect(game.createdAt).toBeDefined();
      expect(game.updatedAt).toBeDefined();
    });

    test('should get a game by ID', async () => {
      const gameData = {
        id: 'test-game-2',
        name: 'Test Game 2',
        status: 'waiting',
      };

      await createGame(gameData);
      const game = await getGame(gameData.id);

      expect(game).toBeDefined();
      expect(game!.id).toBe(gameData.id);
      expect(game!.name).toBe(gameData.name);
      expect(game!.status).toBe(gameData.status);
    });

    test('should return null for non-existent game', async () => {
      const game = await getGame('non-existent-game');
      expect(game).toBeNull();
    });

    test('should update game status', async () => {
      const gameData = {
        id: 'test-game-3',
        name: 'Test Game 3',
        status: 'waiting',
      };

      await createGame(gameData);
      await updateGameStatus(gameData.id, 'playing');

      const game = await getGame(gameData.id);
      expect(game!.status).toBe('playing');
    });
  });

  describe('Player Operations', () => {
    test('should add a player to a game', async () => {
      const gameData = {
        id: 'test-game-4',
        name: 'Test Game 4',
        status: 'waiting',
      };

      await createGame(gameData);

      const playerData = {
        id: 'test-player-1',
        gameId: gameData.id,
        name: 'Test Player',
        role: 'player' as const,
      };

      const player = await addPlayerToGame(playerData);

      expect(player).toBeDefined();
      expect(player.id).toBe(playerData.id);
      expect(player.gameId).toBe(playerData.gameId);
      expect(player.name).toBe(playerData.name);
      expect(player.role).toBe(playerData.role);
      expect(player.createdAt).toBeDefined();
    });

    test('should create a game owner', async () => {
      const gameData = {
        id: 'test-game-5',
        name: 'Test Game 5',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');

      expect(owner).toBeDefined();
      expect(owner.role).toBe('admin');
      expect(owner.tokenType).toBe('owner');
      expect(owner.token).toBeDefined();
    });

    test('should create a joining player', async () => {
      const gameData = {
        id: 'test-game-6',
        name: 'Test Game 6',
        status: 'waiting',
      };

      await createGame(gameData);

      const player = await createJoiningPlayer(gameData.id, 'Joining Player');

      expect(player).toBeDefined();
      expect(player.role).toBe('player');
      expect(player.tokenType).toBe('identity');
      expect(player.token).toBeDefined();
    });

    test('should get player by token', async () => {
      const gameData = {
        id: 'test-game-7',
        name: 'Test Game 7',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');
      const player = await getPlayerByToken(owner.token!);

      expect(player).toBeDefined();
      expect(player!.id).toBe(owner.id);
      expect(player!.name).toBe(owner.name);
    });

    test('should return null for invalid token', async () => {
      const player = await getPlayerByToken('invalid-token');
      expect(player).toBeNull();
    });

    test('should validate player token', async () => {
      const gameData = {
        id: 'test-game-8',
        name: 'Test Game 8',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');
      const validatedPlayer = await validatePlayerToken(owner.token!);

      expect(validatedPlayer).toBeDefined();
      expect(validatedPlayer!.id).toBe(owner.id);
    });

    test('should get game owner', async () => {
      const gameData = {
        id: 'test-game-9',
        name: 'Test Game 9',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');
      const retrievedOwner = await getGameOwner(gameData.id);

      expect(retrievedOwner).toBeDefined();
      expect(retrievedOwner!.id).toBe(owner.id);
    });

    test('should get players for a game', async () => {
      const gameData = {
        id: 'test-game-10',
        name: 'Test Game 10',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');
      const player = await createJoiningPlayer(gameData.id, 'Joining Player');
      const players = await getPlayersForGame(gameData.id);

      expect(players).toHaveLength(2);
      expect(players.map(p => p.id)).toContain(owner.id);
      expect(players.map(p => p.id)).toContain(player.id);
    });
  });

  describe('Action and State Operations', () => {
    test('should record an action', async () => {
      const gameData = {
        id: 'test-game-11',
        name: 'Test Game 11',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');

      const actionData = {
        id: 'test-action-1',
        gameId: gameData.id,
        playerId: owner.id,
        actionType: 'move',
        actionData: { position: 0, player: 'X' },
        gameState: {
          board: ['X', null, null, null, null, null, null, null, null],
          currentPlayer: 'O',
        },
        validationResult: { valid: true },
      };

      const action = await recordAction(actionData);

      expect(action).toBeDefined();
      expect(action.id).toBe(actionData.id);
      expect(action.gameId).toBe(actionData.gameId);
      expect(action.playerId).toBe(actionData.playerId);
      expect(action.actionType).toBe(actionData.actionType);
      expect(action.actionData).toEqual(actionData.actionData);
      expect(action.gameState).toEqual(actionData.gameState);
      expect(action.validationResult).toEqual(actionData.validationResult);
      expect(action.timestamp).toBeDefined();
    });

    test('should get actions for a game', async () => {
      const gameData = {
        id: 'test-game-12',
        name: 'Test Game 12',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');

      const actionData1 = {
        id: 'test-action-2',
        gameId: gameData.id,
        playerId: owner.id,
        actionType: 'move',
        actionData: { position: 0, player: 'X' },
        gameState: {
          board: ['X', null, null, null, null, null, null, null, null],
          currentPlayer: 'O',
        },
        validationResult: { valid: true },
      };

      const actionData2 = {
        id: 'test-action-3',
        gameId: gameData.id,
        playerId: owner.id,
        actionType: 'move',
        actionData: { position: 1, player: 'O' },
        gameState: {
          board: ['X', 'O', null, null, null, null, null, null, null],
          currentPlayer: 'X',
        },
        validationResult: { valid: true },
      };

      await recordAction(actionData1);
      await recordAction(actionData2);

      const actions = await getActionsForGame(gameData.id);

      expect(actions).toHaveLength(2);
      expect(actions.map(a => a.id)).toContain(actionData1.id);
      expect(actions.map(a => a.id)).toContain(actionData2.id);
    });

    test('should update game state', async () => {
      const gameData = {
        id: 'test-game-13',
        name: 'Test Game 13',
        status: 'waiting',
      };

      await createGame(gameData);

      const stateData = {
        gameId: gameData.id,
        state: { board: ['X', 'O', null, null, null, null, null, null, null], currentPlayer: 'X' },
      };

      await updateGameState(stateData);

      const currentState = await getCurrentGameState(gameData.id);

      expect(currentState).toBeDefined();
      expect(currentState!.gameId).toBe(gameData.id);
      expect(currentState!.state).toEqual(stateData.state);
    });

    test('should get current game state', async () => {
      const gameData = {
        id: 'test-game-14',
        name: 'Test Game 14',
        status: 'waiting',
      };

      await createGame(gameData);

      const stateData = {
        gameId: gameData.id,
        state: { board: ['X', 'O', 'X', null, null, null, null, null, null], currentPlayer: 'O' },
      };

      await updateGameState(stateData);

      const currentState = await getCurrentGameState(gameData.id);

      expect(currentState).toBeDefined();
      expect(currentState!.gameId).toBe(gameData.id);
      expect(currentState!.state).toEqual(stateData.state);
    });

    test('should return null for non-existent game state', async () => {
      const currentState = await getCurrentGameState('non-existent-game');
      expect(currentState).toBeNull();
    });

    test('should update game state with validation', async () => {
      const gameData = {
        id: 'test-game-15',
        name: 'Test Game 15',
        status: 'waiting',
      };

      await createGame(gameData);

      const owner = await createGameOwner(gameData.id, 'Game Owner');

      const result = await updateGameStateWithValidation(
        gameData.id,
        { position: 0, player: 'X' },
        owner.token!
      );

      // This should fail because there's no current game state
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('No current game state found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid game creation', async () => {
      // This should not throw an error, but create a game successfully
      const gameData = {
        id: 'test-game-16',
        name: 'Test Game 16',
        status: 'invalid-status', // This should still work as it's just a string
      };

      const game = await createGame(gameData);
      expect(game).toBeDefined();
      expect(game.status).toBe('invalid-status');
    });

    test('should handle invalid player data', async () => {
      const gameData = {
        id: 'test-game-17',
        name: 'Test Game 17',
        status: 'waiting',
      };

      await createGame(gameData);

      const playerData = {
        id: 'test-player-2',
        gameId: gameData.id,
        name: '', // Empty name
        role: 'invalid-role' as 'invalid-role', // Invalid role
      };

      const player = await addPlayerToGame(playerData);
      expect(player).toBeDefined();
      expect(player.name).toBe('');
      expect(player.role).toBe('invalid-role');
    });
  });
});
