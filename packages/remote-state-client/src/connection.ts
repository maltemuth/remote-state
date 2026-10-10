/**
 * The Socket.IO connection to a game: authenticates with the session, passes the
 * game's `state` and `patches` events on as updates, and reports the connection's
 * state. Socket.IO reconnects by itself; every (re)connect starts with a whole view.
 */

import { io } from 'socket.io-client';
import { type Endpoints } from './endpoints.js';
import { type Session } from './session.js';
import { type ConnectionState, type Format, type Patch, type Update } from './types.js';

export interface ConnectionOptions<View> {
  endpoints: Endpoints;
  session: Session;
  format: Format;
  onUpdate: (update: Update<View>) => void;
  onState: (state: ConnectionState) => void;
}

export const connect = <View>({
  endpoints,
  session,
  format,
  onUpdate,
  onState,
}: ConnectionOptions<View>) => {
  const socket = io(endpoints.socketOrigin, {
    path: endpoints.socketPath,
    auth: { gameId: session.gameId, token: session.token },
    query: { format },
  });

  socket.on('connect', () => onState({ status: 'connected' }));
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
  socket.on('state', (event: { sequence: number; state: View }) =>
    onUpdate({ sequence: event.sequence, state: event.state })
  );
  socket.on('patches', (event: { sequence: number; patches: Patch[] }) =>
    onUpdate({ sequence: event.sequence, patches: event.patches })
  );

  return { close: () => void socket.disconnect() };
};
