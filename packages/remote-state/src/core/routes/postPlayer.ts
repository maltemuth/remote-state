import { Application, Request, Response } from 'express';
import { Sequelize } from 'sequelize';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { createJoiningPlayer, getGame } from '../../database';

export const postPlayer = <StateType, ActionType>(
  _app: Application,
  _database: Sequelize,
  _plugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'postPlayer',
  });
  return async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { playerName } = req.body;

      // Validate request
      if (!playerName || !gameId) {
        return res.status(400).json({ error: 'Player name and game ID are required' });
      }

      // Check if game exists
      const game = await getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
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
  };
};
