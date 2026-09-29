import { Request, Response } from 'express';
import { GamePlugin, stateForPlayer } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';
import { SocketManager } from '../socket';
import { GameLock } from '../gameLock';
import { tokenFromRequest } from './auth';

// Action submission endpoint
export const postAction = <StateType, ActionType, PlayerStateType>(
  database: DatabaseService<StateType, ActionType>,
  gamePlugin: GamePlugin<StateType, ActionType, PlayerStateType>,
  withGameLock: GameLock,
  socketIOManager?: SocketManager<PlayerStateType>
) => {
  const { debug, error } = createLogger({
    scope: 'postAction',
  });
  return async (req: Request<{ gameId: string }>, res: Response) => {
    try {
      const { gameId } = req.params;
      const { action } = req.body;

      debug(`Received action for game ${gameId}:`, { action });

      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }

      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: `No game found with id ${gameId}` });
      }

      const player = await database.authenticatePlayer(tokenFromRequest(req), gameId);
      if (!player) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Read, validate, execute and record without another action on this game interleaving
      const outcome = await withGameLock(gameId, async () => {
        const current = await database.getCurrentGameState(gameId);
        const validationResult = await gamePlugin.validateAction(
          current.state,
          action as ActionType,
          player.id
        );
        if (validationResult !== true) {
          return { rejected: validationResult } as const;
        }

        await database.touchPlayer(player.id);

        const actionWithPlayer = {
          ...action,
          playerId: player.id,
          timestamp: new Date(),
        };
        const newState = await gamePlugin.executeAction(
          current.state,
          actionWithPlayer as ActionType,
          player.id
        );

        const stateId = await database.recordAction({
          gameId,
          playerId: player.id,
          actionType: action.type || 'unknown',
          actionData: action,
          gameState: newState,
        });

        return { newState, stateId, sequence: current.sequence + 1 } as const;
      });

      if ('rejected' in outcome) {
        return res.status(400).json({ error: outcome.rejected });
      }

      res.status(201).json(await stateForPlayer(gamePlugin, outcome.newState, player.id));

      if (socketIOManager) {
        await socketIOManager.broadcastGameStateUpdate(
          { gameId, stateId: outcome.stateId, sequence: outcome.sequence },
          playerId => stateForPlayer(gamePlugin, outcome.newState, playerId)
        );
      }
    } catch (err) {
      error('Error processing action:', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};
