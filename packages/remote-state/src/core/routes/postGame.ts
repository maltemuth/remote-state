import { Request, Response } from 'express';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';

export const postGame = <StateType, ActionType>(
  database: DatabaseService<StateType, ActionType>,
  plugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'postGame',
    logLevel: plugin.serverConfiguration?.minimumLogLevel,
  });

  return async (req: Request, res: Response) => {
    try {
      const { playerName, gameName } = req.body;

      // Validate request
      if (!playerName || !gameName) {
        return res.status(400).json({ error: 'Player name and game name are required' });
      }

      // Create the game in the database
      const { game, admin } = await database.createGameWithOwnerAndInitialState(
        {
          name: gameName,
        },
        { name: playerName },
        await plugin.getInitialState()
      );

      info(`Created new game with owner: ${game.id} - ${admin.name}`);

      // Return the game ID and owner token
      res.status(201).json({
        gameId: game.id,
        token: admin.token,
        playerId: admin.id,
      });
    } catch (err) {
      error('Error registering game owner:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500);
    }
  };
};
