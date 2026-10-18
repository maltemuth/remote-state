/**
 * The client with a server's transport options: checksums it checks (0059), and
 * MessagePack through the same Socket.IO parser on both ends (0060).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import msgpackParser from 'socket.io-msgpack-parser';
import { startNotesServer } from '../helpers/testServer.js';

describe('client transport options', () => {
  for (const [name, remote, client] of [
    ['checksums', { checksums: true }, {}],
    ['MessagePack', { socket: { parser: msgpackParser } }, { parser: msgpackParser }],
    [
      'compressed messages',
      { socket: { perMessageDeflate: { threshold: 0 } }, checksums: true },
      {},
    ],
  ] as const) {
    it(`keeps the view in step with ${name}`, async () => {
      const server = await startNotesServer({ remote });
      const gameId = await server.newGame();
      const errors: unknown[] = [];
      const alice = await server.join(gameId, 'alice', 'immer', {
        ...client,
        onError: error => errors.push(error),
      });
      const bob = await server.join(gameId, 'bob', 'immer', client);
      try {
        await bob.send({ type: 'count' });
        await alice.send({ type: 'note', text: 'mine' });
        const { sequence } = await bob.send({ type: 'count' });
        assert.deepEqual((await alice.waitFor(sequence)).view, {
          board: { count: 2 },
          mine: ['mine'],
        });
        assert.deepEqual(errors, []);
      } finally {
        alice.close();
        bob.close();
        await server.close();
      }
    });
  }
});
