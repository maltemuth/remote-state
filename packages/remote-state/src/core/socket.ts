import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger, Logger } from '../utils/logger';
import { GamePlugin } from './types';
import { DatabaseService } from '../database/service';

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

export class SocketIOManager<StateType, ActionType> {
  private io: SocketIOServer;
  private logger: Logger;
  public gameRooms: Map<string, Set<string>> = new Map();
  public playerSockets: Map<string, string> = new Map(); // playerId -> socketId

  constructor(
    httpServer: HTTPServer,
    private database: DatabaseService<StateType, ActionType>,
    private plugin: GamePlugin<StateType, ActionType>,
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
    this.io.on('connection', (socket: Socket) => {
      this.logger.info('Client connected:', { socketId: socket.id });

      // Handle joining a game room
      socket.on('join-game', async (gameId: string, playerId: string) => {
        try {
          this.logger.info(`Player ${playerId} joining game ${gameId}`);

          // Verify the player exists and belongs to the game
          const player = await this.database.getPlayerByToken(playerId);
          if (!player || player.gameId !== gameId) {
            socket.emit('error', { message: 'Invalid player or game' });
            return;
          }

          // Join the game room
          socket.join(gameId);

          // Track player in game room
          if (!this.gameRooms.has(gameId)) {
            this.gameRooms.set(gameId, new Set());
          }
          this.gameRooms.get(gameId).add(socket.id);

          // Track player socket mapping
          this.playerSockets.set(playerId, socket.id);

          // Notify other players in the game
          socket.to(gameId).emit('player-joined', {
            playerId: player.id,
            playerName: player.name,
          });

          this.logger.info(`Player ${playerId} successfully joined game ${gameId}`);
        } catch (error) {
          this.logger.error('Error joining game:', error);
          socket.emit('error', { message: 'Failed to join game' });
        }
      });

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
    });
  }

  /**
   * Broadcast game state update to all players in the game room
   * Each player receives the state ID
   */
  public broadcastGameStateUpdate(event: GameStateUpdateEvent): void {
    const { gameId, stateId } = event;

    this.logger.info(`Broadcasting state update for game ${gameId}`, {
      stateId,
    });

    // Get all connected players in the game room
    const connectedPlayers = this.getConnectedPlayersInGame(gameId);

    // Send state ID to each connected player individually
    connectedPlayers.forEach(playerId => {
      this.sendToPlayer(playerId, 'game-state-update', {
        gameId,
        stateId,
      });
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

  /**
   * Get the number of connected players in a game
   */
  public getGamePlayerCount(gameId: string): number {
    return this.gameRooms.get(gameId)?.size || 0;
  }

  /**
   * Get all socket.io server instance for custom event handling
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}
