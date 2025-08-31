import { Request, Response } from 'express';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';

// Current state retrieval endpoint
export const getState = <StateType, ActionType, PlayerStateType>(
  database: DatabaseService<StateType, ActionType, PlayerStateType>,
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>
) => {
  const { info, error } = createLogger({
    scope: 'getState',
  });
  return async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const playerId = req.headers['x-player-id'] as string;

      info(
        `Retrieving current state for game ${gameId}${playerId ? ` and player ${playerId}` : ''}`
      );

      // Check if game exists
      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Get current game state from database
      let gameState = await database.getCurrentGameState(gameId);

      // Apply player filtering if playerId is provided and plugin supports it
      if (playerId && gameState && plugin.filterStateForPlayer) {
        const filteredState = await plugin.filterStateForPlayer(
          gameState.state as StateType,
          playerId
        );
        gameState = {
          ...gameState,
          // @ts-ignore - Type conversion for filtered state
          state: filteredState,
        };
      }

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
