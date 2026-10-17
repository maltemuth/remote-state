/**
 * The client against a real server mounted under a prefix: redeeming codes,
 * receiving views in both formats, sending actions, rejections, keeping unchanged
 * parts of a view, and a refused connection.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, afterEach } from 'node:test';
import {
  ActionRejectedError,
  type ConnectionState,
  createClient,
  type Format,
  redeemCode,
  type RemoteStateClient,
  RequestError,
} from '../../src/index.js';
import { type NotesServer, startNotesServer } from '../helpers/testServer.js';

describe('client', () => {
  let server: NotesServer;
  const clients: RemoteStateClient<unknown, unknown>[] = [];

  before(async () => {
    server = await startNotesServer();
  });
  afterEach(() => clients.splice(0).forEach(client => client.close()));
  after(() => server.close());

  const joinAs = async (gameId: string, id: string, format?: Format) => {
    const client = await server.join(gameId, id, format);
    clients.push(client as RemoteStateClient<unknown, unknown>);
    return client;
  };

  it('redeems a code once', async () => {
    const gameId = await server.newGame();
    const code = await server.admit(gameId, 'alice');
    const session = await redeemCode(code, { baseUrl: server.baseUrl });
    const { playerId, token, ...rest } = session;
    assert.deepEqual(rest, { gameId });
    assert.equal(typeof playerId, 'string');
    assert.equal(typeof token, 'string');
    const again = redeemCode(code, { baseUrl: server.baseUrl });
    await assert.rejects(again, RequestError);
    await assert.rejects(again, { status: 401 });
  });

  for (const format of ['immer', 'state'] as const)
    it(`keeps players in step with ${format} updates`, async () => {
      const gameId = await server.newGame();
      const alice = await joinAs(gameId, 'alice', format);
      const bob = await joinAs(gameId, 'bob', format);
      await bob.waitFor(2);

      const { sequence } = await alice.send({ type: 'note', text: 'hello' });
      await alice.send({ type: 'count' });
      assert.deepEqual((await alice.waitFor(sequence + 1)).view, {
        board: { count: 1 },
        mine: ['hello'],
      });
      assert.deepEqual((await bob.waitFor(sequence + 1)).view, { board: { count: 1 }, mine: [] });
      assert.deepEqual(alice.getConnection(), { status: 'connected' });
    });

  it('tells subscribers about every new view', async () => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice');
    await alice.waitFor(1);
    const seen: number[] = [];
    const unsubscribe = alice.subscribe(({ sequence }) => seen.push(sequence));
    await alice.waitFor((await alice.send({ type: 'count' })).sequence);
    unsubscribe();
    await alice.waitFor((await alice.send({ type: 'count' })).sequence);
    assert.deepEqual(seen, [2]);
  });

  it('keeps unchanged parts of the view, and freezes views', async () => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice');
    const before = (await alice.waitFor(1)).view;
    const after = (await alice.waitFor((await alice.send({ type: 'note', text: 'x' })).sequence))
      .view;
    assert.notEqual(after, before);
    assert.equal(after.board, before.board);
    assert.notEqual(after.mine, before.mine);
    assert.equal(Object.isFrozen(after.mine), true);
  });

  it("throws the game's reason for a rejected action", async () => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice');
    const sent = alice.send({ type: 'bad' });
    await assert.rejects(sent, ActionRejectedError);
    await assert.rejects(sent, { message: 'Bad move' });
  });

  it('reports a refused connection', async () => {
    const gameId = await server.newGame();
    const client = createClient({
      session: { gameId, playerId: 'nobody', token: 'wrong' },
      baseUrl: server.baseUrl,
    });
    clients.push(client);
    const refused = await new Promise<ConnectionState>(resolve =>
      client.onConnection(state => state.status === 'refused' && resolve(state))
    );
    assert.deepEqual(refused, { status: 'refused', error: 'Invalid token or game' });
    assert.equal(client.getSnapshot(), null);
    await assert.rejects(client.waitFor(1), {
      message: 'Connection refused: Invalid token or game',
    });
  });
});
