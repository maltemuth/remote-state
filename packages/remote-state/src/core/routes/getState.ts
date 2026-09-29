import { Request, Response } from 'express';
import { GamePlugin, stateForPlayer } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';
import { tokenFromRequest } from './auth';

// Current state retrieval endpoint, filtered for the authenticated player
export const getState = <StateType, ActionType, PlayerStateType>(
  database: DatabaseService<StateType, ActionType>,
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>
) => {
  const { info, error } = createLogger({
    scope: 'getState',
  });
  return async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;

      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const player = await database.authenticatePlayer(tokenFromRequest(req), gameId);
      if (!player) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      info(`Retrieving current state for game ${gameId} and player ${player.id}`);

      const current = await database.getCurrentGameState(gameId);
      if (!current) {
        return res.status(404).json({ error: 'Game has no state' });
      }

      res.json({
        gameId,
        stateId: current.stateId,
        sequence: current.sequence,
        state: await stateForPlayer(plugin, current.state, player.id),
        timestamp: current.timestamp.toISOString(),
      });
    } catch (err) {
      error('Error retrieving state:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
