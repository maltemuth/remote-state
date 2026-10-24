/**
 * Creating spaces and admitting members: single-use codes, the join hook, and
 * several tokens per member (decisions 0019, 0020, 0021, 0026).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, mock } from 'node:test';
import request from 'supertest';
import { CODE_LIFETIME_MS, UnknownSpaceError } from '../../src/index.js';
import { counterRules, MAX_PLAYERS } from '../helpers/counterRules.js';
import {
  type CounterServer,
  getState,
  join,
  newSpace,
  sendAction,
  startCounterServer,
} from '../helpers/testServer.js';

const redeem = (server: CounterServer, code: unknown) =>
  request(server.app).post('/api/tokens').send({ code });

describe('admission', () => {
  let server: CounterServer;
  /** What the join hook was given, per call */
  const joins: { memberId: string; details: Record<string, unknown> }[] = [];
  before(async () => {
    const space = counterRules();
    server = await startCounterServer({
      ...space,
      onJoin: (state, member) => {
        joins.push(member);
        return space.onJoin!(state, member);
      },
    });
  });
  after(() => server.close());

  it('has no public endpoints for creating or joining spaces', async () => {
    await request(server.app).post('/api/spaces').send({}).expect(404);
    const spaceId = await newSpace(server);
    await request(server.app).post(`/api/spaces/${spaceId}/members`).send({}).expect(404);
  });

  it('exchanges a code for a token once', async () => {
    const spaceId = await newSpace(server);
    const code = await server.admit({ spaceId, identity: { id: 'alice', name: 'Alice' } });
    const first = await redeem(server, code).expect(201);
    const { memberId, token, ...rest } = first.body;
    assert.deepEqual(rest, { spaceId });
    assert.equal(typeof memberId, 'string');
    assert.equal(typeof token, 'string');
    await redeem(server, code).expect(401);
  });

  it('rejects missing, unknown and expired codes', async () => {
    const spaceId = await newSpace(server);
    await redeem(server, undefined).expect(400);
    await redeem(server, 'not-a-code').expect(401);
    const code = await server.admit({ spaceId, identity: { id: 'late' } });
    const now = Date.now();
    const clock = mock.method(Date, 'now', () => now + CODE_LIFETIME_MS + 1);
    try {
      await redeem(server, code).expect(401);
    } finally {
      clock.mock.restore();
    }
  });

  it('validates admissions', async () => {
    await assert.rejects(
      server.admit({ spaceId: 'nope', identity: { id: 'x' } }),
      UnknownSpaceError
    );
    const spaceId = await newSpace(server);
    await assert.rejects(server.admit({ spaceId, identity: { id: '' } }));
  });

  it('runs the join hook once per identity, with the host details', async () => {
    const spaceId = await newSpace(server);
    const first = await join(server, spaceId, 'alice', { name: 'Alice' });
    const again = await join(server, spaceId, 'alice', { name: 'Ignored' });
    assert.equal(again.memberId, first.memberId);
    assert.deepEqual(
      joins.filter(({ memberId }) => memberId === first.memberId),
      [{ memberId: first.memberId, details: { name: 'Alice' } }]
    );
    assert.notEqual(again.token, first.token);

    // Both tokens stay valid (0019); the join is the only transition so far
    const view = await getState(server, spaceId, first.token).expect(200);
    await getState(server, spaceId, again.token).expect(200);
    assert.deepEqual(view.body, { spaceId, sequence: 1, state: { count: 0, mine: 0 } });
  });

  it('refuses a join with the space reason, using up the code', async () => {
    const spaceId = await newSpace(server);
    for (let i = 0; i < MAX_PLAYERS; i++) await join(server, spaceId, `member-${i}`);
    const code = await server.admit({ spaceId, identity: { id: 'one-too-many' } });
    const refused = await redeem(server, code).expect(403);
    assert.equal(refused.body.error, 'Space is full');
    await redeem(server, code).expect(401);
  });

  it('only accepts tokens for their own space', async () => {
    const spaceId = await newSpace(server);
    const otherSpace = await newSpace(server);
    const { token } = await join(server, otherSpace, 'alice');
    await getState(server, spaceId, token).expect(401);
    await sendAction(server, spaceId, token, { type: 'increment' }).expect(401);
  });
});
