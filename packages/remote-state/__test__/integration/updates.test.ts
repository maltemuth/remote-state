/**
 * `GET …/updates?since=`: one patch from the member's view at `since` (0030),
 * computed across audience changes, 404 before joining, 303 when no patch can be
 * built (0035).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { applyPatches, enablePatches } from 'immer';
import { SpaceState } from '../../src/database/entities/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { counterRules } from '../helpers/counterRules.js';
import {
  type CounterServer,
  getState,
  getUpdates,
  join,
  newSpace,
  sendAction,
  startCounterServer,
} from '../helpers/testServer.js';

enablePatches();

describe('updates', () => {
  let server: CounterServer;
  after(() => server.close());
  const databaseFilename = tempDatabases('updates')();

  before(async () => {
    server = await startCounterServer(counterRules(), { database: databaseFilename });
  });

  /** alice joins (1), bob joins (2), then alice, bob, alice increment (3–5) */
  const playedSpace = async () => {
    const spaceId = await newSpace(server);
    const alice = await join(server, spaceId, 'alice');
    const aliceAtOne = (await getState(server, spaceId, alice.token)).body.state;
    const bob = await join(server, spaceId, 'bob');
    for (const member of [alice, bob, alice]) {
      await sendAction(server, spaceId, member.token, { type: 'increment' }).expect(201);
    }
    return { spaceId, alice, bob, aliceAtOne };
  };

  it('builds one patch across several actions', async () => {
    const { spaceId, alice, aliceAtOne } = await playedSpace();
    const response = await getUpdates(server, spaceId, alice.token, 1).expect(200);
    assert.partialDeepStrictEqual(response.body, { spaceId, since: 1, sequence: 5 });
    assert.deepEqual(applyPatches(aliceAtOne, response.body.patches), { count: 3, mine: 2 });
  });

  it('answers an empty patch when nothing changed', async () => {
    const { spaceId, alice } = await playedSpace();
    const response = await getUpdates(server, spaceId, alice.token, 5).expect(200);
    assert.deepEqual(response.body.patches, []);
  });

  it('rejects malformed, future and pre-join sequences', async () => {
    const { spaceId, alice, bob } = await playedSpace();
    await getUpdates(server, spaceId, alice.token, 'abc').expect(400);
    await getUpdates(server, spaceId, alice.token, 6).expect(404);
    await getUpdates(server, spaceId, bob.token, 1).expect(404);
  });

  it('computes the patch across an audience change', async () => {
    const { spaceId, alice } = await playedSpace();
    const aliceAtFive = (await getState(server, spaceId, alice.token)).body.state;
    await sendAction(server, spaceId, alice.token, { type: 'spectate' }).expect(201);
    await sendAction(server, spaceId, alice.token, { type: 'increment' }).expect(400);

    const response = await getUpdates(server, spaceId, alice.token, 5).expect(200);
    assert.equal(response.body.sequence, 6);
    assert.deepEqual(applyPatches(aliceAtFive, response.body.patches), { count: 3, mine: null });
  });

  it('redirects to the state when the view at `since` is gone', async () => {
    const { spaceId, alice, bob } = await playedSpace();
    await sendAction(server, spaceId, alice.token, { type: 'spectate' }).expect(201);
    await withOrm(databaseFilename, em =>
      em.nativeDelete(SpaceState, { space: spaceId, sequence: 3 })
    );

    // With or without an audience change: patches are built from the stored states (0056)
    for (const member of [alice, bob]) {
      const redirect = await getUpdates(server, spaceId, member.token, 3).expect(303);
      assert.equal(redirect.headers.location, 'state');
    }
    await getUpdates(server, spaceId, bob.token, 4).expect(200);
  });
});
