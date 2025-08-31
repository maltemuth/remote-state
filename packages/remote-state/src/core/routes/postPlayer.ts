import { Request, Response } from 'express';
import { GamePlugin } from '../types';
import { createLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/service';
import { SocketIOManager } from '../socket';

export const postPlayer = <StateType, ActionType, PlayerStateType>(
  database: DatabaseService<StateType, ActionType, PlayerStateType>,
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>,
  socketIOManager?: SocketIOManager<StateType, ActionType, PlayerStateType>
) => {
  const { info, error } = createLogger({
    scope: 'postPlayer',
    logLevel: plugin.serverConfiguration?.minimumLogLevel,
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
      const game = await database.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Create the joining player
      const player = await database.addPlayerToGame(
        { id: gameId },
        { name: playerName, role: 'player' }
      );

      info(`Created joining player: ${player.name} for game ${gameId}`);

      // Notify other players in the game about the new player
      if (socketIOManager) {
        socketIOManager.broadcastToGame(gameId, 'player-joined', {
          playerId: player.id,
          playerName: player.name,
        });
      }

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
