/**
 * Players pairing their own devices (0063): with `devicePairing`, a player gets a
 * single-use code for themselves, which another device redeems for a new token for
 * the same player; without it, there's no such endpoint.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import request from 'supertest';
import { counterGame } from '../helpers/counterGame.js';
import {
  type CounterServer,
  getState,
  join,
  newGame,
  startCounterServer,
} from '../helpers/testServer.js';

const askForCode = (server: CounterServer, gameId: string, token?: string) => {
  const req = request(server.app).post(`/api/games/${gameId}/codes`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('pairing devices', () => {
  let server: CounterServer;
  before(async () => {
    server = await startCounterServer(counterGame(), { devicePairing: true });
  });
  after(() => server.close());

  it('gives a player a code that another device redeems as the same player', async () => {
    const gameId = await newGame(server);
    const phone = await join(server, gameId, 'ann');
    const { code } = (await askForCode(server, gameId, phone.token).expect(201)).body;

    const tablet = (await request(server.app).post('/api/tokens').send({ code }).expect(201)).body;
    assert.equal(tablet.playerId, phone.playerId);
    assert.equal(tablet.gameId, gameId);
    assert.notEqual(tablet.token, phone.token);

    // Both devices are the player, with the same view
    const views = await Promise.all(
      [phone.token, tablet.token].map(async token => (await getState(server, gameId, token)).body)
    );
    assert.deepEqual(views[0], views[1]);
  });

  it('gives codes that can be redeemed once', async () => {
    const gameId = await newGame(server);
    const ann = await join(server, gameId, 'ann');
    const { code } = (await askForCode(server, gameId, ann.token).expect(201)).body;
    await request(server.app).post('/api/tokens').send({ code }).expect(201);
    await request(server.app).post('/api/tokens').send({ code }).expect(401);
  });

  it("refuses anyone who isn't a player of the game", async () => {
    const gameId = await newGame(server);
    const other = await newGame(server);
    const ann = await join(server, other, 'ann');
    await askForCode(server, gameId).expect(401);
    await askForCode(server, gameId, ann.token).expect(401);
  });
});

describe('without device pairing', () => {
  let server: CounterServer;
  before(async () => {
    server = await startCounterServer(counterGame());
  });
  after(() => server.close());

  it("doesn't serve the endpoint", async () => {
    const gameId = await newGame(server);
    const ann = await join(server, gameId, 'ann');
    assert.deepEqual((await askForCode(server, gameId, ann.token).expect(404)).body, {
      error: 'Endpoint not found',
    });
  });
});
