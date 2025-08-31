import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger, Logger } from '../utils/logger';
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

export class SocketIOManager<StateType, ActionType, PlayerStateType> {
  private io: SocketIOServer;
  private logger: Logger;
  public gameRooms: Map<string, Set<string>> = new Map();
  public playerSockets: Map<string, string> = new Map(); // playerId -> socketId

  constructor(
    httpServer: HTTPServer,
    private authenticatePlayer: (
      playerId: string,
      token: string,
      gameId: string
    ) => Promise<{ player: Player; game: Game }>,
    private plugin: GamePlugin<StateType, ActionType, PlayerStateType>,
    config: SocketIOServerConfig = {}
  ) {
    this.logger = createLogger({
      scope: 'socket-io-manager',
    });

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        ...config.cors,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: Socket) => {
      this.logger.info('Client connected:', { socketId: socket.id });

      try {
        // Authenticate player on connection using auth data from handshake
        const authentication = await this.authenticatePlayer(
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
        if (!this.gameRooms.has(gameId)) {
          this.gameRooms.set(gameId, new Set());
        }
        this.gameRooms.get(gameId).add(socket.id);

        // Track player socket mapping
        this.playerSockets.set(player.id, socket.id);

        // Notify other players in the game
        socket.to(gameId).emit('player-joined', {
          playerId: player.id,
          playerName: player.name,
        });

        this.logger.info(`Player ${player.id} successfully connected to game ${gameId}`);

        // Handle leaving a game room
        socket.on('leave-game', (gameId: string) => {
          this.logger.info(`Client leaving game ${gameId}`, { socketId: socket.id });
          socket.leave(gameId);

          // Remove from game room tracking
          if (this.gameRooms.has(gameId)) {
            this.gameRooms.get(gameId).delete(socket.id);
            if (this.gameRooms.get(gameId).size === 0) {
              this.gameRooms.delete(gameId);
            }
          }

          // Notify other players
          socket.to(gameId).emit('player-left', { socketId: socket.id });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          this.logger.info('Client disconnected:', { socketId: socket.id });

          // Clean up room memberships
          for (const [gameId, sockets] of this.gameRooms.entries()) {
            if (sockets.has(socket.id)) {
              sockets.delete(socket.id);
              if (sockets.size === 0) {
                this.gameRooms.delete(gameId);
              }
              socket.to(gameId).emit('player-left', { socketId: socket.id });
            }
          }

          // Clean up player socket mapping
          for (const [playerId, socketId] of this.playerSockets.entries()) {
            if (socketId === socket.id) {
              this.playerSockets.delete(playerId);
              break;
            }
          }
        });
      } catch (error) {
        this.logger.error('Error during connection:', error);
        socket.emit('error', { message: 'Failed to authenticate' });
        socket.disconnect();
      }
    });
  }

  /**
   * Broadcast game state update to all players in the game room
   * Each player receives the state ID
   */
  public broadcastGameStateUpdate(
    event: GameStateUpdateEvent,
    stateForPlayer: (player: Pick<Player, 'id'>) => Promise<PlayerStateType>
  ): void {
    const { gameId, stateId } = event;

    this.logger.info(`Broadcasting state update for game ${gameId}`, {
      stateId,
    });

    // Get all connected players in the game room
    const connectedPlayers = this.getConnectedPlayersInGame(gameId);

    // Send state ID to each connected player individually
    connectedPlayers.forEach(playerId => {
      this.sendToPlayer(playerId, 'game-state-update', stateForPlayer({ id: playerId }));
    });
  }

  /**
   * Get all connected player IDs in a specific game room
   */
  private getConnectedPlayersInGame(gameId: string): string[] {
    const players: string[] = [];

    // Get all socket IDs in the game room
    const socketIds = this.gameRooms.get(gameId);
    if (!socketIds) {
      return players;
    }

    // Find which player IDs correspond to these socket IDs
    for (const [playerId, socketId] of this.playerSockets.entries()) {
      if (socketIds.has(socketId)) {
        players.push(playerId);
      }
    }

    return players;
  }

  /**
   * Broadcast a custom event to all players in a specific game
   */
  public broadcastToGame(gameId: string, event: string, data: unknown): void {
    this.io.to(gameId).emit(event, data);
  }

  /**
   * Send a message to a specific player
   */
  public sendToPlayer(playerId: string, event: string, data: unknown): void {
    const socketId = this.playerSockets.get(playerId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }
}
