import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const port = 3000;

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for demonstration (will be replaced with database later)
let gameState: any = {
  gameId: 'demo-game',
  players: [],
  state: {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
    status: 'waiting',
  },
  actions: [],
};

// Action submission endpoint
app.post('/api/games/:gameId/actions', (req, res) => {
  try {
    const { gameId } = req.params;
    const { action, cursor } = req.body;

    console.log(`Received action for game ${gameId}:`, action);

    // Validate request
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Stub: In a real implementation, this would:
    // 1. Validate the action using game plugin
    // 2. Apply the action to the game state
    // 3. Generate a new cursor
    // 4. Create state deltas
    // 5. Broadcast updates via WebSocket
    // 6. Record action, cursor, and deltas to database

    const newAction = {
      id: `action-${Date.now()}`,
      gameId,
      action,
      cursor: cursor || null,
      timestamp: new Date().toISOString(),
      validationResult: { valid: true, message: 'Action accepted' },
    };

    // Store the action
    gameState.actions.push(newAction);

    // Return success response
    res.status(201).json({
      success: true,
      actionId: newAction.id,
      message: 'Action submitted successfully',
      validationResult: newAction.validationResult,
    });
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current state retrieval endpoint
app.get('/api/games/:gameId/state/current', (req, res) => {
  try {
    const { gameId } = req.params;

    console.log(`Retrieving current state for game ${gameId}`);

    // Stub: In a real implementation, this would:
    // 1. Query the database for the latest game state
    // 2. Apply any pending actions
    // 3. Filter the state based on player permissions
    // 4. Return the filtered state

    if (gameId !== gameState.gameId) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const response = {
      gameId,
      state: gameState.state,
      lastAction: gameState.actions[gameState.actions.length - 1] || null,
      timestamp: new Date().toISOString(),
      cursor: {
        id: `cursor-${Date.now()}`,
        gameId,
        timestamp: new Date().toISOString(),
        stateHash: 'demo-hash',
        position: gameState.actions.length,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error retrieving state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
server.listen(port, () => {
  console.log(`Remote State server listening at http://localhost:${port}`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/games/:gameId/actions - Submit game action`);
  console.log(`  GET /api/games/:gameId/state/current - Retrieve current game state`);
  console.log(`  GET /health - Health check`);
});

export default app;
