/**
 * Sends a recorded transition to every connected player of the game, in the format
 * each chose. Views and patches are computed here, only for the audiences of the
 * sockets connected, and once per audience (0056). A player who changed audience
 * gets a diff computed across audiences (decision 0035).
 */

import { type RemoteSocket, type Server } from 'socket.io';
import { type Publisher, type TransitionOutcome } from '../engine/context.js';
import { diff, type Patch } from '../patches/diff.js';
import { type AnyGamePlugin } from '../plugin/types.js';
import { viewFor } from '../plugin/views.js';
import { type Logger } from '../logging/logger.js';
import { type ServerToClientEvents, type SocketData } from './events.js';

type GameSocket = RemoteSocket<ServerToClientEvents, SocketData>;

/** Computes each value once per key, the first time it's asked for */
const memoized = <T>(compute: (key: string) => Promise<T>) => {
  const values = new Map<string, Promise<T>>();
  return (key: string) => {
    if (!values.has(key)) values.set(key, compute(key));
    return values.get(key)!;
  };
};

/** Views and patches of one transition, per audience, computed when first needed */
const viewsOf = (plugin: AnyGamePlugin, outcome: TransitionOutcome) => {
  const viewBefore = memoized(audience => viewFor(plugin, outcome.previousState, audience));
  const viewAfter = memoized(audience => viewFor(plugin, outcome.state, audience));
  const patches = memoized<Patch[]>(async key => {
    const [before, after] = JSON.parse(key) as [string, string];
    return diff(await viewBefore(before), await viewAfter(after));
  });
  return {
    viewAfter,
    /** From the view in the audience before to the view in the audience after */
    patches: (before: string, after: string) => patches(JSON.stringify([before, after])),
  };
};

export const createPublisher = (
  io: Server<never, ServerToClientEvents>,
  plugin: AnyGamePlugin,
  { error }: Logger
): Publisher => {
  const send = async (
    socket: GameSocket,
    outcome: TransitionOutcome,
    views: ReturnType<typeof viewsOf>
  ) => {
    const { gameId, sequence } = outcome;
    const { playerId, format } = socket.data;
    const audience = outcome.audiencesAfter.get(playerId);
    if (audience === undefined) return;
    if (format === 'state') {
      socket.emit('state', { gameId, sequence, state: await views.viewAfter(audience) });
    } else {
      const before = outcome.audiencesBefore.get(playerId) ?? audience;
      socket.emit('patches', { gameId, sequence, patches: await views.patches(before, audience) });
    }
  };

  return {
    publish: async outcome => {
      const sockets = (await io.in(outcome.gameId).fetchSockets()) as GameSocket[];
      const views = viewsOf(plugin, outcome);
      await Promise.all(
        sockets.map(socket =>
          send(socket, outcome, views).catch(err =>
            error(`Failed to send update to player ${socket.data.playerId}`, err)
          )
        )
      );
    },
  };
};
