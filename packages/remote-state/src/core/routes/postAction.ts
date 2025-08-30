import { Request, Response } from 'express';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { Player } from '../../database/models';
import { DatabaseService } from '../../database';

// Action submission endpoint
export const postAction = <StateType, ActionType>(
  database: DatabaseService<StateType, ActionType>,
  gamePlugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'postAction',
    logLevel: gamePlugin.serverConfiguration?.minimumLogLevel,
  });
  return async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { action, token } = req.body;

      info(`Received action for game ${gameId}:`, { action, hasToken: !!token });

      // Validate request
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      if (!gameId) {
        return res.status(400).json({ error: 'Game ID is required' });
      }

      // Check if game exists
      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: `No game found with id ${gameId}` });
      }

      // Validate player token if provided
      let player: Player | null = null;
      if (token) {
        player = await database.getPlayerByToken(token);
        if (!player) {
          return res.status(401).json({
            error: 'Invalid or expired token',
          });
        }

        // Verify player belongs to this game
        if (player.gameId !== gameId) {
          return res.status(401).json({
            error: 'Invalid or expired token',
          });
        }
      } else {
        // Return error if no token is provided
        return res.status(401).json({
          error: 'Invalid or expired token',
        });
      }

      // Get current game state
      info(`Getting current game state for game: ${gameId}`);
      const { state } = await database.getCurrentGameState<StateType>(gameId);
      info(`Current state:`, state);
      // Use game-specific validation through dedicated module
      const validationResult = gamePlugin.validateAction(state, action as ActionType);
      if (!validationResult.valid) {
        return res.status(400).json({
          error: validationResult.error || 'Invalid action',
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

      const executionResult = gamePlugin.executeAction(
        state,
        actionWithPlayer as ActionType & { playerId: string; timestamp: Date }
      );

      // Record the action in the database
      await database.recordAction({
        gameId,
        playerId: player.id,
        actionType: action.type || 'unknown',
        actionData: action,
        gameState: executionResult.state,
      });

      // Return success response
      res.status(201).json(executionResult.state);
    } catch (err) {
      error('Error processing action:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
