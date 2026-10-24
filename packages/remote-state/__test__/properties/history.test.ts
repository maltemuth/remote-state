/**
 * The stored history: in generated scenarios, every state is stored once, in
 * order, with the action that led to it. Views and their patches aren't stored;
 * they're built from these states (0050, 0056), which the convergence tests cover.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { MikroORM } from '@mikro-orm/sqlite';
import fc from 'fast-check';
import { entities, SpaceState } from '../../src/database/entities/index.js';
import { tempDatabases } from '../helpers/tempDatabase.js';
import {
  type ModelServer,
  playScenario,
  PROPERTY_RUNS,
  scenarioArbitrary,
  startModelServer,
} from '../helpers/scenario.js';

describe('history', () => {
  let server: ModelServer;
  let orm: MikroORM;
  after(async () => {
    await orm.close();
    await server.close();
  });
  const database = tempDatabases('history')();

  before(async () => {
    server = await startModelServer({ database });
    orm = await MikroORM.init({ dbName: database, entities });
  });

  it('stores every state once, with its action', { timeout: 30 * 60_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArbitrary, async scenario => {
        const { spaceId, latest } = await playScenario(server, scenario);
        const rows = await orm.em
          .fork()
          .find(SpaceState, { space: spaceId }, { orderBy: { sequence: 'asc' } });
        assert.deepEqual(
          rows.map(row => row.sequence),
          [...Array(latest + 1).keys()]
        );
        assert.ok(rows.slice(1).every(row => typeof row.actionType === 'string'));
      }),
      { numRuns: PROPERTY_RUNS }
    );
  });
});
