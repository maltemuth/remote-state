/**
 * Embedding: the router mounted under a prefix in the host's app, the socket on
 * the host's HTTP server with its own path, and `close()` leaving the host's
 * server running.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import { createServer, type Server } from 'http';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import {
  createRemoteState,
  type RemoteState,
  silentLogger,
  type StateEvent,
} from '../../src/index.js';
import { counterGame, type CounterState, initialCounterState } from '../helpers/counterGame.js';

describe('embedding', () => {
  const app = express();
  const httpServer: Server = createServer(app);
  let remote: RemoteState<CounterState>;
  let port: number;

  beforeAll(async () => {
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
  afterAll(() => new Promise<void>(resolve => httpServer.close(() => resolve())));

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
    expect(state.body.state).toEqual({ count: 0, mine: 0 });
    await request(app).get('/counter/api/nothing').expect(404);
  });

  it('serves the socket on the host server, at its path', async () => {
    const { gameId, token } = await joinGame();
    const socket = connect(`http://localhost:${port}`, {
      path: '/counter/socket.io',
      auth: { gameId, token },
      transports: ['websocket'],
      reconnection: false,
    });
    const event = await new Promise<StateEvent>(resolve => socket.once('state', resolve));
    socket.disconnect();
    expect(event.sequence).toBe(1);
  });

  it('only attaches once', () => {
    expect(() => remote.attach(httpServer)).toThrow('already attached');
  });

  it('closes without closing the host server', async () => {
    await remote.close();
    expect(httpServer.listening).toBe(true);
    await request(app).get('/').expect(200, 'host');
  });
});
