import { Application, Request, Response } from 'express';
import {
  getCurrentGameState,
  getGame,
  recordAction,
  updateGameState,
  validatePlayerToken,
} from '../../database';
import { Sequelize } from 'sequelize';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { Player } from '../../database/models';

// Action submission endpoint
export const postAction = <StateType, ActionType>(
  app: Application,
  database: Sequelize,
  gamePlugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'postAction',
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
      const game = await getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: `No game found with id ${gameId}` });
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
      const currentState = currentStateResult?.state;

      // Use game-specific validation through dedicated module
      const validationResult = gamePlugin.validateAction(
        currentState as StateType,
        action as ActionType
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

      const executionResult = gamePlugin.executeAction(
        currentState as StateType,
        actionWithPlayer as ActionType & { playerId: string; timestamp: Date }
      );

      if (!executionResult.success) {
        return res.status(400).json({
          error: 'Action execution failed',
          code: 'ACTION_FAILED',
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
        gameOver: executionResult.gameOver,
        winner: executionResult.winner,
      });
    } catch (err) {
      error('Error processing action:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
