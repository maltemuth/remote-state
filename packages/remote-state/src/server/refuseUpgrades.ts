/**
 * Refuses WebSocket upgrade requests that nothing on the standalone server
 * handles. The socket leaves upgrades for other paths alone, so that embedded
 * instances can share a server (0038); without this, such a request would stay
 * open until the client gave up. Upgrades are left to the host as soon as it
 * adds an `upgrade` listener of its own.
 */

import { type Server as HTTPServer } from 'http';

export const refuseUnhandledUpgrades = (server: HTTPServer, socketPath: string | null) => {
  // The same prefix the socket matches requests against
  const prefix = socketPath === null ? null : `${socketPath.replace(/\/$/, '')}/`;
  // Ours, and the socket's if there is one
  const ownListeners = server.listenerCount('upgrade') + 1;
  server.on('upgrade', (req, socket) => {
    if (server.listenerCount('upgrade') > ownListeners) return;
    if (prefix !== null && req.url?.startsWith(prefix)) return;
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
};
