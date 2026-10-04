/**
 * Restarting the server on the same database: games, tokens, admission codes and
 * players carry on, sequences continue, `GET …/updates` reaches back before the
 * restart, sockets reconnect by themselves, and pending timers are dropped (0042).
 */

import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'fs';
import { applyPatches, enablePatches } from 'immer';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { type StateEvent, type RemoteStateServer } from '../../src/index.js';
import { initialCounterState } from '../helpers/counterGame.js';
import { startCounterServer } from '../helpers/testServer.js';
import { timerGame, type TimerState } from '../helpers/timerGame.js';
import { createRemoteStateServer, silentLogger } from '../../src/index.js';

enablePatches();

const waitFor = async (condition: () => boolean, what: string) => {
  for (let i = 0; i < 400 && !condition(); i++) await new Promise(r => setTimeout(r, 10));
  if (!condition()) throw new Error(`Timed out waiting for ${what}`);
};

jest.setTimeout(20_000);

describe('restart', () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'remote-state-restart-'));
  const sockets: Socket[] = [];
  afterAll(() => {
    sockets.forEach(socket => socket.disconnect());
    rmSync(directory, { recursive: true, force: true });
  });

  it('carries games, tokens, codes and sequences over a restart', async () => {
    const database = joinPath(directory, 'counter.db');
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

    const socket = connect(url, {
      auth: { gameId, token: alice.token },
      transports: ['websocket'],
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
    });
    sockets.push(socket);
    const views: StateEvent[] = [];
    socket.on('state', (event: StateEvent) => views.push(event));
    await waitFor(() => views.length === 1, 'the view on connect');

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
      await waitFor(() => views.at(-1)?.sequence === 4, 'the socket to reconnect');
      expect(views.at(-1)!.state).toEqual(now.state);
    } finally {
      await server.close();
    }
  });

  it('drops pending timers, and the game carries on', async () => {
    const database = joinPath(directory, 'timers.db');
    let server: RemoteStateServer<TimerState> = await createRemoteStateServer(timerGame, {
      port: 0,
      logger: silentLogger,
      database,
    });
    await server.startServer();
    const port = server.port;
    const gameId = await server.createGame({ fired: [] });
    const code = await server.admit({ gameId, identity: { id: 'alice' } });
    const { token } = (await request(server.app).post('/api/tokens').send({ code })).body;
    const send = (action: object) =>
      request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action });
    await send({ type: 'arm', name: 'turn', ms: 100, label: 'lost' }).expect(201);

    await server.close();
    server = await createRemoteStateServer(timerGame, { port, logger: silentLogger, database });
    await server.startServer();
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      await send({ type: 'arm', name: 'turn', ms: 10, label: 'after' }).expect(201);
      await new Promise(resolve => setTimeout(resolve, 100));
      const { body } = await request(server.app)
        .get(`/api/games/${gameId}/state`)
        .set('Authorization', `Bearer ${token}`);
      expect(body.state.fired).toEqual(['after']);
    } finally {
      await server.close();
    }
  });
});
