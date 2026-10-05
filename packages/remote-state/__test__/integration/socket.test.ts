/**
 * The socket: authentication and formats in the handshake (0008), the whole view
 * on connect (0031), and updates as whole views or patches, also across audience
 * changes (0035).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { applyPatches, enablePatches } from 'immer';
import { type Socket } from 'socket.io-client';
import { type PatchesEvent, type StateEvent } from '../../src/index.js';
import {
  type CounterServer,
  join,
  newGame,
  sendAction,
  openSocket,
  serverUrl,
  startCounterServer,
} from '../helpers/testServer.js';
import { waitUntil } from '../helpers/waitUntil.js';

enablePatches();

describe('socket', () => {
  let server: CounterServer;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = await startCounterServer();
  });
  afterAll(async () => {
    sockets.forEach(socket => socket.disconnect());
    await server.close();
  });

  const open = (auth: object, format?: string) => {
    const socket = openSocket(serverUrl(server), auth, { query: format ? { format } : {} });
    sockets.push(socket);
    return socket;
  };

  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>(resolve => socket.once(event, resolve));

  const connectError = (socket: Socket) =>
    new Promise<string>(resolve => socket.once('connect_error', err => resolve(err.message)));

  it('refuses invalid tokens and unknown formats', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    expect(await connectError(open({ gameId, token: 'wrong' }))).toMatch(/Invalid token/);
    expect(await connectError(open({ gameId, token }, 'json-patch'))).toMatch(/Unknown format/);
  });

  it('sends the whole view on connect, then whole views', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const socket = open({ gameId, token });
    expect(await next<StateEvent>(socket, 'state')).toEqual({
      gameId,
      sequence: 1,
      state: { count: 0, mine: 0 },
    });
    const update = next<StateEvent>(socket, 'state');
    await sendAction(server, gameId, token, { type: 'increment' }).expect(201);
    expect(await update).toEqual({ gameId, sequence: 2, state: { count: 1, mine: 1 } });
  });

  it('sends patches in order, also across an audience change', async () => {
    const gameId = await newGame(server);
    const alice = await join(server, gameId, 'alice');
    const bob = await join(server, gameId, 'bob');
    const socket = open({ gameId, token: alice.token }, 'immer');
    let view = (await next<StateEvent>(socket, 'state')).state;
    const received: PatchesEvent[] = [];
    socket.on('patches', (event: PatchesEvent) => received.push(event));

    await Promise.all([
      sendAction(server, gameId, alice.token, { type: 'increment' }),
      sendAction(server, gameId, bob.token, { type: 'increment' }),
      sendAction(server, gameId, alice.token, { type: 'increment' }),
    ]);
    await sendAction(server, gameId, alice.token, { type: 'spectate' }).expect(201);
    await waitUntil(() => received.length === 4, 'four updates');

    expect(received.map(event => event.sequence)).toEqual([3, 4, 5, 6]);
    for (const event of received) view = applyPatches(view as object, event.patches);
    expect(view).toEqual({ count: 3, mine: null });
  });
});
