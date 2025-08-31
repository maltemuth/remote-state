import { Request, Response } from 'express';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';

// Current state retrieval endpoint
export const getState = <StateType, ActionType>(
  database: DatabaseService<StateType, ActionType>,
  _plugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'getState',
  });
  return async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;

      info(`Retrieving current state for game ${gameId}`);

      // Check if game exists
      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Get current game state from database
      const gameState = await database.getCurrentGameState(gameId);

      const response = {
        gameId,
        state: gameState?.state || null,
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
  };
};
