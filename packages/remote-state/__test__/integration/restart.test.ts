/**
 * Restarting the server on the same database: spaces, tokens, admission codes and
 * members carry on, sequences continue, `GET …/updates` reaches back before the
 * restart, sockets reconnect by themselves, pending timers are dropped (0042), and
 * every space is offered to the plugin's `onRestart` (0052).
 */

import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { applyPatches, enablePatches } from 'immer';
import { type Socket } from 'socket.io-client';
import request from 'supertest';
import { silentLogger, type StateEvent, transition } from '../../src/index.js';
import { initialCounterState } from '../helpers/counterRules.js';
import { tempDatabases } from '../helpers/tempDatabase.js';
import {
  getState,
  join,
  openSocket,
  sendAction,
  startCounterServer,
  startServer,
} from '../helpers/testServer.js';
import { timerRules, type TimerState } from '../helpers/timerRules.js';
import { waitUntil } from '../helpers/waitUntil.js';

enablePatches();

describe('restart', () => {
  const databaseNamed = tempDatabases('restart');
  const sockets: Socket[] = [];
  after(() => sockets.forEach(socket => socket.disconnect()));

  it('carries spaces, tokens, codes and sequences over a restart', async () => {
    const database = databaseNamed('counter.db');
    let server = await startCounterServer(undefined, { database });
    const port = server.port;
    const url = `http://localhost:${port}`;

    const spaceId = await server.createSpace(initialCounterState());
    const redeem = async (code: string) =>
      (await request(url).post('/api/tokens').send({ code }).expect(201)).body;
    const alice = await redeem(await server.admit({ spaceId, identity: { id: 'alice' } }));
    const pendingCode = await server.admit({ spaceId, identity: { id: 'bob' } });
    const act = (token: string) =>
      request(url)
        .post(`/api/spaces/${spaceId}/actions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: { type: 'increment' } })
        .expect(201);
    const getState = (token: string) =>
      request(url)
        .get(`/api/spaces/${spaceId}/state`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

    await act(alice.token);
    const before = (await getState(alice.token)).body;
    assert.partialDeepStrictEqual(before, { sequence: 2, state: { count: 1, mine: 1 } });

    const socket = openSocket(
      url,
      { spaceId, token: alice.token },
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
      assert.deepEqual((await getState(alice.token)).body, before);
      // A code issued before the restart still works, once
      const bob = await redeem(pendingCode);
      assert.notEqual(bob.memberId, alice.memberId);
      // Admitting a known identity again finds its member, without a new join
      const again = await redeem(await server.admit({ spaceId, identity: { id: 'alice' } }));
      assert.equal(again.memberId, alice.memberId);

      // Sequences continue
      assert.deepEqual((await act(again.token)).body, { sequence: 4 });

      // Catching up reaches back before the restart
      const since = await request(url)
        .get(`/api/spaces/${spaceId}/updates?since=2`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      const now = (await getState(alice.token)).body;
      assert.equal(since.body.sequence, 4);
      assert.deepEqual(applyPatches(before.state, since.body.patches), now.state);

      // The socket reconnected by itself and got the latest view
      await waitUntil(() => views.at(-1)?.sequence === 4, 'the socket to reconnect');
      assert.deepEqual(views.at(-1)!.state, now.state);
    } finally {
      await server.close();
    }
  });

  it('drops pending timers, and the space carries on', async () => {
    const database = databaseNamed('timers.db');
    let server = await startServer(timerRules, { database });
    const port = server.port;
    const spaceId = await server.createSpace({ fired: [] });
    const { token } = await join(server, spaceId, 'alice');
    const arm = (label: string, ms: number) =>
      sendAction(server, spaceId, token, { type: 'arm', name: 'turn', ms, label }).expect(201);
    await arm('lost', 300);

    await server.close();
    server = await startServer(timerRules, { database, port });
    try {
      // Nothing to wait for: give the lost timer time to fire if it survived
      await new Promise(resolve => setTimeout(resolve, 400));
      await arm('after', 10);
      const fired = async () =>
        (await getState(server, spaceId, token)).body.state.fired as string[];
      await waitUntil(async () => (await fired()).length > 0, 'the new timer');
      assert.deepEqual(await fired(), ['after']);
    } finally {
      await server.close();
    }
  });

  it('offers every space to onRestart, which can change it and schedule again (0052)', async () => {
    const database = databaseNamed('on-restart.db');
    let server = await startServer(timerRules, { database });
    const port = server.port;
    const members: { spaceId: string; token: string }[] = [];
    for (const fired of [[], ['done'], ['again']]) {
      const spaceId = await server.createSpace({ fired });
      members.push({ spaceId, ...(await join(server, spaceId, 'alice')) });
    }
    const [paused, done, rescheduled] = members;
    const view = async ({ spaceId, token }: { spaceId: string; token: string }) =>
      (await getState(server, spaceId, token)).body as { sequence: number; state: TimerState };
    const before = await Promise.all(members.map(view));

    await server.close();
    const restarted: TimerState[] = [];
    server = await startServer(
      {
        ...timerRules,
        onRestart: state => {
          restarted.push(state);
          if (state.fired.includes('done')) return state;
          if (state.fired.includes('again')) {
            return transition(state, {
              schedule: [{ name: 'turn', in: 10, action: { type: 'fire', label: 'resumed' } }],
            });
          }
          return { fired: ['paused'] };
        },
      },
      { database, port }
    );
    try {
      assert.equal(restarted.length, 3);
      // A changed state is recorded as the system's
      assert.partialDeepStrictEqual(await view(paused), {
        sequence: before[0].sequence + 1,
        state: { fired: ['paused'] },
      });
      // The state it was given, unchanged: nothing recorded
      assert.deepEqual(await view(done), before[1]);
      // A timer scheduled on restart runs
      await waitUntil(
        async () => (await view(rescheduled)).state.fired.includes('resumed'),
        'the rescheduled timer'
      );
    } finally {
      await server.close();
    }
  });

  it('logs a space whose onRestart fails, leaves it as it was, and restarts the others', async () => {
    const database = databaseNamed('on-restart-fails.db');
    let server = await startServer(timerRules, { database });
    const port = server.port;
    const failing = await server.createSpace({ fired: ['fail'] });
    const other = await server.createSpace({ fired: [] });
    const failingMember = await join(server, failing, 'alice');
    const otherMember = await join(server, other, 'alice');
    const failingBefore = (await getState(server, failing, failingMember.token)).body;

    await server.close();
    const errors: string[] = [];
    server = await startServer(
      {
        ...timerRules,
        onRestart: state => {
          if (state.fired.includes('fail')) throw new Error('broken');
          return { fired: ['paused'] };
        },
      },
      {
        database,
        port,
        logger: { ...silentLogger, error: message => void errors.push(message) },
      }
    );
    try {
      assert.deepEqual(errors, [`Restarting space ${failing} failed; it's left as it was`]);
      assert.deepEqual((await getState(server, failing, failingMember.token)).body, failingBefore);
      assert.deepEqual((await getState(server, other, otherMember.token)).body.state, {
        fired: ['paused'],
      });
    } finally {
      await server.close();
    }
  });
});
