import { Application, Request, Response } from 'express';
import { Sequelize } from 'sequelize';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { createGame, createGameOwner } from '../../database';

export const postGame = <StateType, ActionType>(
  _app: Application,
  _database: Sequelize,
  _plugin: GamePlugin<StateType, ActionType>
) => {
  const { info, error } = createLogger({
    scope: 'postGame',
  });

  return async (req: Request, res: Response) => {
    try {
      const { playerName, gameName } = req.body;

      // Validate request
      if (!playerName || !gameName) {
        return res.status(400).json({ error: 'Player name and game name are required' });
      }

      // Generate a unique game ID
      const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the game in the database
      const game = await createGame({
        id: gameId,
        name: gameName,
      });

      // Create the game owner
      const owner = await createGameOwner(gameId, playerName);

      info(`Created new game with owner: ${game.id} - ${owner.name}`);

      // Return the game ID and owner token
      res.status(201).json({
        success: true,
        gameId: game.id,
        playerId: owner.id,
        token: owner.token,
        message: 'Game created and owner registered successfully',
      });
    } catch (err) {
      error('Error registering game owner:', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
