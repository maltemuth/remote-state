import { DefaultEventsMap, Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger } from '../utils/logger';
import { SocketIOServerConfiguration } from './types';
import { Player } from '../database/models';

export interface GameStateUpdateEvent<PlayerStateType> {
  gameId: string;
  stateId: string;
  sequence: number;
  state: PlayerStateType;
}

export interface SocketManager<PlayerStateType> {
  /** Send each connected player of the game their own view of a new state */
  broadcastGameStateUpdate: (
    update: { gameId: string; stateId: string; sequence: number },
    stateForPlayer: (playerId: string) => Promise<PlayerStateType>
  ) => Promise<void>;
  broadcastToGame: (gameId: string, event: string, data: unknown) => void;
  sendToPlayer: (playerId: string, event: string, data: unknown) => void;
  close: () => Promise<void>;
}

interface SocketData {
  playerId: string;
  playerName: string;
  gameId: string;
}

const playerRoom = (playerId: string) => `player:${playerId}`;

/**
 * Clients connect with `auth: { gameId, token }` (and optionally `playerId`, which must
 * match the token). Rejected connections receive a `connect_error`.
 */
export function createSocketManager<PlayerStateType>(
  httpServer: HTTPServer,
  authenticatePlayer: (token: string, gameId: string) => Promise<Player | null>,
  config: Omit<SocketIOServerConfiguration, 'enabled'> = {}
): SocketManager<PlayerStateType> {
  const logger = createLogger({
    scope: 'socket-io-manager',
  });

  const io = new SocketIOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(
    httpServer,
    {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        ...config.cors,
      },
    }
  );

  io.use(async (socket, next) => {
    const { gameId, token, playerId } = socket.handshake.auth ?? {};
    try {
      const player = await authenticatePlayer(token, gameId);
      if (!player || (playerId !== undefined && playerId !== player.id)) {
        return next(new Error('Invalid player or game'));
      }
      socket.data = { playerId: player.id, playerName: player.name, gameId };
      next();
    } catch (error) {
      logger.error('Error during socket authentication:', error);
      next(new Error('Failed to authenticate'));
    }
  });

  io.on('connection', socket => {
    const { playerId, playerName, gameId } = socket.data;
    socket.join([gameId, playerRoom(playerId)]);
    socket.to(gameId).emit('player-joined', { playerId, playerName });
    logger.info(`Player ${playerId} connected to game ${gameId}`, { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info(`Player ${playerId} disconnected from game ${gameId}`, { socketId: socket.id });
      socket.to(gameId).emit('player-left', { playerId });
    });
  });

  const broadcastGameStateUpdate: SocketManager<PlayerStateType>['broadcastGameStateUpdate'] =
    async ({ gameId, stateId, sequence }, stateForPlayer) => {
      logger.info(`Broadcasting state update for game ${gameId}`, { stateId, sequence });
      const sockets = await io.in(gameId).fetchSockets();
      await Promise.all(
        sockets.map(async socket => {
          try {
            const event: GameStateUpdateEvent<PlayerStateType> = {
              gameId,
              stateId,
              sequence,
              state: await stateForPlayer(socket.data.playerId),
            };
            socket.emit('game-state-update', event);
          } catch (error) {
            logger.error(`Failed to send state update to player ${socket.data.playerId}`, error);
          }
        })
      );
    };

  const broadcastToGame = (gameId: string, event: string, data: unknown): void => {
    io.to(gameId).emit(event, data);
  };

  const sendToPlayer = (playerId: string, event: string, data: unknown): void => {
    io.to(playerRoom(playerId)).emit(event, data);
  };

  const close = () =>
    new Promise<void>(resolve => {
      io.close(() => resolve());
    });

  return {
    broadcastGameStateUpdate,
    broadcastToGame,
    sendToPlayer,
    close,
  };
}
