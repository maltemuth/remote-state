/**
 * The Socket.IO server. Clients connect with `auth: { spaceId, token }` and an
 * optional `format` query parameter (`state` by default; unknown values are
 * refused, 0008). On connect, a client gets its whole view, then updates (0031).
 */

import { type CorsOptions } from 'cors';
import { type Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { type EngineContext } from '../engine/context.js';
import { type SocketSettings } from '../server/options.js';
import { currentView } from '../engine/currentView.js';
import { authenticate } from '../engine/tokens.js';
import { type Format, formats, type ServerToClientEvents, type SocketData } from './events.js';

export type SocketServer = Server<never, ServerToClientEvents, never, SocketData>;

export interface SocketOptions extends SocketSettings {
  cors: CorsOptions;
}

const parseFormat = (value: unknown): Format | null =>
  value === undefined ? 'state' : (formats.find(format => format === value) ?? null);

export const createSocketServer = (
  httpServer: HTTPServer,
  context: Omit<EngineContext, 'publisher'>,
  { cors, path, parser, perMessageDeflate }: SocketOptions
): SocketServer => {
  const { info, error } = context.logger;
  const io: SocketServer = new Server(httpServer, {
    cors,
    path,
    ...(parser ? { parser } : {}),
    ...(perMessageDeflate !== undefined ? { perMessageDeflate } : {}),
    // Leave upgrade requests for other paths to the host, such as another space's socket
    destroyUpgrade: false,
  });

  io.use(async (socket, next) => {
    const { spaceId, token } = socket.handshake.auth ?? {};
    const format = parseFormat(socket.handshake.query.format);
    if (!format) return next(new Error(`Unknown format; use one of ${formats.join(', ')}`));
    try {
      const memberId = await authenticate(context.orm, token, spaceId);
      if (!memberId) return next(new Error('Invalid token or space'));
      socket.data = { spaceId, memberId, format };
      next();
    } catch (err) {
      error('Socket authentication failed', err);
      next(new Error('Failed to authenticate'));
    }
  });

  io.on('connection', socket => {
    const { spaceId, memberId } = socket.data;
    info(`Member ${memberId} connected to space ${spaceId}`);
    // Under the lock, so no update is sent between the view and joining the room
    void context
      .withSpaceLock(spaceId, async () => {
        const view = await currentView(context, spaceId, memberId);
        socket.emit('state', { spaceId, ...view });
        await socket.join(spaceId);
      })
      .catch(err => {
        error(`Failed to send the current state to member ${memberId}`, err);
        socket.disconnect(true);
      });
  });

  return io;
};

/**
 * Close every client's connection and stop accepting new ones, leaving the HTTP
 * server running. Connections are closed underneath Socket.IO, so clients see a lost
 * connection and reconnect by themselves, for example to the restarted server; a
 * Socket.IO disconnect would tell them not to.
 */
export const closeSocketServer = (io: SocketServer) => {
  io.engine.close();
};
