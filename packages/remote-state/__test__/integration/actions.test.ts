/**
 * Actions and state over HTTP: authentication by header only (0017), rejections,
 * the 201 response with its sequence (0034), and views per audience (0024).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { GameRefusal } from '../../src/index.js';
import { counterGame } from '../helpers/counterGame.js';
import {
  type CounterServer,
  getState,
  join,
  newGame,
  sendAction,
  startCounterServer,
} from '../helpers/testServer.js';

describe('actions', () => {
  let server: CounterServer;
  beforeAll(async () => {
    server = await startCounterServer();
  });
  afterAll(() => server.close());

  it('needs the token in the Authorization header', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({ action: { type: 'increment' }, token })
      .expect(401);
    await request(server.app).get(`/api/games/${gameId}/state`).expect(401);
  });

  it('answers accepted actions with their sequence', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const response = await sendAction(server, gameId, token, { type: 'increment' }).expect(201);
    expect(response.body).toEqual({ sequence: 2 });
  });

  it('rejects invalid actions, refusals and missing actions with 400', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const rejected = await sendAction(server, gameId, token, { type: 'forbidden' }).expect(400);
    expect(rejected.body.error).toBe('Action forbidden is not allowed');
    const refused = await sendAction(server, gameId, token, { type: 'refuse' }).expect(400);
    expect(refused.body.error).toBe('Refused by the rules');
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('treats a refusal thrown by validateAction as a rejection', async () => {
    const refusing = await startCounterServer(
      counterGame({
        validateAction: () => {
          throw new GameRefusal('Not now');
        },
      })
    );
    try {
      const gameId = await newGame(refusing);
      const { token } = await join(refusing, gameId, 'alice');
      const response = await sendAction(refusing, gameId, token, { type: 'increment' }).expect(400);
      expect(response.body.error).toBe('Not now');
    } finally {
      await refusing.close();
    }
  });

  it('gives each audience its own view', async () => {
    const gameId = await newGame(server);
    const alice = await join(server, gameId, 'alice');
    const bob = await join(server, gameId, 'bob');
    const watcher = await join(server, gameId, 'watcher', { spectator: true });
    await sendAction(server, gameId, alice.token, { type: 'increment' }).expect(201);
    await sendAction(server, gameId, alice.token, { type: 'increment' }).expect(201);
    await sendAction(server, gameId, bob.token, { type: 'increment' }).expect(201);

    const views = await Promise.all(
      [alice, bob, watcher].map(player => getState(server, gameId, player.token).expect(200))
    );
    expect(views.map(view => view.body.state)).toEqual([
      { count: 3, mine: 2 },
      { count: 3, mine: 1 },
      { count: 3, mine: null },
    ]);
    expect(views.every(view => view.body.sequence === 6)).toBe(true);
  });

  it('serializes concurrent actions on one game', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => sendAction(server, gameId, token, { type: 'increment' }))
    );
    const sequences = responses.map(response => response.body.sequence).sort();
    expect(sequences).toEqual([2, 3, 4, 5, 6]);
    expect((await getState(server, gameId, token)).body.state).toEqual({ count: 5, mine: 5 });
  });

  it('answers 404 for unknown API routes and 400 for malformed JSON', async () => {
    await request(server.app).get('/api/nothing').expect(404);
    await request(server.app)
      .post('/api/tokens')
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
  });
});
