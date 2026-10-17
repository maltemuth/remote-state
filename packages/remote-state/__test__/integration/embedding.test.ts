/**
 * Embedding: the router mounted under a prefix in the host's app, the socket on
 * the host's HTTP server with its own path, and `close()` leaving the host's
 * server running.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'http';
import request from 'supertest';
import {
  createRemoteState,
  type RemoteState,
  silentLogger,
  type StateEvent,
} from '../../src/index.js';
import { counterGame, type CounterState, initialCounterState } from '../helpers/counterGame.js';
import { openSocket } from '../helpers/testServer.js';

describe('embedding', () => {
  const app = express();
  const httpServer: Server = createServer(app);
  let remote: RemoteState<CounterState>;
  let port: number;

  before(async () => {
    remote = await createRemoteState(counterGame(), {
      logger: silentLogger,
      socket: { path: '/counter/socket.io' },
    });
    app.get('/', (_req, res) => void res.send('host'));
    app.use('/counter', remote.router);
    remote.attach(httpServer);
    await new Promise<void>(resolve => httpServer.listen(0, resolve));
    port = (httpServer.address() as { port: number }).port;
  });
  after(() => new Promise<void>(resolve => httpServer.close(() => resolve())));

  const joinGame = async () => {
    const gameId = await remote.createGame(initialCounterState());
    const code = await remote.admit({ gameId, identity: { id: 'alice' } });
    const { body } = await request(app).post('/counter/api/tokens').send({ code }).expect(201);
    return { gameId, token: body.token as string };
  };

  it('serves the API under the prefix, next to the host routes', async () => {
    const { gameId, token } = await joinGame();
    await request(app).get('/').expect(200, 'host');
    const state = await request(app)
      .get(`/counter/api/games/${gameId}/state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.deepEqual(state.body.state, { count: 0, mine: 0 });
    await request(app).get('/counter/api/nothing').expect(404);
  });

  it('serves the socket on the host server, at its path', async () => {
    const { gameId, token } = await joinGame();
    const socket = openSocket(
      `http://localhost:${port}`,
      { gameId, token },
      { path: '/counter/socket.io' }
    );
    const event = await new Promise<StateEvent>(resolve => socket.once('state', resolve));
    socket.disconnect();
    assert.equal(event.sequence, 1);
  });

  it('only attaches once', () => {
    assert.throws(() => remote.attach(httpServer), { message: 'The socket is already attached' });
  });

  it('closes without closing the host server', async () => {
    await remote.close();
    assert.equal(httpServer.listening, true);
    await request(app).get('/').expect(200, 'host');
  });
});
