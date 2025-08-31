import request from 'supertest';
import { createRemoteStateServer } from '../../src/core/server';

// Import Jest globals
import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';

// Import Battleship types
import {
  BattleshipState,
  BattleshipAction,
  GameValidationResult,
  GameMoveResult,
  Player,
  createInitialGameState,
} from '../../../remote-state-example-server/src/games/battleship/types';
import { LogLevel } from '../../src';

describe('Battleship E2E Tests', () => {
  // Set test timeout to 30 seconds to prevent hanging
  jest.setTimeout(5000);
  let server: Awaited<ReturnType<typeof createRemoteStateServer>>;

  beforeAll(async () => {
    // Create a test server instance with database initialization disabled
    const testServer = await createRemoteStateServer(
      {
        getInitialState: () => createInitialGameState(''),
        validateAction: (
          state: BattleshipState,
          action: BattleshipAction,
          playerId: string // playerId passed from authentication context
        ): GameValidationResult => {
          // Check if game is finished
          if (state.status === 'finished') {
            return {
              valid: false,
              message: 'Game is already finished',
              error: 'Game is already finished',
              code: 'GAME_FINISHED',
            };
          }

          // Simple validation for battleship actions
          if (action.type === 'place_ship') {
            if (!action.shipType || !action.position || !action.orientation) {
              return {
                valid: false,
                message: 'Ship placement requires ship type, position, and orientation',
                error: 'Missing required parameters',
                code: 'MISSING_PARAMETERS',
              };
            }

            const [row, col] = action.position;
            if (row < 0 || row > 4 || col < 0 || col > 4) {
              return {
                valid: false,
                message: 'Position out of bounds',
                error: 'Position out of bounds',
                code: 'POSITION_OUT_OF_BOUNDS',
              };
            }

            // Check if position is already occupied
            const playerKey = playerId === state.players.player1 ? 'player1' : 'player2';
            if (state.boards[playerKey][row][col] !== 'empty') {
              return {
                valid: false,
                message: 'Position already occupied',
                error: 'Position already occupied',
                code: 'POSITION_OCCUPIED',
              };
            }
          }

          if (action.type === 'fire_shot') {
            if (!action.position) {
              return {
                valid: false,
                message: 'Position is required for fire shot actions',
                error: 'Position is required',
                code: 'POSITION_REQUIRED',
              };
            }

            const [row, col] = action.position;
            if (row < 0 || row > 4 || col < 0 || col > 4) {
              return {
                valid: false,
                message: 'Position out of bounds',
                error: 'Position out of bounds',
                code: 'POSITION_OUT_OF_BOUNDS',
              };
            }

            // Check if game is in playing state
            if (state.status !== 'playing') {
              return {
                valid: false,
                message: 'Game is not in playing state',
                error: 'Game not started',
                code: 'GAME_NOT_STARTED',
              };
            }

            // Check if it's the correct player's turn
            if (playerId !== state.players[state.currentPlayer]) {
              return {
                valid: false,
                message: `It's not your turn`,
                error: 'Wrong player turn',
                code: 'WRONG_PLAYER_TURN',
              };
            }

            // Check if position has already been fired at
            const opponentKey = state.currentPlayer === 'player1' ? 'player2' : 'player1';
            if (state.boards[opponentKey][row][col] !== 'empty') {
              return {
                valid: false,
                message: 'Position already fired at',
                error: 'Position already targeted',
                code: 'POSITION_ALREADY_TARGETED',
              };
            }
          }

          return {
            valid: true,
            message: 'Action is valid',
          };
        },
        executeAction: (
          state: BattleshipState,
          action: BattleshipAction,
          playerId: string // playerId passed from authentication context
        ): GameMoveResult => {
          // Simple execution for battleship actions
          const newState = JSON.parse(JSON.stringify(state)); // Deep copy

          if (action.type === 'place_ship') {
            if (action.shipType && action.position && action.orientation) {
              const playerKey = playerId === state.players.player1 ? 'player1' : 'player2';

              // Place ship on board (simplified - just mark positions as occupied)
              const [row, col] = action.position;
              const shipSize =
                action.shipType === 'destroyer'
                  ? 2
                  : action.shipType === 'submarine'
                    ? 3
                    : action.shipType === 'cruiser'
                      ? 3
                      : 4;

              if (action.orientation === 'horizontal') {
                for (let i = 0; i < shipSize; i++) {
                  newState.boards[playerKey][row][col + i] = 'ship';
                }
              } else {
                for (let i = 0; i < shipSize; i++) {
                  newState.boards[playerKey][row + i][col] = 'ship';
                }
              }

              // Add ship to ships array
              if (!newState.ships[playerKey]) {
                newState.ships[playerKey] = [];
              }
              newState.ships[playerKey].push({
                type: action.shipType,
                positions: [],
                orientation: action.orientation,
                hits: 0,
                sunk: false,
              });

              newState.lastMove = {
                player: playerKey as Player,
                action: 'place_ship',
                position: action.position,
                result: null,
                timestamp: action.timestamp,
              };
              newState.updatedAt = action.timestamp;

              // Check if both players have placed ships (simplified check)
              const player1Ships = newState.ships.player1 ? newState.ships.player1.length : 0;
              const player2Ships = newState.ships.player2 ? newState.ships.player2.length : 0;
              if (player1Ships >= 4 && player2Ships >= 4) {
                newState.status = 'playing';
              }
            }
          }

          if (action.type === 'fire_shot') {
            if (action.position) {
              const opponentKey = newState.currentPlayer === 'player1' ? 'player2' : 'player1';
              const [row, col] = action.position;
              let result: 'hit' | 'miss' | 'sunk' = 'miss';

              if (newState.boards[opponentKey][row][col] === 'ship') {
                newState.boards[opponentKey][row][col] = 'hit';
                result = 'hit';

                // Check for win condition (simplified)
                let allShipsSunk = true;
                for (let r = 0; r < 5; r++) {
                  for (let c = 0; c < 5; c++) {
                    if (newState.boards[opponentKey][r][c] === 'ship') {
                      allShipsSunk = false;
                      break;
                    }
                  }
                  if (!allShipsSunk) break;
                }

                if (allShipsSunk) {
                  newState.status = 'finished';
                  newState.winner = newState.currentPlayer;
                }
              } else {
                newState.boards[opponentKey][row][col] = 'miss';
              }

              newState.lastMove = {
                player: newState.currentPlayer,
                action: 'fire_shot',
                position: action.position,
                result,
                timestamp: action.timestamp,
              };
              newState.updatedAt = action.timestamp;

              // Switch players if game is not over
              if (newState.status !== 'finished') {
                newState.currentPlayer =
                  newState.currentPlayer === 'player1' ? 'player2' : 'player1';
              }
            }
          }

          return {
            success: true,
            state: newState,
            gameOver: newState.status === 'finished',
            winner: newState.winner,
          };
        },
        filterStateForPlayer: (state: BattleshipState, playerId: string): BattleshipState => {
          // Create a deep copy of the state to avoid mutating the original
          const filteredState: BattleshipState = JSON.parse(JSON.stringify(state));

          // Determine which player this is
          let currentPlayer: Player = 'player1';
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
          position: [4, 0],
          orientation: 'vertical',
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Check if game is now in playing state
    const stateResponse = await request(server.app)
      .get(`/api/games/${gameId}/state/current`)
      .expect(200);

    expect(stateResponse.body.state.status).toBe('playing');
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
          token,
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
          token,
        })
        .expect(201);
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
          position: [4, 4],
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
          position: [4, 4],
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
          position: [4, 4],
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
          position: [4, 4],
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
