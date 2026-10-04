/**
 * The Socket.IO server. Clients connect with `auth: { gameId, token }` and an
 * optional `format` query parameter (`state` by default; unknown values are
 * refused, 0008). On connect, a client gets its whole view, then updates (0031).
 */

import { type Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { type EngineContext } from '../engine/context.js';
import { currentView } from '../engine/currentView.js';
import { authenticate } from '../engine/tokens.js';
import { type SocketIOServerConfiguration } from '../server/configuration.js';
import { createLogger } from '../utils/logger.js';
import { type Format, formats, type ServerToClientEvents, type SocketData } from './events.js';

const parseFormat = (value: unknown): Format | null =>
  value === undefined ? 'state' : (formats.find(format => format === value) ?? null);

export const createSocketServer = (
  httpServer: HTTPServer,
  context: Omit<EngineContext, 'publisher'>,
  config: Omit<SocketIOServerConfiguration, 'enabled'> = {}
) => {
  const { info, error } = createLogger({ scope: 'socket' });
  const io = new Server<never, ServerToClientEvents, never, SocketData>(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'], ...config.cors },
  });

  io.use(async (socket, next) => {
    const { gameId, token } = socket.handshake.auth ?? {};
    const format = parseFormat(socket.handshake.query.format);
    if (!format) return next(new Error(`Unknown format; use one of ${formats.join(', ')}`));
    try {
      const player = await authenticate(context.orm, token, gameId);
      if (!player) return next(new Error('Invalid token or game'));
      socket.data = { gameId, playerId: player.id, format };
      next();
    } catch (err) {
      error('Socket authentication failed:', err);
      next(new Error('Failed to authenticate'));
    }
  });

  io.on('connection', socket => {
    const { gameId, playerId } = socket.data;
    info(`Player ${playerId} connected to game ${gameId}`, { socketId: socket.id });
    // Under the lock, so no update is sent between the view and joining the room
    void context
      .withGameLock(gameId, async () => {
        const view = await currentView(context, gameId, playerId);
        socket.emit('state', { gameId, ...view });
        await socket.join(gameId);
      })
      .catch(err => {
        error(`Failed to send the current state to player ${playerId}`, err);
        socket.disconnect(true);
      });
  });

  return io;
};
