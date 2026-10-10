/**
 * The stored history replays: in generated scenarios, every state is stored once,
 * and every stored audience diff turns that audience's previous view into its
 * next (0012, 0024).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MikroORM } from '@mikro-orm/sqlite';
import fc from 'fast-check';
import { applyPatches, enablePatches, type Patch } from 'immer';
import { AudienceDiff, entities, GameState } from '../../src/database/entities/index.js';
import { type ModelState, viewOf } from '../helpers/modelGame.js';
import { tempDatabases } from '../helpers/tempDatabase.js';
import {
  type ModelServer,
  playScenario,
  PROPERTY_RUNS,
  scenarioArbitrary,
  startModelServer,
} from '../helpers/scenario.js';

enablePatches();

describe('history', () => {
  const database = tempDatabases('history')();
  let server: ModelServer;
  let orm: MikroORM;

  beforeAll(async () => {
    server = await startModelServer({ database });
    orm = await MikroORM.init({ dbName: database, entities });
  });
  afterAll(async () => {
    await orm.close();
    await server.close();
  });

  it(
    'replays every stored diff',
    async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArbitrary, async scenario => {
          const { gameId, latest } = await playScenario(server, scenario);
          const em = orm.em.fork();
          const rows = await em.find(GameState, { game: gameId }, { orderBy: { sequence: 'asc' } });
          expect(rows.map(row => row.sequence)).toEqual([...Array(latest + 1).keys()]);
          const states = rows.map(row => row.state as ModelState);

          const diffs = await em.find(AudienceDiff, { game: gameId });
          expect(diffs.length).toBeGreaterThan(0);
          for (const { audience, sequence, patches } of diffs) {
            const before = viewOf(states[sequence - 1], audience);
            expect(applyPatches(before, patches as Patch[])).toEqual(
              viewOf(states[sequence], audience)
            );
          }
        }),
        { numRuns: PROPERTY_RUNS }
      );
    },
    30 * 60_000
  );
});
