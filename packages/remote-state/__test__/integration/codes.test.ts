/**
 * Spent admission codes, used or expired, are deleted when a new code is issued.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, mock } from 'node:test';
import { CODE_LIFETIME_MS } from '../../src/index.js';
import { AdmissionCode } from '../../src/database/entities/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { counterRules } from '../helpers/counterRules.js';
import { type CounterServer, join, newSpace, startCounterServer } from '../helpers/testServer.js';

describe('admission codes', () => {
  let server: CounterServer;
  after(() => server.close());
  const database = tempDatabases('codes')();

  before(async () => {
    server = await startCounterServer(counterRules(), { database });
  });

  /** The identities of the codes still stored */
  const storedCodes = () =>
    withOrm(database, async em => (await em.find(AdmissionCode, {})).map(code => code.identityId));

  it('deletes used and expired codes when issuing a new one', async () => {
    const spaceId = await newSpace(server);
    await join(server, spaceId, 'used');
    await server.admit({ spaceId, identity: { id: 'expired' } });
    assert.deepEqual(await storedCodes(), ['expired']);

    const later = Date.now() + CODE_LIFETIME_MS + 1;
    const clock = mock.method(Date, 'now', () => later);
    try {
      await server.admit({ spaceId, identity: { id: 'fresh' } });
    } finally {
      clock.mock.restore();
    }
    assert.deepEqual(await storedCodes(), ['fresh']);
  });
});
