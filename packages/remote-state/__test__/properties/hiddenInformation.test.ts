/**
 * No hidden information leaks: in generated scenarios, every player's notes carry
 * that player's marker, and no other player ever receives one, by socket or HTTP,
 * also while players move to and from the spectators (0024, 0035).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { getState, getUpdates, socketViews } from '../helpers/routes.js';
import {
  markerOf,
  type ModelServer,
  playScenario,
  PROPERTY_RUNS,
  scenarioArbitrary,
  startModelServer,
} from '../helpers/scenario.js';

describe('hidden information', () => {
  let server: ModelServer;

  beforeAll(async () => {
    server = await startModelServer();
  });
  afterAll(() => server.close());

  it(
    "never sends a player another player's notes",
    async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArbitrary, async scenario => {
          const { gameId, players } = await playScenario(server, scenario);
          for (const player of players) {
            await getState(server, gameId, player);
            for (const since of socketViews(player).keys()) {
              await getUpdates(server, gameId, player, since);
            }
          }

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
