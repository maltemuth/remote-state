import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createLogger } from './logger';
import { initializeDatabase, closeDatabase } from './db/instance';
import { validateGameAction } from './game-engine/validator';
import { Player } from './db/models/Player';
import * as process from 'process';
import {
  createGame,
  getGame,
  recordAction,
  getCurrentGameState,
  updateGameState,
  createGameOwner,
  createJoiningPlayer,
  validatePlayerToken,
} from './db/service';

// Database initialization will happen when needed during requests

export interface GameValidationResult {
  valid: boolean;
  message: string;
  error?: string;
  code?: string;
}

export interface GameMoveResult<StateType> {
  success: boolean;
  state: StateType;
  validationResult: GameValidationResult;
  gameOver: boolean;
  winner: string | null;
}

export interface RemoteStateServerConfig<StateType, ActionType> {
  /** Function to create initial game state */
  getInitialState: (gameId: string) => StateType;
  /** Function to validate an action */
  validateAction: (state: StateType, action: ActionType) => GameValidationResult;
  /** Function to execute an action and return new state */
  executeAction: (
    state: StateType,
    action: ActionType & { playerId: string; timestamp: Date }
  ) => GameMoveResult<StateType>;
  /** Optional game-specific configuration */
  gameConfig?: {
    name: string;
    description?: string;
  };
  /** Database persistence configuration */
  persistDatabase?: boolean;
  databaseFilename?: string;
}

export interface RemoteStateServer {
  app: Express;
  server: ReturnType<typeof createServer>;
  startServer: () => void;
  shutdown: () => Promise<void>;
  port: number;
}

