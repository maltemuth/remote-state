import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createLogger } from './logger';
import {
  createGame,
  getGame,
  recordAction,
  getCurrentGameState,
  updateGameState,
  addPlayerToGame,
  createGameOwner,
  createJoiningPlayer,
  validatePlayerToken,
  createTicTacToeGameState,
  updateGameStateWithValidation,
} from './db/service';

const { info, error } = createLogger({
  scope: 'server',
});

const app = express();
const port = 3000;

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Action submission endpoint
app.post('/api/games/:gameId/actions', async (req, res) => {
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
        name: `Game ${gameId}`,
        status: 'waiting',
      });

      // Initialize tic-tac-toe game state
      await createTicTacToeGameState(gameId);
    }

    // Validate player token if provided
    let player = null;
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
      // Create a default player if no token is provided
      const defaultPlayerId = `player-${Date.now()}`;
      await addPlayerToGame({
        id: defaultPlayerId,
        gameId,
        name: 'Default Player',
        role: 'player',
      });
      player = { id: defaultPlayerId, gameId, name: 'Default Player', role: 'player' };
    }

    // Use typed game state validation for tic-tac-toe
    const validationResult = await updateGameStateWithValidation(gameId, action, token);

    if (!validationResult.success) {
      return res.status(400).json({
        error: validationResult.error || 'Invalid action',
        code: 'INVALID_ACTION',
      });
    }

    // Record the action in the database
    const newAction = await recordAction({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gameId,
      playerId: player.id,
      actionType: action.type || 'unknown',
      actionData: action,
      gameState: validationResult.state, // Use the validated game state
      validationResult: { valid: true, message: 'Action accepted' },
    });

    // Update game state with the validated state
    await updateGameState({
      gameId,
      state: validationResult.state,
      lastActionId: newAction.id,
    });

    // Return success response
    res.status(201).json({
      success: true,
      actionId: newAction.id,
      message: 'Action submitted successfully',
      validationResult: newAction.validationResult,
    });
  } catch (err) {
    error('Error processing action:', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current state retrieval endpoint
app.get('/api/games/:gameId/state/current', async (req, res) => {
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

    // If no state exists, create initial tic-tac-toe state
    if (!gameState?.state) {
      await createTicTacToeGameState(gameId);
      const newGameState = await getCurrentGameState(gameId);

      const response = {
        gameId,
        state: newGameState?.state || { message: 'No state recorded yet' },
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

    const response = {
      gameId,
      state: gameState.state,
      lastAction: null, // In a real implementation, this would be the last action
      timestamp: new Date().toISOString(),
      cursor: {
        id: `cursor-${Date.now()}`,
        gameId,
        timestamp: new Date().toISOString(),
        stateHash: 'demo-hash',
        position: 0, // In a real implementation, this would be based on action count
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Self-register as game owner endpoint
app.post('/api/auth/register/owner', async (req, res) => {
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
app.post('/api/auth/register/join', async (req, res) => {
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

// Create new game endpoint (deprecated - use /api/auth/register/owner instead)
app.post('/api/games', async (req, res) => {
  try {
    const { name } = req.body;

    // Generate a unique game ID
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the game in the database
    const game = await createGame({
      id: gameId,
      name: name || `Game ${gameId}`,
      status: 'waiting',
    });

    info(`Created new game: ${game.id}`);

    // Return the game ID
    res.status(201).json({
      success: true,
      gameId: game.id,
      message: 'Game created successfully',
    });
  } catch (err) {
    error('Error creating game:', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  error('Server error:', { stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use('{*splat}', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
server.listen(port, () => {
  info(`Remote State server listening at http://localhost:${port}`);
  info('Endpoints:');
  info('  POST /api/auth/register/owner - Register as game owner (creates new game)');
  info('  POST /api/auth/register/join - Register as joining player (joins existing game)');
  info('  POST /api/games/:gameId/actions - Submit game action');
  info('  GET /api/games/:gameId/state/current - Retrieve current game state');
  info('  GET /health - Health check');
});

export default app;
