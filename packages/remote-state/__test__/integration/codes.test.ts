/**
 * Spent admission codes, used or expired, are deleted when a new code is issued.
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { MikroORM } from '@mikro-orm/sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { CODE_LIFETIME_MS } from '../../src/index.js';
import { AdmissionCode, entities } from '../../src/database/entities/index.js';
import { counterGame } from '../helpers/counterGame.js';
import { type CounterServer, join, newGame, startCounterServer } from '../helpers/testServer.js';

describe('admission codes', () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'remote-state-codes-'));
  const database = joinPath(directory, 'games.db');
  let server: CounterServer;

  beforeAll(async () => {
    server = await startCounterServer(counterGame(), { database });
  });
  afterAll(async () => {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  });

  /** The identities of the codes still stored */
  const storedCodes = async () => {
    const orm = await MikroORM.init({ dbName: database, entities, debug: false });
    try {
      return (await orm.em.fork().find(AdmissionCode, {})).map(code => code.identityId);
    } finally {
      await orm.close();
    }
  };

  it('deletes used and expired codes when issuing a new one', async () => {
    const gameId = await newGame(server);
    await join(server, gameId, 'used');
    await server.admit({ gameId, identity: { id: 'expired' } });
    expect(await storedCodes()).toEqual(['expired']);

    const later = Date.now() + CODE_LIFETIME_MS + 1;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await server.admit({ gameId, identity: { id: 'fresh' } });
    } finally {
      clock.mockRestore();
    }
    expect(await storedCodes()).toEqual(['fresh']);
  });
});