export const createRemoteStateServer = async <StateType, ActionType>(
  config: RemoteStateServerConfig<StateType, ActionType>,
  port: number = 3000
): Promise<RemoteStateServer> => {
  const { info, error } = createLogger({
    scope: 'remote-state-server',
  });

  const databasePath = config.persistDatabase ? config.databaseFilename || 'games.db' : ':memory:';
  await initializeDatabase({ databasePath, sync: true }).catch(err => {
    error('Failed to initialize database:', err);
  });

  const app = express();

  // Create HTTP server
  const server = createServer(app);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Action submission endpoint
  app.post('/api/games/:gameId/actions', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { action, token } = req.body;

      info(`Received action for game ${gameId}:`, { action, hasToken: !!token });

      // Validate request
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }

      // Check if game exists
      let game = await getGame(gameId);
      if (!game) {
        // Create game if it doesn't exist
        game = await createGame({
          id: gameId,
          name: config.gameConfig?.name || `Game ${gameId}`,
          status: 'waiting',
        });

        // Initialize game state
        const initialState = config.getInitialState(gameId);
        await updateGameState({
          gameId,
          state: initialState,
        });
      }

      // Validate player token if provided
      let player: {
        id: string;
        gameId: string;
        name: string;
        role: string;
        token?: string;
        tokenType?: string;
        createdAt: Date;
      } | null = null;
      if (token) {
        player = await validatePlayerToken(token);
        if (!player) {
          return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN',
          });
        }

        // Verify player belongs to this game
        if (player.gameId !== gameId) {
          return res.status(403).json({
            error: 'Token does not belong to this game',
            code: 'WRONG_GAME',
          });
        }
      } else {
        // Return error if no token is provided
        return res.status(401).json({
          error: 'Authentication required',
          code: 'MISSING_AUTHENTICATION',
          timestamp: new Date().toISOString(),
        });
      }

      // Get current game state
      info(`Getting current game state for game: ${gameId}`);
      const currentStateResult = await getCurrentGameState(gameId);
      info(`Current state result:`, currentStateResult);

      // If no state exists, create initial state
      let currentState = currentStateResult?.state;
      if (!currentState) {
        info(`No game state found, creating initial state for game: ${gameId}`);
        const initialState = config.getInitialState(gameId);
        await updateGameState({
          gameId,
          state: initialState,
        });
        currentState = initialState;
      }

      // Use game-specific validation through dedicated module
      const validationResult = validateGameAction(
        currentState as StateType,
        action as ActionType,
        config
      );
      if (!validationResult.valid) {
        return res.status(400).json({
          error: validationResult.error || 'Invalid action',
          code: validationResult.code || 'INVALID_ACTION',
        });
      }

      // Update player's last activity
      await Player.update({ lastActivityAt: new Date() }, { where: { id: player.id } });

      // Execute the action
      const actionWithPlayer = {
        ...action,
        playerId: player.id,
        timestamp: new Date(),
      };

      const executionResult = config.executeAction(
        currentState as StateType,
        actionWithPlayer as ActionType & { playerId: string; timestamp: Date }
      );

      if (!executionResult.success) {
        return res.status(400).json({
          error: executionResult.validationResult.message || 'Action execution failed',
          code: executionResult.validationResult.code || 'ACTION_FAILED',
        });
      }

      // Record the action in the database
      const newAction = await recordAction({
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        gameId,
        playerId: player.id,
        actionType: action.type || 'unknown',
        actionData: action,
        gameState: executionResult.state,
        validationResult: executionResult.validationResult,
      });

      // Update game state with the new state
      await updateGameState({
        gameId,
        state: executionResult.state,
      });

      // Return success response
      res.status(201).json({
        success: true,
        actionId: newAction.id,
        message: 'Action submitted successfully',
        validationResult: executionResult.validationResult,
        gameOver: executionResult.gameOver,
        winner: executionResult.winner,
      });
    } catch (err) {
      error('Error processing action:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Current state retrieval endpoint
  app.get('/api/games/:gameId/state/current', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;

      info(`Retrieving current state for game ${gameId}`);

      // Check if game exists
      const game = await getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Get current game state from database
      const gameState = await getCurrentGameState(gameId);

      // If no state exists, create initial state
      if (!gameState?.state) {
        const initialState = config.getInitialState(gameId);
        await updateGameState({
          gameId,
          state: initialState,
        });

        const transformedState = initialState;

        const response = {
          gameId,
          state: transformedState,
          lastAction: null,
          timestamp: new Date().toISOString(),
          cursor: {
            id: `cursor-${Date.now()}`,
            gameId,
            timestamp: new Date().toISOString(),
            stateHash: 'demo-hash',
            position: 0,
          },
        };

        return res.json(response);
      }

      const transformedState = gameState.state;

      const response = {
        gameId,
        state: transformedState,
        lastAction: null,
        timestamp: new Date().toISOString(),
        cursor: {
          id: `cursor-${Date.now()}`,
          gameId,
          timestamp: new Date().toISOString(),
          stateHash: 'demo-hash',
          position: 0,
        },
      };

      res.json(response);
    } catch (err) {
      error('Error retrieving state:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Self-register as game owner endpoint
  app.post('/api/auth/register/owner', async (req: Request, res: Response) => {
    try {
      const { playerName, gameName } = req.body;

      // Validate request
      if (!playerName || !gameName) {
        return res.status(400).json({ error: 'Player name and game name are required' });
      }

      // Generate a unique game ID
      const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the game in the database
      const game = await createGame({
        id: gameId,
        name: gameName,
        status: 'waiting',
      });

      // Create the game owner
      const owner = await createGameOwner(gameId, playerName);

      info(`Created new game with owner: ${game.id} - ${owner.name}`);

      // Return the game ID and owner token
      res.status(201).json({
        success: true,
        gameId: game.id,
        playerId: owner.id,
        token: owner.token,
        message: 'Game created and owner registered successfully',
      });
    } catch (err) {
      error('Error registering game owner:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Self-register as joining player endpoint
  app.post('/api/auth/register/join', async (req: Request, res: Response) => {
    try {
      const { playerName, gameId } = req.body;

      // Validate request
      if (!playerName || !gameId) {
        return res.status(400).json({ error: 'Player name and game ID are required' });
      }

      // Check if game exists
      const game = await getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if game is accepting players
      if (game.status !== 'waiting') {
        return res.status(400).json({ error: 'Game is not accepting new players' });
      }

      // Create the joining player
      const player = await createJoiningPlayer(gameId, playerName);

      info(`Created joining player: ${player.name} for game ${gameId}`);

      // Return the player ID and token
      res.status(201).json({
        success: true,
        playerId: player.id,
        token: player.token,
        gameId,
        message: 'Player registered successfully',
      });
    } catch (err) {
      error('Error registering joining player:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      game: config.gameConfig?.name || 'Unknown Game',
    });
  });

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    error('Server error:', { stack: err.stack });
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Helper function to start the server
  const startServer = () => {
    server.listen(port, () => {
      info(`Remote State server listening at http://localhost:${port}`);
      info(`Game: ${config.gameConfig?.name || 'Unknown Game'}`);
      info('Endpoints:');
      info('  POST /api/auth/register/owner - Register as game owner (creates new game)');
      info('  POST /api/auth/register/join - Register as joining player (joins existing game)');
      info('  POST /api/games/:gameId/actions - Submit game action');
      info('  GET /api/games/:gameId/state/current - Retrieve current game state');
      info('  GET /health - Health check');
    });
  };

  // Graceful shutdown handling
  const shutdown = async () => {
    info('Shutting down server...');
    try {
      // Close database connections
      await closeDatabase();
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      info('Server shut down successfully');
      process.exit(0);
    } catch (error) {
      error('Error during shutdown:', { error });
      process.exit(1);
    }
  };

  // Listen for shutdown signals only in Node.js environment (not in tests)
  if (typeof process !== 'undefined' && process.on) {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  return {
    app,
    server,
    startServer,
    shutdown,
    port,
  };
};
