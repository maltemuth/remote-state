/**
 * Hostile input: reserved keys such as `__proto__` in actions and states (dropped
 * from states, 0047), bodies that are too large or not JSON, actions that aren't
 * objects, malformed tokens, codes and cursors, and handshakes with the wrong types. The server must answer
 * with a client error or the space's own answer, stay usable, and never change
 * `Object.prototype`.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, afterEach } from 'node:test';
import { applyPatches, enablePatches } from 'immer';
import { type Socket } from 'socket.io-client';
import request from 'supertest';
import {
  type Rules,
  type RemoteStateServer,
  type Logger,
  type PatchesEvent,
  type StateEvent,
} from '../../src/index.js';
import { join, openSocket, serverUrl, startServer } from '../helpers/testServer.js';
import { waitUntil } from '../helpers/waitUntil.js';

enablePatches();

/** Stores whatever JSON a member sends, the worst case for reserved keys */
interface BagState {
  bag: unknown;
}
const bagRules: Rules<BagState, { type: 'put'; bag: unknown }> = {
  validateAction: (_state, action) =>
    (typeof action === 'object' && action !== null && action.type === 'put') || 'Not a put',
  executeAction: (_state, action) => ({ bag: action.bag }),
};

const RESERVED_BAGS = [
  JSON.parse('{"__proto__": {"polluted": 1}}'),
  JSON.parse('{"__proto__": {"polluted": 2}}'),
  JSON.parse('{"constructor": {"prototype": {"polluted": 3}}}'),
  JSON.parse('{"a": {"__proto__": {"polluted": 4}}, "prototype": [1]}'),
  {},
];

describe('hostile input', () => {
  let server: RemoteStateServer<BagState>;
  let url: string;
  const sockets: Socket[] = [];
  const warnings: string[] = [];
  const ignore = () => undefined;
  const logger: Logger = {
    debug: ignore,
    info: ignore,
    warn: message => void warnings.push(message),
    error: ignore,
  };

  before(async () => {
    server = await startServer(bagRules, { logger });
    url = serverUrl(server);
  });
  afterEach(() => {
    sockets.splice(0).forEach(socket => socket.disconnect());
    assert.ok(!('polluted' in Object.prototype));
  });
  after(() => server.close());

  const member = async () => {
    const spaceId = await server.createSpace({ bag: null });
    const { token } = await join(server, spaceId, 'alice');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
    return {
      spaceId,
      token,
      act: (payload: string) =>
        auth(request(url).post(`/api/spaces/${spaceId}/actions`))
          .set('Content-Type', 'application/json')
          .send(payload),
      state: () => auth(request(url).get(`/api/spaces/${spaceId}/state`)),
      updates: (since: string) =>
        auth(request(url).get(`/api/spaces/${spaceId}/updates?since=${since}`)).redirects(0),
    };
  };

  it('drops reserved keys from states, so patches apply, and warns', async () => {
    const { spaceId, token, act, state, updates } = await member();
    const socket = openSocket(url, { spaceId, token }, { query: { format: 'immer' } });
    sockets.push(socket);
    let view: unknown;
    let sequence = -1;
    socket.on('state', (event: StateEvent) => ({ state: view, sequence } = event));
    socket.on('patches', (event: PatchesEvent) => {
      view = applyPatches(view as object, event.patches);
      sequence = event.sequence;
    });
    await new Promise(resolve => socket.once('state', resolve));

    for (const bag of RESERVED_BAGS) {
      const before = warnings.length;
      const { body: answer } = await act(JSON.stringify({ action: { type: 'put', bag } })).expect(
        201
      );
      const { body: current } = await state().expect(200);
      assert.doesNotMatch(JSON.stringify(current.state), /__proto__|constructor/);
      const since = await updates(String(answer.sequence - 1)).expect(200);
      assert.doesNotMatch(JSON.stringify(since.body), /__proto__|constructor/);
      const reserved = /__proto__|constructor/.test(JSON.stringify(bag));
      assert.equal(warnings.length - before, reserved ? 1 : 0);

      await waitUntil(() => sequence >= answer.sequence, 'the update');
      assert.deepEqual(view, current.state);
    }
    assert.match(
      warnings[0],
      new RegExp(`^Dropped keys named __proto__ from the state of space ${spaceId} at \\d+`)
    );
  });

  it('answers actions with reserved keys like any other', async () => {
    const { act } = await member();
    await act('{"action": {"__proto__": {"type": "put"}, "bag": 1}}').expect(400);
    await act('{"__proto__": {"action": {"type": "put", "bag": 1}}}').expect(400);
    await act(
      '{"action": {"type": "put", "bag": 1, "constructor": {"prototype": {"x": 1}}}}'
    ).expect(201);
  });

  it("answers actions that are not objects with the space's answer", async () => {
    const { act } = await member();
    for (const action of ['null', '42', '"put"', '[]', 'true']) {
      await act(`{"action": ${action}}`).expect(400, { error: 'Not a put' });
    }
    await act('{"action": {"type": "put", "bag": 1}}').expect(201);
  });

  it('rejects bodies that are too large or not JSON', async () => {
    const { act, spaceId, token } = await member();
    const huge = JSON.stringify({ action: { type: 'put', bag: 'x'.repeat(200_000) } });
    const tooLarge = await act(huge);
    assert.equal(tooLarge.status, 413);
    assert.deepEqual(Object.keys(tooLarge.body), ['error']);
    assert.equal(typeof tooLarge.body.error, 'string');

    await request(url)
      .post(`/api/spaces/${spaceId}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('{"action": {"type": "put", "bag": 1}}')
      .expect(400, { error: 'An action is required' });
  });

  it('rejects malformed tokens, codes and cursors', async () => {
    const { spaceId, updates } = await member();
    for (const header of ['Bearer', 'Bearer ', 'Basic abc', `Bearer ${'x'.repeat(10_000)}`]) {
      await request(url)
        .get(`/api/spaces/${spaceId}/state`)
        .set('Authorization', header)
        .expect(401);
    }
    for (const code of [123, {}, [], null, '', 'x'.repeat(10_000)]) {
      const { status } = await request(url).post('/api/tokens').send({ code });
      assert.ok([400, 401].includes(status));
    }
    for (const since of ['-1', '1.5', '1e3', ' 1', '', 'abc']) {
      assert.equal((await updates(encodeURIComponent(since))).status, 400);
    }
    // A number, but in the future
    assert.equal((await updates('99999999999999999999')).status, 404);
    await request(url)
      .get('/api/spaces/..%2F..%2Fetc/state')
      .set('Authorization', 'Bearer x')
      .expect(401);
  });

  it('refuses handshakes with the wrong types', async () => {
    const { spaceId, token } = await member();
    const refusal = (auth: object, query: Record<string, string | string[]> = {}) => {
      const socket = openSocket(url, auth, { query });
      sockets.push(socket);
      return new Promise<string>(resolve =>
        socket.once('connect_error', error => resolve(error.message))
      );
    };
    assert.match(await refusal({ spaceId: { $ne: null }, token }), /Invalid token/);
    assert.match(await refusal({ spaceId, token: 12345 }), /Invalid token/);
    assert.match(await refusal({ spaceId: [spaceId], token: [token] }), /Invalid token/);
    assert.match(
      await refusal({ spaceId, token }, { format: ['state', 'immer'] }),
      /Unknown format/
    );
  });
});
