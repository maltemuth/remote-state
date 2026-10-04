/**
 * Sends a recorded transition to every connected player of the game, in the format
 * each chose. A player who changed audience gets a diff computed across audiences
 * (decision 0035).
 */

import { type RemoteSocket, type Server } from 'socket.io';
import { type Publisher, type TransitionOutcome } from '../engine/context.js';
import { diff } from '../patches/diff.js';
import { type AnyGamePlugin } from '../plugin/types.js';
import { viewFor } from '../plugin/views.js';
import { createLogger } from '../utils/logger.js';
import { type ServerToClientEvents, type SocketData } from './events.js';

type GameSocket = RemoteSocket<ServerToClientEvents, SocketData>;

const patchesFor = async (
  plugin: AnyGamePlugin,
  outcome: TransitionOutcome,
  playerId: string,
  audience: string
) => {
  const before = outcome.audiencesBefore.get(playerId);
  const update = outcome.updates.get(audience)!;
  if (before === audience) return update.patches;
  return diff(await viewFor(plugin, outcome.previousState, before!), update.view);
};

export const createPublisher = (
  io: Server<never, ServerToClientEvents>,
  plugin: AnyGamePlugin
): Publisher => {
  const { error } = createLogger({ scope: 'socket' });

  const send = async (socket: GameSocket, outcome: TransitionOutcome) => {
    const { gameId, sequence } = outcome;
    const { playerId, format } = socket.data;
    const audience = outcome.audiencesAfter.get(playerId);
    if (audience === undefined) return;
    if (format === 'state') {
      const state = outcome.updates.get(audience)!.view;
      socket.emit('state', { gameId, sequence, state });
    } else {
      const patches = await patchesFor(plugin, outcome, playerId, audience);
      socket.emit('patches', { gameId, sequence, patches });
    }
  };

  return {
    publish: async outcome => {
      const sockets = (await io.in(outcome.gameId).fetchSockets()) as GameSocket[];
      await Promise.all(
        sockets.map(socket =>
          send(socket, outcome).catch(err =>
            error(`Failed to send update to player ${socket.data.playerId}`, err)
          )
        )
      );
    },
  };
};
