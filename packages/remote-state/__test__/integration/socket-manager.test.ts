import { SocketIOManager } from '../../src/core/socket';
import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { DatabaseService } from '../../src/database/service';
import { GamePlugin } from '../../src/core/types';
import { LogLevel } from '../../src';
import { RemoteStateServerConfiguration } from '../../src/core/server';

// Mock socket.io
jest.mock('socket.io');

// Mock HTTP server
const mockHTTPServer = {
  on: jest.fn(),
  emit: jest.fn(),
} as unknown as HTTPServer;

// Mock database service with all required methods
const mockDatabaseService = {
  getGame: jest.fn(),
  getPlayerByToken: jest.fn(),
  addPlayerToGame: jest.fn(),
  recordAction: jest.fn(),
  getCurrentGameState: jest.fn(),
  createGameWithOwnerAndInitialState: jest.fn(),
} as Partial<DatabaseService<unknown, unknown, unknown>>;

// Mock game plugin
const mockGamePlugin = {
  getInitialState: jest.fn(),
  validateAction: jest.fn(),
  executeAction: jest.fn(),
  serverConfiguration: {
    minimumLogLevel: LogLevel.warn,
  } as RemoteStateServerConfiguration,
} as GamePlugin<unknown, unknown, unknown>;

describe('SocketIOManager', () => {
  let socketManager: SocketIOManager<unknown, unknown, unknown>;
  let mockSocketIO: Server;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock socket.io server
    mockSocketIO = new Server();
    (Server as unknown as jest.Mock).mockImplementation(() => mockSocketIO);

    socketManager = new SocketIOManager(
      mockHTTPServer,
      mockDatabaseService as unknown as DatabaseService<unknown, unknown, unknown>,
      mockGamePlugin
    );
  });

  describe('constructor', () => {
    it('should create socket.io server with correct configuration', () => {
      expect(Server).toHaveBeenCalledWith(mockHTTPServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });
    });

    it('should set up event handlers', () => {
      expect(mockSocketIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('broadcastGameStateUpdate', () => {
    it('should send game state update to all connected players in game room', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      mockSocketIO.to = mockTo as any;

      // Mock player sockets
      // @ts-ignore - Accessing private property for testing
      socketManager.playerSockets.set('player1', 'socket1');
      // @ts-ignore - Accessing private property for testing
      socketManager.playerSockets.set('player2', 'socket2');

      // Mock game room with connected players
      // @ts-ignore - Accessing private property for testing
      socketManager.gameRooms.set('test-game', new Set(['socket1', 'socket2']));

      const updateEvent = {
        gameId: 'test-game',
        stateId: 'state-123',
      };

      socketManager.broadcastGameStateUpdate(updateEvent);

      // Should emit to each individual player socket
      expect(mockTo).toHaveBeenCalledTimes(2);
      expect(mockTo).toHaveBeenCalledWith('socket1');
      expect(mockTo).toHaveBeenCalledWith('socket2');
      expect(mockEmit).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenCalledWith('game-state-update', updateEvent);
    });
  });

  describe('broadcastToGame', () => {
    it('should broadcast custom event to all clients in game room', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      mockSocketIO.to = mockTo as any;

      socketManager.broadcastToGame('test-game', 'custom-event', { data: 'test' });

      expect(mockTo).toHaveBeenCalledWith('test-game');
      expect(mockEmit).toHaveBeenCalledWith('custom-event', { data: 'test' });
    });
  });

  describe('sendToPlayer', () => {
    it('should send message to specific player socket', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      mockSocketIO.to = mockTo as any;

      // @ts-ignore - Accessing private property for testing
      socketManager.playerSockets.set('player1', 'socket123');
      socketManager.sendToPlayer('player1', 'private-event', { data: 'secret' });

      expect(mockTo).toHaveBeenCalledWith('socket123');
      expect(mockEmit).toHaveBeenCalledWith('private-event', { data: 'secret' });
    });

    it('should not send message if player socket not found', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      mockSocketIO.to = mockTo as any;

      socketManager.sendToPlayer('unknown-player', 'private-event', { data: 'secret' });

      expect(mockTo).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
