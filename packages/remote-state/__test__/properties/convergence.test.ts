/**
 * For generated scenarios, every route leads to the same view, and no route
 * leaks another player's notes (0024, 0035): each player's socket events, in
 * either format, add up to what `GET …/state` answers, `GET …/updates` leads
 * there from every sequence the player had, and nothing a player received, by
 * socket or HTTP, carries another player's marker.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
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

describe('convergence and hidden information', () => {
  let server: ModelServer;

  beforeAll(async () => {
    server = await startModelServer();
  });
  afterAll(() => server.close());

  it(
    "gives every player the same view by every route, and no one else's notes",
    async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArbitrary, async scenario => {
          const { gameId, latest, players } = await playScenario(server, scenario);
          for (const player of players) {
            const views = socketViews(player);
            const current = await getState(server, gameId, player);
            expect(current.sequence).toBe(latest);
            expect(views.get(latest)).toEqual(current.state);

            for (const [since, view] of views) {
              const response = await getUpdates(server, gameId, player, since);
              expect(response.status).toBe(200);
              expect(response.body.sequence).toBe(latest);
              expect(applyPatches(view as object, response.body.patches)).toEqual(current.state);
            }
          }

          // Everything each player received, socket events and HTTP answers alike
          players.forEach((player, index) => {
            const others = players.map((_, i) => markerOf(i)).filter((_, i) => i !== index);
            for (const payload of player.payloads) {
              for (const marker of others) expect(payload).not.toContain(marker);
            }
          });
        }),
        { numRuns: PROPERTY_RUNS }
      );
    },
    30 * 60_000
  );
});
