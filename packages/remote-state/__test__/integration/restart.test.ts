/**
 * Restarting the server on the same database: games, tokens, admission codes and
 * players carry on, sequences continue, `GET …/updates` reaches back before the
 * restart, sockets reconnect by themselves, and pending timers are dropped (0042).
 */

import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { applyPatches, enablePatches } from 'immer';
import { type Socket } from 'socket.io-client';
import request from 'supertest';
import { type StateEvent } from '../../src/index.js';
import { initialCounterState } from '../helpers/counterGame.js';
import { tempDatabases } from '../helpers/tempDatabase.js';
import {
  getState,
  join,
  openSocket,
  sendAction,
  startCounterServer,
  startServer,
} from '../helpers/testServer.js';
import { timerGame } from '../helpers/timerGame.js';
import { waitUntil } from '../helpers/waitUntil.js';

enablePatches();

jest.setTimeout(20_000);

describe('restart', () => {
  const databaseNamed = tempDatabases('restart');
  const sockets: Socket[] = [];
  afterAll(() => sockets.forEach(socket => socket.disconnect()));

  it('carries games, tokens, codes and sequences over a restart', async () => {
    const database = databaseNamed('counter.db');
    let server = await startCounterServer(undefined, { database });
    const port = server.port;
    const url = `http://localhost:${port}`;

    const gameId = await server.createGame(initialCounterState());
    const redeem = async (code: string) =>
      (await request(url).post('/api/tokens').send({ code }).expect(201)).body;
    const alice = await redeem(await server.admit({ gameId, identity: { id: 'alice' } }));
    const pendingCode = await server.admit({ gameId, identity: { id: 'bob' } });
    const act = (token: string) =>
      request(url)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: { type: 'increment' } })
        .expect(201);
    const getState = (token: string) =>
      request(url)
        .get(`/api/games/${gameId}/state`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

    await act(alice.token);
    const before = (await getState(alice.token)).body;
    expect(before).toMatchObject({ sequence: 2, state: { count: 1, mine: 1 } });

    const socket = openSocket(
      url,
      { gameId, token: alice.token },
      { reconnection: true, reconnectionDelay: 50, reconnectionDelayMax: 100 }
    );
    sockets.push(socket);
    const views: StateEvent[] = [];
    socket.on('state', (event: StateEvent) => views.push(event));
    await waitUntil(() => views.length === 1, 'the view on connect');

    await server.close();
    server = await startCounterServer(undefined, { database, port });
    try {
      // The same view, under the same token
      expect((await getState(alice.token)).body).toEqual(before);
      // A code issued before the restart still works, once
      const bob = await redeem(pendingCode);
      expect(bob.playerId).not.toBe(alice.playerId);
      // Admitting a known identity again finds its player, without a new join
      const again = await redeem(await server.admit({ gameId, identity: { id: 'alice' } }));
      expect(again.playerId).toBe(alice.playerId);

      // Sequences continue
      expect((await act(again.token)).body).toEqual({ sequence: 4 });

      // Catching up reaches back before the restart
      const since = await request(url)
        .get(`/api/games/${gameId}/updates?since=2`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      const now = (await getState(alice.token)).body;
      expect(since.body.sequence).toBe(4);
      expect(applyPatches(before.state, since.body.patches)).toEqual(now.state);

      // The socket reconnected by itself and got the latest view
      await waitUntil(() => views.at(-1)?.sequence === 4, 'the socket to reconnect');
      expect(views.at(-1)!.state).toEqual(now.state);
    } finally {
      await server.close();
    }
  });

  it('drops pending timers, and the game carries on', async () => {
    const database = databaseNamed('timers.db');
    let server = await startServer(timerGame, { database });
    const port = server.port;
    const gameId = await server.createGame({ fired: [] });
    const { token } = await join(server, gameId, 'alice');
    const arm = (label: string, ms: number) =>
      sendAction(server, gameId, token, { type: 'arm', name: 'turn', ms, label }).expect(201);
    await arm('lost', 300);

    await server.close();
    server = await startServer(timerGame, { database, port });
    try {
      // Nothing to wait for: give the lost timer time to fire if it survived
      await new Promise(resolve => setTimeout(resolve, 400));
      await arm('after', 10);
      const fired = async () =>
        (await getState(server, gameId, token)).body.state.fired as string[];
      await waitUntil(async () => (await fired()).length > 0, 'the new timer');
      expect(await fired()).toEqual(['after']);
    } finally {
      await server.close();
    }
  });
});
