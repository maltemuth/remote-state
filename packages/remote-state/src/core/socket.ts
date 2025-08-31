import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger } from '../utils/logger';
import { GamePlugin } from './types';
import { Game, Player } from '../database/models';

export interface SocketIOServerConfig {
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export interface GameStateUpdateEvent {
  gameId: string;
  stateId: string;
}

export interface SocketManager<PlayerStateType> {
  broadcastGameStateUpdate: (
    event: GameStateUpdateEvent,
    stateForPlayer: (player: Pick<Player, 'id'>) => Promise<PlayerStateType>
  ) => void;
  broadcastToGame: (gameId: string, event: string, data: unknown) => void;
  sendToPlayer: (playerId: string, event: string, data: unknown) => void;
}

function createSocketManager<StateType, ActionType, PlayerStateType>(
  httpServer: HTTPServer,
  authenticatePlayer: (
    playerId: string,
    token: string,
    gameId: string
  ) => Promise<{ player: Player; game: Game }>,
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>,
  config: SocketIOServerConfig = {}
): SocketManager<PlayerStateType> {
  const logger = createLogger({
    scope: 'socket-io-manager',
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      ...config.cors,
    },
  });

  const gameRooms: Map<string, Set<string>> = new Map();
  const playerSockets: Map<string, string> = new Map();

  function setupEventHandlers(): void {
    io.on('connection', async (socket: Socket) => {
      logger.info('Client connected:', { socketId: socket.id });

      try {
        // Authenticate player on connection using auth data from handshake
        const authentication = await authenticatePlayer(
          socket.handshake.auth.playerId,
          socket.handshake.auth.token,
          socket.handshake.auth.gameId
        );

        if (!authentication) {
          socket.emit('error', { message: 'Invalid player or game' });
          socket.disconnect();
          return;
        }

        const { player } = authentication;

        // Join the game room
        socket.join(socket.handshake.auth.gameId);

        // Track player in game room
        const gameId = socket.handshake.auth.gameId;
        if (!gameRooms.has(gameId)) {
          gameRooms.set(gameId, new Set());
        }
        gameRooms.get(gameId).add(socket.id);

        // Track player socket mapping
        playerSockets.set(player.id, socket.id);

        // Notify other players in the game
        socket.to(gameId).emit('player-joined', {
          playerId: player.id,
          playerName: player.name,
        });

        logger.info(`Player ${player.id} successfully connected to game ${gameId}`);

        // Handle leaving a game room
        socket.on('leave-game', (gameId: string) => {
          logger.info(`Client leaving game ${gameId}`, { socketId: socket.id });
          socket.leave(gameId);

          // Remove from game room tracking
          if (gameRooms.has(gameId)) {
            gameRooms.get(gameId).delete(socket.id);
            if (gameRooms.get(gameId).size === 0) {
              gameRooms.delete(gameId);
            }
          }

          // Notify other players
          socket.to(gameId).emit('player-left', { socketId: socket.id });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          logger.info('Client disconnected:', { socketId: socket.id });

          // Clean up room memberships
          for (const [gameId, sockets] of gameRooms.entries()) {
            if (sockets.has(socket.id)) {
              sockets.delete(socket.id);
              if (sockets.size === 0) {
                gameRooms.delete(gameId);
              }
              socket.to(gameId).emit('player-left', { socketId: socket.id });
            }
          }

          // Clean up player socket mapping
          for (const [playerId, socketId] of playerSockets.entries()) {
            if (socketId === socket.id) {
              playerSockets.delete(playerId);
              break;
            }
          }
        });
      } catch (error) {
        logger.error('Error during connection:', error);
        socket.emit('error', { message: 'Failed to authenticate' });
        socket.disconnect();
      }
    });
  }

  function getConnectedPlayersInGame(gameId: string): string[] {
    const players: string[] = [];

    // Get all socket IDs in the game room
    const socketIds = gameRooms.get(gameId);
    if (!socketIds) {
      return players;
    }

    // Find which player IDs correspond to these socket IDs
    for (const [playerId, socketId] of playerSockets.entries()) {
      if (socketIds.has(socketId)) {
        players.push(playerId);
      }
    }

    return players;
  }

  function broadcastGameStateUpdate(
    event: GameStateUpdateEvent,
    stateForPlayer: (player: Pick<Player, 'id'>) => Promise<PlayerStateType>
  ): void {
    const { gameId, stateId } = event;

    logger.info(`Broadcasting state update for game ${gameId}`, {
      stateId,
    });

    // Get all connected players in the game room
    const connectedPlayers = getConnectedPlayersInGame(gameId);

    // Send state ID to each connected player individually
    connectedPlayers.forEach(playerId => {
      sendToPlayer(playerId, 'game-state-update', stateForPlayer({ id: playerId }));
    });
  }

  function broadcastToGame(gameId: string, event: string, data: unknown): void {
    io.to(gameId).emit(event, data);
  }

  function sendToPlayer(playerId: string, event: string, data: unknown): void {
    const socketId = playerSockets.get(playerId);
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  }

  setupEventHandlers();

  return {
    broadcastGameStateUpdate,
    broadcastToGame,
    sendToPlayer,
  };
}

// Export for backward compatibility
export { createSocketManager as SocketIOManager };
export { createSocketManager };
