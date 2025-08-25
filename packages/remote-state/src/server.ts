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
    const { action } = req.body;

    info(`Received action for game ${gameId}:`, { action });

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
    }

    // Create a default player if none exists for this game
    const defaultPlayerId = `player-${Date.now()}`;
    await addPlayerToGame({
      id: defaultPlayerId,
      gameId,
      name: 'Default Player',
      role: 'player',
    });

    // Record the action in the database
    const newAction = await recordAction({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gameId,
      playerId: defaultPlayerId,
      actionType: action.type || 'unknown',
      actionData: action,
      gameState: null, // In a real implementation, this would be the resulting game state
      // cursor is not stored directly in the action but used for validation
      validationResult: { valid: true, message: 'Action accepted' },
    });

    // Update game state
    await updateGameState({
      gameId,
      state: { message: 'Action recorded', lastAction: newAction },
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

    const response = {
      gameId,
      state: gameState?.state || { message: 'No state recorded yet' },
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

// Create new game endpoint
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
  info('  POST /api/games/:gameId/actions - Submit game action');
  info('  GET /api/games/:gameId/state/current - Retrieve current game state');
  info('  GET /health - Health check');
});

export default app;
