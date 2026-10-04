/**
 * The client against a real server mounted under a prefix: redeeming codes,
 * receiving views in both formats, sending actions, rejections, keeping unchanged
 * parts of a view, and a refused connection.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ActionRejectedError,
  type ConnectionState,
  createClient,
  type Format,
  redeemCode,
  type RemoteStateClient,
  RequestError,
} from '../../src/index.js';
import { type NotesAction, type NotesView } from '../helpers/notesGame.js';
import { type NotesServer, startNotesServer } from '../helpers/testServer.js';

describe('client', () => {
  let server: NotesServer;
  const clients: RemoteStateClient<unknown, unknown>[] = [];

  beforeAll(async () => {
    server = await startNotesServer();
  });
  afterEach(() => clients.splice(0).forEach(client => client.close()));
  afterAll(() => server.close());

  const joinAs = async (gameId: string, id: string, format?: Format) => {
    const session = await redeemCode(await server.admit(gameId, id), { baseUrl: server.baseUrl });
    const client = createClient<NotesView, NotesAction>({
      session,
      baseUrl: server.baseUrl,
      format,
    });
    clients.push(client as RemoteStateClient<unknown, unknown>);
    return client;
  };

  it('redeems a code once', async () => {
    const gameId = await server.newGame();
    const code = await server.admit(gameId, 'alice');
    const session = await redeemCode(code, { baseUrl: server.baseUrl });
    expect(session).toEqual({ gameId, playerId: expect.any(String), token: expect.any(String) });
    const again = redeemCode(code, { baseUrl: server.baseUrl });
    await expect(again).rejects.toThrow(RequestError);
    await expect(again).rejects.toMatchObject({ status: 401 });
  });

  it.each(['immer', 'state'] as const)('keeps players in step with %s updates', async format => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice', format);
    const bob = await joinAs(gameId, 'bob', format);
    await bob.waitFor(2);

    const { sequence } = await alice.send({ type: 'note', text: 'hello' });
    await alice.send({ type: 'count' });
    expect((await alice.waitFor(sequence + 1)).view).toEqual({
      board: { count: 1 },
      mine: ['hello'],
    });
    expect((await bob.waitFor(sequence + 1)).view).toEqual({ board: { count: 1 }, mine: [] });
    expect(alice.getConnection()).toEqual({ status: 'connected' });
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
    expect(seen).toEqual([2]);
  });

  it('keeps unchanged parts of the view, and freezes views', async () => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice');
    const before = (await alice.waitFor(1)).view;
    const after = (await alice.waitFor((await alice.send({ type: 'note', text: 'x' })).sequence))
      .view;
    expect(after).not.toBe(before);
    expect(after.board).toBe(before.board);
    expect(after.mine).not.toBe(before.mine);
    expect(Object.isFrozen(after.mine)).toBe(true);
  });

  it("throws the game's reason for a rejected action", async () => {
    const gameId = await server.newGame();
    const alice = await joinAs(gameId, 'alice');
    const sent = alice.send({ type: 'bad' });
    await expect(sent).rejects.toThrow(ActionRejectedError);
    await expect(sent).rejects.toThrow('Bad move');
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
    expect(refused).toEqual({ status: 'refused', error: 'Invalid token or game' });
    expect(client.getSnapshot()).toBeNull();
  });
});
