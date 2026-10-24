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

  const joinAs = async (spaceId: string, id: string, format?: Format) => {
    const client = await server.join(spaceId, id, format);
    clients.push(client as RemoteStateClient<unknown, unknown>);
    return client;
  };

  it('redeems a code once', async () => {
    const spaceId = await server.newSpace();
    const code = await server.admit(spaceId, 'alice');
    const session = await redeemCode(code, { baseUrl: server.baseUrl });
    const { memberId, token, ...rest } = session;
    assert.deepEqual(rest, { spaceId });
    assert.equal(typeof memberId, 'string');
    assert.equal(typeof token, 'string');
    const again = redeemCode(code, { baseUrl: server.baseUrl });
    await assert.rejects(again, RequestError);
    await assert.rejects(again, { status: 401 });
  });

  for (const format of ['immer', 'state'] as const)
    it(`keeps members in step with ${format} updates`, async () => {
      const spaceId = await server.newSpace();
      const alice = await joinAs(spaceId, 'alice', format);
      const bob = await joinAs(spaceId, 'bob', format);
      await bob.waitFor(2);

      const { sequence } = await alice.dispatch({ type: 'note', text: 'hello' });
      await alice.dispatch({ type: 'count' });
      assert.deepEqual((await alice.waitFor(sequence + 1)).view, {
        board: { count: 1 },
        mine: ['hello'],
      });
      assert.deepEqual((await bob.waitFor(sequence + 1)).view, { board: { count: 1 }, mine: [] });
      assert.deepEqual(alice.getConnection(), { status: 'connected' });
    });

  it('tells subscribers about every new view', async () => {
    const spaceId = await server.newSpace();
    const alice = await joinAs(spaceId, 'alice');
    await alice.waitFor(1);
    const seen: number[] = [];
    const unsubscribe = alice.subscribe(({ sequence }) => seen.push(sequence));
    await alice.waitFor((await alice.dispatch({ type: 'count' })).sequence);
    unsubscribe();
    await alice.waitFor((await alice.dispatch({ type: 'count' })).sequence);
    assert.deepEqual(seen, [2]);
  });

  it('keeps unchanged parts of the view, and freezes views', async () => {
    const spaceId = await server.newSpace();
    const alice = await joinAs(spaceId, 'alice');
    const before = (await alice.waitFor(1)).view;
    const after = (
      await alice.waitFor((await alice.dispatch({ type: 'note', text: 'x' })).sequence)
    ).view;
    assert.notEqual(after, before);
    assert.equal(after.board, before.board);
    assert.notEqual(after.mine, before.mine);
    assert.equal(Object.isFrozen(after.mine), true);
  });

  it("throws the space's reason for a rejected action", async () => {
    const spaceId = await server.newSpace();
    const alice = await joinAs(spaceId, 'alice');
    const sent = alice.dispatch({ type: 'bad' });
    await assert.rejects(sent, ActionRejectedError);
    await assert.rejects(sent, { message: 'Bad move' });
  });

  it('reports a refused connection', async () => {
    const spaceId = await server.newSpace();
    const client = createClient({
      session: { spaceId, memberId: 'nobody', token: 'wrong' },
      baseUrl: server.baseUrl,
    });
    clients.push(client);
    const refused = await new Promise<ConnectionState>(resolve =>
      client.onConnection(state => state.status === 'refused' && resolve(state))
    );
    assert.deepEqual(refused, { status: 'refused', error: 'Invalid token or space' });
    assert.equal(client.getSnapshot(), null);
    await assert.rejects(client.waitFor(1), {
      message: 'Connection refused: Invalid token or space',
    });
  });
});
