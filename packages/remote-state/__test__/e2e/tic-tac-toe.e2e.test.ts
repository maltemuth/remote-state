import request from 'supertest';
import { createRemoteStateServer } from '../../src/server-factory';
import type { Express } from 'express';
import { createServer } from 'http';

// Import Jest globals
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';

// Import Tic-Tac-Toe types
import {
  TicTacToeState,
  TicTacToeAction,
  GameValidationResult,
  GameMoveResult,
} from '../../../remote-state-example-server/src/games/tic-tac-toe/types';

describe('Tic-Tac-Toe E2E Tests', () => {
  let app: Express;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    // Create a test server instance with database initialization disabled
    const testServer = await createRemoteStateServer(
      {
        getInitialState: (_gameId: string) => ({
          board: [
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ],
          currentPlayer: 'X' as 'X' | 'O',
          status: 'waiting',
          winner: null,
          winLine: null,
          players: {
            X: null,
            O: null,
          },
          lastMove: {
            player: 'X' as 'X' | 'O',
            position: null,
            timestamp: null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        validateAction: (state: TicTacToeState, action: TicTacToeAction): GameValidationResult => {
          // Check if game is finished
          if (state.status === 'finished') {
            return {
              valid: false,
              message: 'Game is already finished',
              error: 'Game is already finished',
              code: 'GAME_FINISHED',
            };
          }

          // Simple validation for tic-tac-toe moves
          if (action.type === 'move') {
            if (!action.position) {
              return {
                valid: false,
                message: 'Position is required for move actions',
                error: 'Position is required for move actions',
                code: 'POSITION_REQUIRED',
              };
            }

            const [row, col] = action.position;
            if (row < 0 || row > 2 || col < 0 || col > 2) {
              return {
                valid: false,
                message: 'Position out of bounds',
                error: 'Position out of bounds',
                code: 'POSITION_OUT_OF_BOUNDS',
              };
            }

            if (state.board[row][col] !== null) {
              return {
                valid: false,
                message: 'Position already occupied',
                error: 'Position already occupied',
                code: 'POSITION_OCCUPIED',
              };
            }

            // Skip player validation for testing purposes
            // In a real implementation, we would check if the player ID matches the current player
          }

          return {
            valid: true,
            message: 'Action is valid',
          };
        },
        executeAction: (
          state: TicTacToeState,
          action: TicTacToeAction & { playerId: string; timestamp: Date }
        ): GameMoveResult => {
          // Simple execution for tic-tac-toe moves
          const newState = JSON.parse(JSON.stringify(state)); // Deep copy

          if (action.type === 'move') {
            const position = action.position;
            if (!position) {
              throw new Error('Position is required');
            }
            const [row, col] = position;
            newState.board[row][col] = state.currentPlayer;
            newState.lastMove = {
              player: state.currentPlayer,
              position: position,
              timestamp: action.timestamp,
            };
            newState.updatedAt = action.timestamp;

            // Check for win
            const player = state.currentPlayer;
            let winner = null;
            let winLine = null;

            // Check rows
            for (let r = 0; r < 3; r++) {
              if (
                newState.board[r][0] === player &&
                newState.board[r][1] === player &&
                newState.board[r][2] === player
              ) {
                winner = player;
                winLine = {
                  type: 'row',
                  player,
                  positions: [
                    [r, 0],
                    [r, 1],
                    [r, 2],
                  ],
                };
                break;
              }
            }

            // Check columns
            if (!winner) {
              for (let c = 0; c < 3; c++) {
                if (
                  newState.board[0][c] === player &&
                  newState.board[1][c] === player &&
                  newState.board[2][c] === player
                ) {
                  winner = player;
                  winLine = {
                    type: 'column',
                    player,
                    positions: [
                      [0, c],
                      [1, c],
                      [2, c],
                    ],
                  };
                  break;
                }
              }
            }

            // Check diagonals
            if (!winner) {
              if (
                newState.board[0][0] === player &&
                newState.board[1][1] === player &&
                newState.board[2][2] === player
              ) {
                winner = player;
                winLine = {
                  type: 'diagonal',
                  player,
                  positions: [
                    [0, 0],
                    [1, 1],
                    [2, 2],
                  ],
                };
              } else if (
                newState.board[0][2] === player &&
                newState.board[1][1] === player &&
                newState.board[2][0] === player
              ) {
                winner = player;
                winLine = {
                  type: 'diagonal',
                  player,
                  positions: [
                    [0, 2],
                    [1, 1],
                    [2, 0],
                  ],
                };
              }
            }

            // Check for draw
            let isDraw = false;
            if (!winner) {
              isDraw = true;
              for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                  if (newState.board[r][c] === null) {
                    isDraw = false;
                    break;
                  }
                }
                if (!isDraw) break;
              }
            }

            if (winner) {
              newState.winner = winner;
              newState.winLine = winLine;
              newState.status = 'finished';
            } else if (isDraw) {
              newState.status = 'finished';
            } else {
              // Switch players
              newState.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
            }
          }

          return {
            success: true,
            state: newState,
            validationResult: {
              valid: true,
              message: 'Action executed successfully',
            },
            gameOver: newState.status === 'finished',
            winner: newState.winner,
          };
        },
        gameConfig: {
          name: 'Tic-Tac-Toe',
          description: 'Classic 3x3 tic-tac-toe game',
        },
        persistDatabase: false,
      },
      0
    );
    app = (await testServer).app;
    server = (await testServer).server;
  });

  afterAll(async () => {
    // Properly close the server
    if (server) {
      await new Promise<void>(resolve => {
        server.close(() => {
          resolve();
        });
      });
    }
  });

  it('should create a new game and register owner', async () => {
    const response = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameId).toBeDefined();
    expect(response.body.token).toBeDefined();
    expect(response.body.playerId).toBeDefined();
  });

  it('should allow another player to join the game', async () => {
    // First create a game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;

    // Then join the game
    const joinResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    expect(joinResponse.body.success).toBe(true);
    expect(joinResponse.body.gameId).toBe(gameId);
    expect(joinResponse.body.token).toBeDefined();
    expect(joinResponse.body.playerId).toBeDefined();
  });

  it('should make the first move (X player)', async () => {
    // Setup game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    // Make first move
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameOver).toBe(false);
    expect(response.body.winner).toBeNull();
  });

  it('should make the second move (O player)', async () => {
    // Setup game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make first move
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Make second move
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameOver).toBe(false);
    expect(response.body.winner).toBeNull();
  });

  it('should make the third move (X player)', async () => {
    // Setup game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Make third move
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameOver).toBe(false);
    expect(response.body.winner).toBeNull();
  });

  it('should make the fourth move (O player)', async () => {
    // Setup game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Make fourth move
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameOver).toBe(false);
    expect(response.body.winner).toBeNull();
  });

  it('should make the fifth move (X player) and win the game', async () => {
    // Setup game
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    // Make fifth move (winning move)
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.gameOver).toBe(true);
    expect(response.body.winner).toBe('X');
  });

  it('should retrieve the final game state', async () => {
    // Setup game and play to completion
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves to win the game
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Retrieve final state
    const response = await request(app).get(`/api/games/${gameId}/state/current`).expect(200);

    expect(response.body.gameId).toBe(gameId);
    expect(response.body.state.winner).toBe('X');
    expect(response.body.state.status).toBe('finished');
    expect(response.body.state.board[0]).toEqual(['X', 'X', 'X']); // Winning row
  });

  it('should not allow additional moves after game is finished', async () => {
    // Setup game and play to completion
    const ownerResponse = await request(app)
      .post('/api/auth/register/owner')
      .send({
        playerName: 'Player X',
        gameName: 'Test Tic-Tac-Toe Game',
      })
      .expect(201);

    const gameId = ownerResponse.body.gameId;
    const ownerToken = ownerResponse.body.token;

    const joinerResponse = await request(app)
      .post('/api/auth/register/join')
      .send({
        playerName: 'Player O',
        gameId: gameId,
      })
      .expect(201);

    const joinerToken = joinerResponse.body.token;

    // Make moves to win the game
    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 0],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 1],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 1],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [1, 0],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(201);

    await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-x-id',
          position: [0, 2],
          timestamp: new Date(),
        },
        token: ownerToken,
      })
      .expect(201);

    // Try to make another move after game is finished
    const response = await request(app)
      .post(`/api/games/${gameId}/actions`)
      .send({
        action: {
          type: 'move',
          playerId: 'player-o-id',
          position: [2, 2],
          timestamp: new Date(),
        },
        token: joinerToken,
      })
      .expect(400);

    expect(response.body.error).toBe('Game is already finished');
    expect(response.body.code).toBe('GAME_FINISHED');
  });
});
