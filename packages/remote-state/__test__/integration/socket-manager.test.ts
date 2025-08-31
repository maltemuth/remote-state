import { SocketIOManager } from '../../src/core/socket';
import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { jest, describe, expect, it, beforeEach } from '@jest/globals';
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

// Mock authenticatePlayer function
const mockAuthenticatePlayer = jest.fn(async () => ({
  player: { id: 'player1', name: 'Player 1' } as any,
  game: { id: 'game1', name: 'Test Game' } as any,
}));

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
  let socketManager: ReturnType<typeof SocketIOManager<unknown, unknown, unknown>>;
  let mockSocketIO: Server;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock socket.io server
    mockSocketIO = new Server();
    (Server as unknown as jest.Mock).mockImplementation(() => mockSocketIO);

    socketManager = SocketIOManager(mockHTTPServer, mockAuthenticatePlayer, mockGamePlugin);
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
      // Access the internal state through the socket manager's functions
      // Since we're using a functional approach, we need to mock the internal state
      // This test will need to be updated to work with the new functional approach

      const updateEvent = {
        gameId: 'test-game',
        stateId: 'state-123',
      };

      const mockStateForPlayer = jest.fn(async () => ({ playerState: 'test' }) as any);
      // Resolve the promise returned by mockStateForPlayer
      mockStateForPlayer.mockResolvedValue({ playerState: 'test' });
      socketManager.broadcastGameStateUpdate(updateEvent, mockStateForPlayer);

      // Should emit to each individual player socket
      expect(mockTo).toHaveBeenCalledTimes(2);
      expect(mockTo).toHaveBeenCalledWith('socket1');
      expect(mockTo).toHaveBeenCalledWith('socket2');
      expect(mockEmit).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenCalledWith(
        'game-state-update',
        Promise.resolve({ playerState: 'test' })
      );
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

      // Access the internal state through the socket manager's functions
      // Since we're using a functional approach, we need to mock the internal state
      // This test will need to be updated to work with the new functional approach
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
