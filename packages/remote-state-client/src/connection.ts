/**
 * The Socket.IO connection to a game: authenticates with the session, passes the
 * game's `state` and `patches` events on as updates, and reports the connection's
 * state. Socket.IO reconnects by itself; every (re)connect starts with a whole view,
 * marked as a reset, since a restarted server may have gone back to an earlier state.
 */

import { io, type ManagerOptions } from 'socket.io-client';
import { type Endpoints } from './endpoints.js';
import { type Session } from './session.js';
import { type ConnectionState, type Format, type Patch, type Update } from './types.js';

export interface ConnectionOptions<View> {
  endpoints: Endpoints;
  session: Session;
  format: Format;
  onUpdate: (update: Update<View>) => void;
  onState: (state: ConnectionState) => void;
  /** Socket.IO's parser; must be the server's */
  parser?: ManagerOptions['parser'];
}

export const connect = <View>({
  endpoints,
  session,
  format,
  onUpdate,
  onState,
  parser,
}: ConnectionOptions<View>) => {
  const socket = io(endpoints.socketOrigin, {
    path: endpoints.socketPath,
    auth: { gameId: session.gameId, token: session.token },
    query: { format },
    ...(parser ? { parser } : {}),
  });

  // The first view after each (re)connect replaces whatever the client holds
  let connected = false;
  socket.on('connect', () => {
    connected = true;
    onState({ status: 'connected' });
  });
  socket.on('disconnect', reason => onState({ status: 'disconnected', reason }));
  socket.on('connect_error', error =>
    onState(
      // Inactive after a refusal by the server, which Socket.IO doesn't retry
      socket.active
        ? { status: 'connecting', error: error.message }
        : { status: 'refused', error: error.message }
    )
  );
  // The socket is authenticated for this one game, so every event is about it
  socket.on('state', (event: { sequence: number; state: View }) => {
    onUpdate({ sequence: event.sequence, state: event.state, reset: connected });
    connected = false;
  });
  socket.on('patches', (event: { sequence: number; patches: Patch[]; checksum?: number }) =>
    onUpdate({ sequence: event.sequence, patches: event.patches, checksum: event.checksum })
  );

  return { close: () => void socket.disconnect() };
};
