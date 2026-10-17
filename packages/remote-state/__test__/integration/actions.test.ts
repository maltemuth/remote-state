/**
 * Actions and state over HTTP: authentication by header only (0017), rejections,
 * the 201 response with its sequence (0034), and views per audience (0024).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
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
  before(async () => {
    server = await startCounterServer();
  });
  after(() => server.close());

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
    assert.deepEqual(response.body, { sequence: 2 });
  });

  it('rejects invalid actions, refusals and missing actions with 400', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const rejected = await sendAction(server, gameId, token, { type: 'forbidden' }).expect(400);
    assert.equal(rejected.body.error, 'Action forbidden is not allowed');
    const refused = await sendAction(server, gameId, token, { type: 'refuse' }).expect(400);
    assert.equal(refused.body.error, 'Refused by the rules');
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
      assert.equal(response.body.error, 'Not now');
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
    assert.deepEqual(
      views.map(view => view.body.state),
      [
        { count: 3, mine: 2 },
        { count: 3, mine: 1 },
        { count: 3, mine: null },
      ]
    );
    assert.equal(
      views.every(view => view.body.sequence === 6),
      true
    );
  });

  it('serializes concurrent actions on one game', async () => {
    const gameId = await newGame(server);
    const { token } = await join(server, gameId, 'alice');
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => sendAction(server, gameId, token, { type: 'increment' }))
    );
    const sequences = responses.map(response => response.body.sequence).sort();
    assert.deepEqual(sequences, [2, 3, 4, 5, 6]);
    assert.deepEqual((await getState(server, gameId, token)).body.state, { count: 5, mine: 5 });
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
