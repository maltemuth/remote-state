/**
 * The client across a server restart on the same database: it reports the lost
 * connection, reconnects by itself, keeps its session, and ends with the view the
 * restarted server has.
 */

import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { type ConnectionState } from '../../src/index.js';
import { startNotesServer } from '../helpers/testServer.js';

jest.setTimeout(20_000);

describe('client across a restart', () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'remote-state-client-restart-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it("reconnects by itself and ends with the restarted server's view", async () => {
    const database = joinPath(directory, 'notes.db');
    let server = await startNotesServer({ database });
    const gameId = await server.newGame();
    const alice = await server.join(gameId, 'alice');
    const bob = await server.join(gameId, 'bob');
    const statuses: ConnectionState['status'][] = [];
    alice.onConnection(({ status }) => statuses.push(status));
    try {
      await alice.waitFor((await alice.send({ type: 'note', text: 'before' })).sequence);

      await server.close();
      server = await startNotesServer({ database, port: server.port });

      // Bob acts on the restarted server with his old session
      const { sequence } = await bob.send({ type: 'count' });
      const { view } = await alice.waitFor(sequence);
      expect(view).toEqual({ board: { count: 1 }, mine: ['before'] });
      expect((await bob.waitFor(sequence)).view).toEqual({ board: { count: 1 }, mine: [] });
      // Connected, lost, then back, possibly with failed attempts while the server was down
      expect(statuses[0]).toBe('connected');
      expect(statuses).toContain('disconnected');
      expect(statuses.at(-1)).toBe('connected');
      expect(statuses).not.toContain('refused');
    } finally {
      alice.close();
      bob.close();
      await server.close();
    }
  });
});
