/**
 * For generated scenarios, every route leads to the same view, and no route
 * leaks another player's notes (0024, 0035): each player's socket events, in
 * either format, add up to what `GET …/state` answers, `GET …/updates` leads
 * there from every sequence the player had, and nothing a player received, by
 * socket or HTTP, carries another player's marker. Run with each diff (0058).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fc from 'fast-check';
import { applyPatches } from 'immer';
import { getState, getUpdates, socketViews } from '../helpers/routes.js';
import {
  type ModelServer,
  markerOf,
  playScenario,
  PROPERTY_RUNS,
  scenarioArbitrary,
  startModelServer,
} from '../helpers/scenario.js';
import { type DiffName, diffs } from '../../src/patches/diff.js';

for (const diff of Object.keys(diffs) as DiffName[]) {
  describe(`convergence and hidden information, with the ${diff} diff`, () => {
    let server: ModelServer;

    before(async () => {
      server = await startModelServer({ diff });
    });
    after(() => server.close());

    it(
      "gives every player the same view by every route, and no one else's notes",
      { timeout: 30 * 60_000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(scenarioArbitrary, async scenario => {
            const { gameId, latest, players } = await playScenario(server, scenario);
            for (const player of players) {
              const views = socketViews(player);
              const current = await getState(server, gameId, player);
              assert.equal(current.sequence, latest);
              assert.deepEqual(views.get(latest), current.state);

              for (const [since, view] of views) {
                const response = await getUpdates(server, gameId, player, since);
                assert.equal(response.status, 200);
                assert.equal(response.body.sequence, latest);
                assert.deepEqual(
                  applyPatches(view as object, response.body.patches),
                  current.state
                );
              }
            }

            // Everything each player received, socket events and HTTP answers alike
            players.forEach((player, index) => {
              const others = players.map((_, i) => markerOf(i)).filter((_, i) => i !== index);
              for (const payload of player.payloads) {
                for (const marker of others) assert.ok(!payload.includes(marker));
              }
            });
          }),
          { numRuns: PROPERTY_RUNS }
        );
      }
    );
  });
}
