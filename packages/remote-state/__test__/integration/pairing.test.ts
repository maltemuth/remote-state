/**
 * Members pairing their own devices (0063): with `devicePairing`, a member gets a
 * single-use code for themselves, which another device redeems for a new token for
 * the same member; without it, there's no such endpoint.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import request from 'supertest';
import { counterRules } from '../helpers/counterRules.js';
import {
  type CounterServer,
  getState,
  join,
  newSpace,
  startCounterServer,
} from '../helpers/testServer.js';

const askForCode = (server: CounterServer, spaceId: string, token?: string) => {
  const req = request(server.app).post(`/api/spaces/${spaceId}/codes`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('pairing devices', () => {
  let server: CounterServer;
  before(async () => {
    server = await startCounterServer(counterRules(), { devicePairing: true });
  });
  after(() => server.close());

  it('gives a member a code that another device redeems as the same member', async () => {
    const spaceId = await newSpace(server);
    const phone = await join(server, spaceId, 'ann');
    const { code } = (await askForCode(server, spaceId, phone.token).expect(201)).body;

    const tablet = (await request(server.app).post('/api/tokens').send({ code }).expect(201)).body;
    assert.equal(tablet.memberId, phone.memberId);
    assert.equal(tablet.spaceId, spaceId);
    assert.notEqual(tablet.token, phone.token);

    // Both devices are the member, with the same view
    const views = await Promise.all(
      [phone.token, tablet.token].map(async token => (await getState(server, spaceId, token)).body)
    );
    assert.deepEqual(views[0], views[1]);
  });

  it('gives codes that can be redeemed once', async () => {
    const spaceId = await newSpace(server);
    const ann = await join(server, spaceId, 'ann');
    const { code } = (await askForCode(server, spaceId, ann.token).expect(201)).body;
    await request(server.app).post('/api/tokens').send({ code }).expect(201);
    await request(server.app).post('/api/tokens').send({ code }).expect(401);
  });

  it("refuses anyone who isn't a member of the space", async () => {
    const spaceId = await newSpace(server);
    const other = await newSpace(server);
    const ann = await join(server, other, 'ann');
    await askForCode(server, spaceId).expect(401);
    await askForCode(server, spaceId, ann.token).expect(401);
  });
});

describe('without device pairing', () => {
  let server: CounterServer;
  before(async () => {
    server = await startCounterServer(counterRules());
  });
  after(() => server.close());

  it("doesn't serve the endpoint", async () => {
    const spaceId = await newSpace(server);
    const ann = await join(server, spaceId, 'ann');
    assert.deepEqual((await askForCode(server, spaceId, ann.token).expect(404)).body, {
      error: 'Endpoint not found',
    });
  });
});
