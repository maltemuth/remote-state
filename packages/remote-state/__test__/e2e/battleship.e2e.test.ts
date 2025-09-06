import request from 'supertest';
import { createRemoteStateServer } from '../../src/core/server';

// Import Jest globals
import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';

// Import Battleship types and engine from the example server
import { createInitialGameState } from '../../../remote-state-example-server/src/games/battleship/types';
import {
  validateActionSimple as validateAction,
  executeActionSimple as executeAction,
} from '../../../remote-state-example-server/src/games/battleship/engine';
import { LogLevel } from '../../src';

describe('Battleship E2E Tests', () => {
  // Set test timeout to 5 seconds to prevent hanging
  jest.setTimeout(5000);
  let server: Awaited<ReturnType<typeof createRemoteStateServer>>;

  beforeAll(async () => {
    // Create a test server instance using the game logic from the example server
    const testServer = await createRemoteStateServer(
      {
        getInitialState: () => Promise.resolve(createInitialGameState('')),
        validateAction: async (state: any, action: any, playerId: string) => {
          // Fix player ID mapping for test environment
          const fixedState = {
            ...state,
            players: {
              player1: state.players.player1 || 'player1',
              player2: state.players.player2 || 'player2',
            },
          };
          return validateAction(fixedState, action, playerId);
        },
        executeAction: async (state: any, action: any, playerId: string) => {
          // Fix player ID mapping for test environment
          const fixedState = {
            ...state,
            players: {
              player1: state.players.player1 || 'player1',
              player2: state.players.player2 || 'player2',
            },
          };
          return executeAction(fixedState, action, playerId);
        },
        filterStateForPlayer: async (state: any, playerId: string): Promise<any> => {
          // Create a deep copy of the state to avoid mutating the original
          const filteredState: any = JSON.parse(JSON.stringify(state));

          // Determine which player this is
          let currentPlayer: any = 'player1';
          if (playerId === filteredState.players.player2) {
            currentPlayer = 'player2';
          }

          // Hide opponent's ships and show only hit/miss information
          const opponentKey = currentPlayer === 'player1' ? 'player2' : 'player1';

          // Create opponent board with only hit/miss information (ships are hidden)
          const opponentBoard = filteredState.boards[opponentKey].map(row =>
            row.map(cell => {
              if (cell === 'ship') {
                return 'empty'; // Hide opponent's ships
              }
              return cell; // Show hit/miss/sunk information
            })
          );

          // Update boards - player sees their own ships and opponent's hit/miss information
          filteredState.boards = {
            player1: currentPlayer === 'player1' ? filteredState.boards.player1 : opponentBoard,
            player2: currentPlayer === 'player2' ? filteredState.boards.player2 : opponentBoard,
          };

          // Hide opponent's ship details
          filteredState.ships = {
            player1: currentPlayer === 'player1' ? filteredState.ships.player1 : [],
            player2: currentPlayer === 'player2' ? filteredState.ships.player2 : [],
          };

          return filteredState;
        },
        gameConfig: {
          name: 'Simplified Battleship',
          description: '5x5 grid battleship game with incomplete information',
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
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
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
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;

    // Then join the game
    const joinResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    expect(joinResponse.body.success).toBe(true);
    expect(joinResponse.body.gameId).toBe(gameId);
    expect(joinResponse.body.token).toBeDefined();
    expect(joinResponse.body.playerId).toBeDefined();
  });

  it('should place ships for player 1', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    // Place destroyer horizontally
    const response1 = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [0, 0],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(response1.body).toBeDefined();
    expect(response1.body.status).toBe('setup');
    expect(response1.body).toHaveProperty('boards');
    expect(response1.body).toHaveProperty('ships');
    expect(response1.body).toHaveProperty('currentPlayer');
    expect(response1.body).toHaveProperty('status');

    // Place submarine vertically
    const response2 = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'submarine',
          position: [1, 1],
          orientation: 'vertical',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(response2.body).toBeDefined();
    expect(response2.body.status).toBe('setup');
    expect(response2.body).toHaveProperty('boards');
    expect(response2.body).toHaveProperty('ships');
    expect(response2.body).toHaveProperty('currentPlayer');
    expect(response2.body).toHaveProperty('status');
  });

  it('should place ships for player 2', async () => {
    // Setup game
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Place ships for player 1
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [0, 0],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'submarine',
          position: [1, 1],
          orientation: 'vertical',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Place ships for player 2
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [3, 3],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'submarine',
          position: [2, 0],
          orientation: 'vertical',
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Check if game state is valid
    const stateResponse = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .expect(200);

    expect(stateResponse.body.state.status).toBeDefined();
    expect(['setup', 'playing']).toContain(stateResponse.body.state.status);
  });

  it('should fire shots and show incomplete information', async () => {
    // Setup game and place ships
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Place ships for both players
    const placeShips = async (token: string) => {
      const response1 = await request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .send({
          action: {
            type: 'place_ship',
            shipType: 'destroyer',
            position: [0, 0],
            orientation: 'horizontal',
            timestamp: new Date(),
          },
          token,
        });

      if (response1.status !== 201) {
        // eslint-disable-next-line no-console, no-undef
        console.log('Place ship error:', response1.body);
      }
      expect(response1.status).toBe(201);

      const response2 = await request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .send({
          action: {
            type: 'place_ship',
            shipType: 'submarine',
            position: [1, 1],
            orientation: 'vertical',
            timestamp: new Date(),
          },
          token,
        });

      if (response2.status !== 201) {
        // eslint-disable-next-line no-console, no-undef
        console.log('Place ship error:', response2.body);
      }
      expect(response2.status).toBe(201);
    };

    await placeShips(ownerToken);
    await placeShips(joinerToken);

    // Player 1 fires at Player 2
    const shotResponse = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [3, 3],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(shotResponse.body).toBeDefined();
    expect(shotResponse.body.status).toBe('playing');
    expect(shotResponse.body.currentPlayer).toBe('player2');
    expect(shotResponse.body).toHaveProperty('boards');
    expect(shotResponse.body).toHaveProperty('ships');
    expect(shotResponse.body).toHaveProperty('currentPlayer');
    expect(shotResponse.body).toHaveProperty('status');

    // Check that Player 1 cannot see Player 2's ships (incomplete information)
    const player1State = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(player1State.body.state.boards.player2[3][3]).not.toBe('ship'); // Should not see ships
    expect(['hit', 'miss']).toContain(player1State.body.state.boards.player2[3][3]); // Should see hit/miss

    // Check that Player 2 can see their own ships
    const player2State = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(200);

    expect(player2State.body.state.boards.player2[3][3]).toBe('ship'); // Should see their own ships
  });

  it('should complete the game and show winner', async () => {
    // Setup game and place ships
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Place ships for both players (simplified - just place one ship each)
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [0, 0],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [4, 3],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Player 1 fires at Player 2's ship
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [4, 3],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Player 2 fires at Player 1's ship
    const finalResponse = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    expect(finalResponse.body).toBeDefined();
    expect(finalResponse.body.status).toBe('finished');
    expect(finalResponse.body.winner).toBeDefined();
    expect(finalResponse.body).toHaveProperty('boards');
    expect(finalResponse.body).toHaveProperty('ships');
    expect(finalResponse.body).toHaveProperty('currentPlayer');
    expect(finalResponse.body).toHaveProperty('status');
    expect(finalResponse.body).toHaveProperty('winner');

    // Retrieve final state
    const stateResponse = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .expect(200);

    expect(stateResponse.body.state.status).toBe('finished');
    expect(stateResponse.body.state.winner).toBeDefined();
  });

  it('should not allow additional moves after game is finished', async () => {
    // Setup game and play to completion
    const ownerResponse = await request(server.app)
      .post('/api/games')
      .send({
        playerName: 'Player 1',
        gameName: 'Test Battleship Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({
        playerName: 'Player 2',
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Place ships
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [0, 0],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'place_ship',
          shipType: 'destroyer',
          position: [4, 3],
          orientation: 'horizontal',
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Finish the game
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [4, 3],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Try to make another move after game is finished
    const response = await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'fire_shot',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(400);

    expect(response.body.error).toBe('Game is already finished');
  });
});
