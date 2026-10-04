/**
 * Creating games and admitting players: single-use codes, the join hook, and
 * several tokens per player (decisions 0019, 0020, 0021, 0026).
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { CODE_LIFETIME_MS, UnknownGameError } from '../../src/index.js';
import { MAX_PLAYERS } from '../helpers/counterGame.js';
import {
  type CounterServer,
  getState,
  join,
  newGame,
  sendAction,
  startCounterServer,
} from '../helpers/testServer.js';

const redeem = (server: CounterServer, code: unknown) =>
  request(server.app).post('/api/tokens').send({ code });

describe('admission', () => {
  let server: CounterServer;
  beforeAll(async () => {
    server = await startCounterServer();
  });
  afterAll(() => server.close());

  it('has no public endpoints for creating or joining games', async () => {
    await request(server.app).post('/api/games').send({}).expect(404);
    const gameId = await newGame(server);
    await request(server.app).post(`/api/games/${gameId}/players`).send({}).expect(404);
  });

  it('exchanges a code for a token once', async () => {
    const gameId = await newGame(server);
    const code = await server.admit({ gameId, identity: { id: 'alice', name: 'Alice' } });
    const first = await redeem(server, code).expect(201);
    expect(first.body).toEqual({ gameId, playerId: expect.any(String), token: expect.any(String) });
    await redeem(server, code).expect(401);
  });

  it('rejects missing, unknown and expired codes', async () => {
    const gameId = await newGame(server);
    await redeem(server, undefined).expect(400);
    await redeem(server, 'not-a-code').expect(401);
    const code = await server.admit({ gameId, identity: { id: 'late' } });
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + CODE_LIFETIME_MS + 1);
    try {
      await redeem(server, code).expect(401);
    } finally {
      clock.mockRestore();
    }
  });

  it('validates admissions', async () => {
    await expect(server.admit({ gameId: 'nope', identity: { id: 'x' } })).rejects.toThrow(
      UnknownGameError
    );
    const gameId = await newGame(server);
    await expect(server.admit({ gameId, identity: { id: '' } })).rejects.toThrow();
  });

  it('runs the join hook once per identity, with the host details', async () => {
    const gameId = await newGame(server);
    const first = await join(server, gameId, 'alice', { name: 'Alice' });
    const again = await join(server, gameId, 'alice', { name: 'Ignored' });
    expect(again.playerId).toBe(first.playerId);
    expect(again.token).not.toBe(first.token);

    // Both tokens stay valid (0019); the join is the only transition so far
    const view = await getState(server, gameId, first.token).expect(200);
    await getState(server, gameId, again.token).expect(200);
    expect(view.body).toEqual({ gameId, sequence: 1, state: { count: 0, mine: 0 } });
  });

  it('refuses a join with the game reason, using up the code', async () => {
    const gameId = await newGame(server);
    for (let i = 0; i < MAX_PLAYERS; i++) await join(server, gameId, `player-${i}`);
    const code = await server.admit({ gameId, identity: { id: 'one-too-many' } });
    const refused = await redeem(server, code).expect(403);
    expect(refused.body.error).toBe('Game is full');
    await redeem(server, code).expect(401);
  });

  it('only accepts tokens for their own game', async () => {
    const gameId = await newGame(server);
    const otherGame = await newGame(server);
    const { token } = await join(server, otherGame, 'alice');
    await getState(server, gameId, token).expect(401);
    await sendAction(server, gameId, token, { type: 'increment' }).expect(401);
  });
});
