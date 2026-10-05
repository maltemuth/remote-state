/**
 * `GET …/updates?since=`: one patch from the player's view at `since` (0030),
 * computed across audience changes, 404 before joining, 303 when no patch can be
 * built (0035).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { applyPatches, enablePatches } from 'immer';
import { GameState } from '../../src/database/entities/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { counterGame } from '../helpers/counterGame.js';
import {
  type CounterServer,
  getState,
  getUpdates,
  join,
  newGame,
  sendAction,
  startCounterServer,
} from '../helpers/testServer.js';

enablePatches();

describe('updates', () => {
  const databaseFilename = tempDatabases('updates')();
  let server: CounterServer;

  beforeAll(async () => {
    server = await startCounterServer(counterGame(), { database: databaseFilename });
  });
  afterAll(() => server.close());

  /** alice joins (1), bob joins (2), then alice, bob, alice increment (3–5) */
  const playedGame = async () => {
    const gameId = await newGame(server);
    const alice = await join(server, gameId, 'alice');
    const aliceAtOne = (await getState(server, gameId, alice.token)).body.state;
    const bob = await join(server, gameId, 'bob');
    for (const player of [alice, bob, alice]) {
      await sendAction(server, gameId, player.token, { type: 'increment' }).expect(201);
    }
    return { gameId, alice, bob, aliceAtOne };
  };

  it('joins the stored diffs into one patch', async () => {
    const { gameId, alice, aliceAtOne } = await playedGame();
    const response = await getUpdates(server, gameId, alice.token, 1).expect(200);
    expect(response.body).toMatchObject({ gameId, since: 1, sequence: 5 });
    expect(applyPatches(aliceAtOne, response.body.patches)).toEqual({ count: 3, mine: 2 });
  });

  it('answers an empty patch when nothing changed', async () => {
    const { gameId, alice } = await playedGame();
    const response = await getUpdates(server, gameId, alice.token, 5).expect(200);
    expect(response.body.patches).toEqual([]);
  });

  it('rejects malformed, future and pre-join sequences', async () => {
    const { gameId, alice, bob } = await playedGame();
    await getUpdates(server, gameId, alice.token, 'abc').expect(400);
    await getUpdates(server, gameId, alice.token, 6).expect(404);
    await getUpdates(server, gameId, bob.token, 1).expect(404);
  });

  it('computes the patch across an audience change', async () => {
    const { gameId, alice } = await playedGame();
    const aliceAtFive = (await getState(server, gameId, alice.token)).body.state;
    await sendAction(server, gameId, alice.token, { type: 'spectate' }).expect(201);
    await sendAction(server, gameId, alice.token, { type: 'increment' }).expect(400);

    const response = await getUpdates(server, gameId, alice.token, 5).expect(200);
    expect(response.body.sequence).toBe(6);
    expect(applyPatches(aliceAtFive, response.body.patches)).toEqual({ count: 3, mine: null });
  });

  it('redirects to the state when the view at `since` is gone', async () => {
    const { gameId, alice, bob } = await playedGame();
    await sendAction(server, gameId, alice.token, { type: 'spectate' }).expect(201);
    await withOrm(databaseFilename, em =>
      em.nativeDelete(GameState, { game: gameId, sequence: 3 })
    );

    const redirect = await getUpdates(server, gameId, alice.token, 3).expect(303);
    expect(redirect.headers.location).toBe('state');
    // Without an audience change, stored diffs don't need the old state
    await getUpdates(server, gameId, bob.token, 3).expect(200);
  });
});
