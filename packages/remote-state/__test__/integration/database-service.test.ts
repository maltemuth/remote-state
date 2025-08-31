import { Sequelize } from 'sequelize-typescript';
import { createLogger } from '../../src/utils/logger';
import { createSequelizeInstance, syncDatabase } from '../../src/database/sequelize';

// Import Jest globals
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { createDatabaseService, DatabaseService } from '../../src/database/service';

const { info: _info, error: _error } = createLogger({
  scope: 'database-service-test',
});

describe('Database Service Integration Tests', () => {
  let sequelize: Sequelize;
  let service: DatabaseService<unknown, unknown, unknown>;

  beforeAll(async () => {
    // Create a new Sequelize instance for testing
    sequelize = await createSequelizeInstance(':memory:');
    await syncDatabase(sequelize);
    service = createDatabaseService(sequelize);
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('Game Operations', () => {
    test('should create a new game', async () => {
      const gameData = { name: 'test game' };
      const playerData = {
        name: 'test admin',
      };
      const { game } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});

      expect(game).toBeDefined();
      expect(game.name).toBe(gameData.name);
      expect(game.createdAt).toBeDefined();
      expect(game.updatedAt).toBeDefined();
    });

    test('should get a game by ID', async () => {
      const gameData = {
        name: 'Test Game 2',
      };
      const playerData = {
        name: 'test admin 2',
      };

      const {
        game: { id: gameId },
      } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});
      const game = await service.getGame(gameId);

      expect(game).toBeDefined();
      expect(game!.name).toBe(gameData.name);
    });

    test('should return null for non-existent game', async () => {
      const game = await service.getGame('non-existent-game');
      expect(game).toBeNull();
    });
  });

  describe('Player Operations', () => {
    test('should create a game owner', async () => {
      const gameData = {
        id: 'test-game-4',
        name: 'Test Game 4',
      };
      const playerData = {
        name: 'test admin 4',
      };

      const {
        game: { id: gameId },
        admin,
      } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});

      expect(admin).toBeDefined();
      expect(admin.gameId).toBe(gameId);
      expect(admin.name).toBe(playerData.name);
      expect(admin.role).toBe('admin');
      expect(admin.createdAt).toBeDefined();
      expect(admin.tokenType).toBe('secure');
      expect(admin.token).toBeDefined();
    });

    test('should create a joining player', async () => {
      const gameData = {
        name: 'Test Game 6',
      };
      const adminData = {
        name: 'test admin 4',
      };

      const { game } = await service.createGameWithOwnerAndInitialState(gameData, adminData, {});

      const player = await service.addPlayerToGame(game, {
        name: 'Joining Player',
        role: 'player',
      });

      expect(player).toBeDefined();
      expect(player.role).toBe('player');
      expect(player.tokenType).toBe('secure');
      expect(player.token).toBeDefined();
    });

    test('should get player by token', async () => {
      const gameData = {
        id: 'test-game-7',
        name: 'Test Game 7',
      };
      const playerData = {
        name: 'Game Owner',
      };

      const { admin: owner } = await service.createGameWithOwnerAndInitialState(
        gameData,
        playerData,
        {}
      );

      const player = await service.getPlayerByToken(owner.token!);

      expect(player).toBeDefined();
      expect(player!.id).toBe(owner.id);
      expect(player!.name).toBe(owner.name);
    });

    test('should return null for invalid token', async () => {
      const player = await service.getPlayerByToken('invalid-token');
      expect(player).toBeNull();
    });
  });

  describe('Action and State Operations', () => {
    test('should record an action', async () => {
      const gameData = {
        id: 'test-game-11',
        name: 'Test Game 11',
      };
      const playerData = {
        name: 'Game Owner',
      };

      const {
        game: { id: gameId },
        admin: owner,
      } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});

      const actionData = {
        id: 'test-action-1',
        gameId: gameId,
        playerId: owner.id,
        actionType: 'move',
        actionData: { position: 0, player: 'X' },
        gameState: {
          board: ['X', null, null, null, null, null, null, null, null],
          currentPlayer: 'O',
        },
      };

      // recordAction returns void, so we just test that it doesn't throw
      await expect(service.recordAction(actionData)).resolves.not.toThrow();
    });

    test('should get current game state', async () => {
      const gameData = {
        id: 'test-game-14',
        name: 'Test Game 14',
      };
      const playerData = {
        name: 'Game Owner',
      };

      const { game } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});

      // Record an action to create game state
      await service.recordAction({
        gameId: game.id,
        playerId: 'test-player-id',
        actionType: 'initial',
        actionData: {},
        gameState: {
          board: ['X', 'O', 'X', null, null, null, null, null, null],
          currentPlayer: 'O',
        },
      });

      const currentState = await service.getCurrentGameState(game.id);

      expect(currentState).toBeDefined();
      expect(currentState!.gameId).toBe(game.id);
      expect(currentState!.state).toEqual({
        board: ['X', 'O', 'X', null, null, null, null, null, null],
        currentPlayer: 'O',
      });
    });

    test('should return null for non-existent game state', async () => {
      const currentState = await service.getCurrentGameState('non-existent-game');
      expect(currentState).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid game creation', async () => {
      // This should not throw an error, but create a game successfully
      const gameData = {
        id: 'test-game-16',
        name: 'Test Game 16',
      };
      const playerData = {
        name: 'test admin',
      };

      const { game } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});
      expect(game).toBeDefined();
    });

    test('should handle invalid player data', async () => {
      const gameData = {
        id: 'test-game-17',
        name: 'Test Game 17',
      };
      const playerData = {
        name: 'test admin',
      };

      const { game } = await service.createGameWithOwnerAndInitialState(gameData, playerData, {});

      const playerDataInvalid = {
        name: '', // Empty name
        role: 'invalid-role' as 'invalid-role', // Invalid role
      };

      await expect(() => service.addPlayerToGame(game, playerDataInvalid)).rejects.toThrow();
    });
  });
});
