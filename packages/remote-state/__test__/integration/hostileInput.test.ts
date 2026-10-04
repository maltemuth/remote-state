/**
 * Hostile input: reserved keys such as `__proto__` in actions and states (dropped
 * from states, 0047), bodies
 * that are too large or not JSON, actions that aren't objects, malformed tokens,
 * codes and cursors, and handshakes with the wrong types. The server must answer
 * with a client error or the game's own answer, stay usable, and never change
 * `Object.prototype`.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { applyPatches, enablePatches } from 'immer';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import {
  createRemoteStateServer,
  type GamePlugin,
  type RemoteStateServer,
  type Logger,
  type PatchesEvent,
  type StateEvent,
} from '../../src/index.js';

enablePatches();

/** Stores whatever JSON a player sends, the worst case for reserved keys */
interface BagState {
  bag: unknown;
}
const bagGame: GamePlugin<BagState, { type: 'put'; bag: unknown }> = {
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

  beforeAll(async () => {
    server = await createRemoteStateServer(bagGame, { port: 0, logger });
    await server.startServer();
    url = `http://localhost:${server.port}`;
  });
  afterEach(() => {
    sockets.splice(0).forEach(socket => socket.disconnect());
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
  afterAll(() => server.close());

  const player = async () => {
    const gameId = await server.createGame({ bag: null });
    const code = await server.admit({ gameId, identity: { id: 'alice' } });
    const { body } = await request(url).post('/api/tokens').send({ code }).expect(201);
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${body.token}`);
    return {
      gameId,
      token: body.token as string,
      act: (payload: string) =>
        auth(request(url).post(`/api/games/${gameId}/actions`))
          .set('Content-Type', 'application/json')
          .send(payload),
      state: () => auth(request(url).get(`/api/games/${gameId}/state`)),
      updates: (since: string) =>
        auth(request(url).get(`/api/games/${gameId}/updates?since=${since}`)).redirects(0),
    };
  };

  it('drops reserved keys from states, so patches apply, and warns', async () => {
    const { gameId, token, act, state, updates } = await player();
    const socket = connect(url, {
      auth: { gameId, token },
      query: { format: 'immer' },
      transports: ['websocket'],
      reconnection: false,
    });
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
      expect(JSON.stringify(current.state)).not.toMatch(/__proto__|constructor/);
      const since = await updates(String(answer.sequence - 1)).expect(200);
      expect(JSON.stringify(since.body)).not.toMatch(/__proto__|constructor/);
      const reserved = /__proto__|constructor/.test(JSON.stringify(bag));
      expect(warnings.length - before).toBe(reserved ? 1 : 0);

      for (let i = 0; i < 100 && sequence < answer.sequence; i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      expect(view).toEqual(current.state);
    }
    expect(warnings[0]).toMatch(
      new RegExp(`^Dropped keys named __proto__ from the state of game ${gameId} at \\d+`)
    );
  });

  it('answers actions with reserved keys like any other', async () => {
    const { act } = await player();
    await act('{"action": {"__proto__": {"type": "put"}, "bag": 1}}').expect(400);
    await act('{"__proto__": {"action": {"type": "put", "bag": 1}}}').expect(400);
    await act(
      '{"action": {"type": "put", "bag": 1, "constructor": {"prototype": {"x": 1}}}}'
    ).expect(201);
  });

  it("answers actions that are not objects with the game's answer", async () => {
    const { act } = await player();
    for (const action of ['null', '42', '"put"', '[]', 'true']) {
      await act(`{"action": ${action}}`).expect(400, { error: 'Not a put' });
    }
    await act('{"action": {"type": "put", "bag": 1}}').expect(201);
  });

  it('rejects bodies that are too large or not JSON', async () => {
    const { act, gameId, token } = await player();
    const huge = JSON.stringify({ action: { type: 'put', bag: 'x'.repeat(200_000) } });
    const tooLarge = await act(huge);
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body).toEqual({ error: expect.any(String) });

    await request(url)
      .post(`/api/games/${gameId}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('{"action": {"type": "put", "bag": 1}}')
      .expect(400, { error: 'An action is required' });
  });

  it('rejects malformed tokens, codes and cursors', async () => {
    const { gameId, updates } = await player();
    for (const header of ['Bearer', 'Bearer ', 'Basic abc', `Bearer ${'x'.repeat(10_000)}`]) {
      await request(url).get(`/api/games/${gameId}/state`).set('Authorization', header).expect(401);
    }
    for (const code of [123, {}, [], null, '', 'x'.repeat(10_000)]) {
      const { status } = await request(url).post('/api/tokens').send({ code });
      expect([400, 401]).toContain(status);
    }
    for (const since of ['-1', '1.5', '1e3', ' 1', '', 'abc']) {
      expect((await updates(encodeURIComponent(since))).status).toBe(400);
    }
    // A number, but in the future
    expect((await updates('99999999999999999999')).status).toBe(404);
    await request(url)
      .get('/api/games/..%2F..%2Fetc/state')
      .set('Authorization', 'Bearer x')
      .expect(401);
  });

  it('refuses handshakes with the wrong types', async () => {
    const { gameId, token } = await player();
    const refusal = (auth: object, query: Record<string, string | string[]> = {}) => {
      const socket = connect(url, { auth, query, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      return new Promise<string>(resolve =>
        socket.once('connect_error', error => resolve(error.message))
      );
    };
    expect(await refusal({ gameId: { $ne: null }, token })).toMatch(/Invalid token/);
    expect(await refusal({ gameId, token: 12345 })).toMatch(/Invalid token/);
    expect(await refusal({ gameId: [gameId], token: [token] })).toMatch(/Invalid token/);
    expect(await refusal({ gameId, token }, { format: ['state', 'immer'] })).toMatch(
      /Unknown format/
    );
  });
});
