/**
 * Pairing another device from the client (0063): a player's client gets a code
 * for the player, another device redeems it, and both follow the same view.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { createClient, redeemCode } from '../../src/index.js';
import { type NotesServer, startNotesServer } from '../helpers/testServer.js';

describe('pairing a device', () => {
  let server: NotesServer;
  before(async () => {
    server = await startNotesServer({ remote: { devicePairing: true } });
  });
  after(() => server.close());

  it('lets another device follow the same view, as the same player', async () => {
    const gameId = await server.newGame();
    const laptop = await server.join(gameId, 'alice');
    const session = await redeemCode(await laptop.pairingCode(), { baseUrl: server.baseUrl });
    assert.equal(session.playerId, laptop.session.playerId);
    const phone = createClient({ session, baseUrl: server.baseUrl });
    try {
      const { sequence } = await laptop.send({ type: 'note', text: 'mine' });
      const seen = [laptop, phone].map(async client => (await client.waitFor(sequence)).view);
      const [onLaptop, onPhone] = await Promise.all(seen);
      assert.deepEqual(onPhone, onLaptop);
      assert.deepEqual((onPhone as { mine: string[] }).mine, ['mine']);
    } finally {
      laptop.close();
      phone.close();
    }
  });
});
