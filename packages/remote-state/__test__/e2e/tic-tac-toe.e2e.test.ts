import request from 'supertest';
import { createRemoteStateServer } from '../../src/core/server';

// Import Jest globals
import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import { LogLevel } from '../../src';

// Import Tic-Tac-Toe types and engine from the example server
import { createInitialGameState } from '../../../remote-state-example-server/src/games/tic-tac-toe/types';
import {
  validateActionSimple as validateAction,
  executeActionSimple as executeAction,
} from '../../../remote-state-example-server/src/games/tic-tac-toe/engine';

describe('Tic-Tac-Toe E2E Tests', () => {
  // Set test timeout to 5 seconds to prevent hanging
  jest.setTimeout(5000);
  let server: Awaited<ReturnType<typeof createRemoteStateServer>>;

  beforeAll(async () => {
    // Create a test server instance using the game logic from the example server
    const testServer = await createRemoteStateServer(
      {
        getInitialState: () => Promise.resolve(createInitialGameState()),
        validateAction,
        executeAction,

        gameConfig: {
          name: 'Tic-Tac-Toe',
          description: 'Classic 3x3 tic-tac-toe game',
        },
        serverConfiguration: {
          persistDatabase: false,
          minimumLogLevel: LogLevel.error,
        },
      },
      0
    );
    server = testServer;

    // Start the server
    await server.startServer();
  });

  afterAll(async () => {
    // Properly close the server
    if (server) {
      try {
        // Simple approach - just close the server without calling process.exit
        await server.shutdown(false);
      } catch (error) {
        // Log error but don't fail the test
        // eslint-disable-next-line no-console, no-undef
        console.error('Server shutdown error:', error);
      }
    }
  });

  it('should create a new game and register owner', async () => {
    const response = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    expect(response.body.gameId).toBeDefined();
    expect(response.body.token).toBeDefined();
    expect(response.body.playerId).toBeDefined();
  });

  it('should allow another player to join the game', async () => {
    // First create a game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;

    // Then join the game
    const joinResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    expect(joinResponse.body.success).toBe(true);
    expect(joinResponse.body.gameId).toBe(gameId);
    expect(joinResponse.body.token).toBeDefined();
    expect(joinResponse.body.playerId).toBeDefined();
  });

  it('should make the first move (X player)', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    // Make first move
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // The API returns the state directly, not a wrapper object
    expect(response.body).toBeDefined();
    expect(response.body.board[0][0]).toBe('X');
    expect(response.body.board[0][1]).toBeNull();
    expect(response.body.board[0][2]).toBeNull();
    expect(response.body.board[1][0]).toBeNull();
    expect(response.body.board[1][1]).toBeNull();
    expect(response.body.board[1][2]).toBeNull();
    expect(response.body.board[2][0]).toBeNull();
    expect(response.body.board[2][1]).toBeNull();
    expect(response.body.board[2][2]).toBeNull();
    expect(response.body.currentPlayer).toBe('O');
    expect(response.body.winner).toBeNull();
    expect(response.body.winLine).toBeNull();
  });

  it('should make the second move (O player)', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make first move
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Make second move
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // The API returns the state directly, not a wrapper object
    expect(response.body).toBeDefined();
    expect(response.body.board[0][0]).toBe('X');
    expect(response.body.board[0][1]).toBeNull();
    expect(response.body.board[0][2]).toBeNull();
    expect(response.body.board[1][0]).toBeNull();
    expect(response.body.board[1][1]).toBe('O');
    expect(response.body.board[1][2]).toBeNull();
    expect(response.body.board[2][0]).toBeNull();
    expect(response.body.board[2][1]).toBeNull();
    expect(response.body.board[2][2]).toBeNull();
    expect(response.body.currentPlayer).toBe('X');
    expect(response.body.winner).toBeNull();
    expect(response.body.winLine).toBeNull();
  });

  it('should make the third move (X player)', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Make third move
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // The API returns the state directly, not a wrapper object
    expect(response.body).toBeDefined();
    expect(response.body.board[0][0]).toBe('X');
    expect(response.body.board[0][1]).toBe('X');
    expect(response.body.board[0][2]).toBeNull();
    expect(response.body.board[1][0]).toBeNull();
    expect(response.body.board[1][1]).toBe('O');
    expect(response.body.board[1][2]).toBeNull();
    expect(response.body.board[2][0]).toBeNull();
    expect(response.body.board[2][1]).toBeNull();
    expect(response.body.board[2][2]).toBeNull();
    expect(response.body.currentPlayer).toBe('O');
    expect(response.body.winner).toBeNull();
    expect(response.body.winLine).toBeNull();
  });

  it('should make the fourth move (O player)', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Make fourth move
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // The API returns the state directly, not a wrapper object
    expect(response.body).toBeDefined();
    expect(response.body.board[0][0]).toBe('X');
    expect(response.body.board[0][1]).toBe('X');
    expect(response.body.board[0][2]).toBeNull();
    expect(response.body.board[1][0]).toBe('O');
    expect(response.body.board[1][1]).toBe('O');
    expect(response.body.board[1][2]).toBeNull();
    expect(response.body.board[2][0]).toBeNull();
    expect(response.body.board[2][1]).toBeNull();
    expect(response.body.board[2][2]).toBeNull();
    expect(response.body.currentPlayer).toBe('X');
    expect(response.body.winner).toBeNull();
    expect(response.body.winLine).toBeNull();
  });

  it('should make the fifth move (X player) and win the game', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Make fifth move (winning move)
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // The API returns the state directly, not a wrapper object
    expect(response.body).toBeDefined();
    expect(response.body.board[0][0]).toBe('X');
    expect(response.body.board[0][1]).toBe('X');
    expect(response.body.board[0][2]).toBe('X');
    expect(response.body.board[1][0]).toBe('O');
    expect(response.body.board[1][1]).toBe('O');
    expect(response.body.board[1][2]).toBeNull();
    expect(response.body.board[2][0]).toBeNull();
    expect(response.body.board[2][1]).toBeNull();
    expect(response.body.board[2][2]).toBeNull();
    expect(response.body.currentPlayer).toBe('X'); // Game is over, but currentPlayer remains as the winner
    expect(response.body.winner).toBe('X');
    expect(response.body.winLine).toEqual({
      type: 'row',
      player: 'X',
      positions: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    });
  });

  it('should retrieve the final game state', async () => {
    // Setup game and play to completion
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves to win the game
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Retrieve final state
    const response = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.gameId).toBe(gameId);
    expect(response.body.state.winner).toBe('X');
    expect(response.body.state.board[0]).toEqual(['X', 'X', 'X']); // Winning row
  });

  it('should not allow additional moves after game is finished', async () => {
    // Setup game and play to completion
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player O',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves to win the game
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: ownerResponse.body.playerId,
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Try to make another move after game is finished
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: joinerResponse.body.playerId,
          position: [2, 2],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(400);

    expect(response.body.error).toBe('Game is already finished');
  });
});
