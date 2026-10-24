/**
 * Server-initiated actions: named timers that fire as the system, replacing and
 * cancelling them, the host acting as the system (0040, 0041), and actions logged
 * and recorded with their author's audience (0039).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setTimeout as sleep } from 'timers/promises';
import { type Logger, type RemoteStateServer, UnknownSpaceError } from '../../src/index.js';
import { SpaceState } from '../../src/database/entities/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { getState, join, sendAction, startServer } from '../helpers/testServer.js';
import { type TimerAction, timerRules, type TimerState } from '../helpers/timerRules.js';
import { waitUntil } from '../helpers/waitUntil.js';

describe('timers', () => {
  let server: RemoteStateServer<TimerState>;
  after(() => server.close());
  const database = tempDatabases('timers')();
  const logged: string[] = [];
  const record = (message: string) => void logged.push(message);
  const logger: Logger = { debug: () => undefined, info: record, warn: record, error: record };

  before(async () => {
    server = await startServer(timerRules, { logger, database });
  });

  const newMember = async () => {
    const spaceId = await server.createSpace({ fired: [] });
    const { memberId, token } = await join(server, spaceId, 'alice');
    const send = (action: TimerAction) => sendAction(server, spaceId, token, action);
    const fired = async () => (await getState(server, spaceId, token)).body.state.fired;
    return { spaceId, memberId, send, fired };
  };

  it('runs a due timer as the system', async () => {
    const { send, fired } = await newMember();
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'timeout' }).expect(201);
    assert.deepEqual(await fired(), []);
    await waitUntil(async () => (await fired()).length > 0, 'the timer');
    assert.deepEqual(await fired(), ['timeout']);
  });

  it('replaces a timer scheduled again under the same name', async () => {
    const { send, fired } = await newMember();
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'first' }).expect(201);
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'second' }).expect(201);
    await send({ type: 'arm', name: 'clock', ms: 300, label: 'clock' }).expect(201);
    await waitUntil(async () => (await fired()).length === 2, 'two timers');
    assert.deepEqual((await fired()).sort(), ['clock', 'second']);
  });

  it('drops a cancelled timer', async () => {
    const { send, fired } = await newMember();
    await send({ type: 'arm', name: 'turn', ms: 200, label: 'never' }).expect(201);
    await send({ type: 'cancel', name: 'turn' }).expect(201);
    // Nothing to wait for: give the timer time to fire if it weren't cancelled
    await sleep(300);
    assert.deepEqual(await fired(), []);
  });

  it("doesn't let members act as the system", async () => {
    const { send } = await newMember();
    await send({ type: 'fire', label: 'cheat' }).expect(400);
  });

  it('lets the host dispatch as the system', async () => {
    const { spaceId, fired } = await newMember();
    assert.deepEqual(await server.dispatch(spaceId, { type: 'fire', label: 'host' }), {
      sequence: 2,
    });
    assert.deepEqual(
      await server.dispatch(spaceId, { type: 'arm', name: 'x', ms: 1, label: 'x' }),
      {
        rejected: "system can't arm",
      }
    );
    assert.deepEqual(await fired(), ['host']);
    await assert.rejects(server.dispatch('nope', { type: 'fire', label: 'x' }), UnknownSpaceError);
  });

  it('logs and records who acted, from which audience', async () => {
    const { spaceId, memberId, send } = await newMember();
    await send({ type: 'arm', name: 'turn', ms: 1, label: 'late' }).expect(201);
    const fire = `fire by system in space ${spaceId}, now at 3`;
    await waitUntil(() => logged.includes(fire), 'the timer');
    assert.ok(logged.includes(`arm by everyone:${memberId} in space ${spaceId}, now at 2`));

    const rows = await withOrm(database, em =>
      em.find(SpaceState, { space: spaceId }, { orderBy: { sequence: 'asc' } })
    );
    assert.deepEqual(
      rows.map(row => [row.actionType, row.member?.id ?? null, row.audience]),
      [
        ['initial', null, null],
        ['join', memberId, 'everyone'],
        ['arm', memberId, 'everyone'],
        ['fire', null, null],
      ]
    );
  });
});
