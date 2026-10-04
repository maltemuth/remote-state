/**
 * Every route leads to the same view: for generated scenarios, each player's
 * socket events, in either format, add up to what `GET …/state` answers, and
 * `GET …/updates` leads there from every sequence the player had.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { applyPatches } from 'immer';
import { getState, getUpdates, socketViews } from '../helpers/routes.js';
import {
  type ModelServer,
  playScenario,
  PROPERTY_RUNS,
  scenarioArbitrary,
  startModelServer,
} from '../helpers/scenario.js';

describe('convergence', () => {
  let server: ModelServer;

  beforeAll(async () => {
    server = await startModelServer();
  });
  afterAll(() => server.close());

  it(
    'gives every player the same view by every route',
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
        }),
        { numRuns: PROPERTY_RUNS }
      );
    },
    30 * 60_000
  );
});
