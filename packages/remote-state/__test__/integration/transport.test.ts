/**
 * Transport options: checksums with every patch, by default, on the socket and from
 * `GET …/updates` (0059); MessagePack through Socket.IO's parser, and compressed
 * messages (0060).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyPatches, enablePatches } from 'immer';
import msgpackParser from 'socket.io-msgpack-parser';
import { type PatchesEvent, type StateEvent } from '../../src/index.js';
import { checksumOf } from '../../src/patches/checksum.js';
import {
  getState,
  getUpdates,
  join,
  newSpace,
  openSocket,
  sendAction,
  serverUrl,
  startCounterServer,
} from '../helpers/testServer.js';

enablePatches();

const next = <T>(socket: ReturnType<typeof openSocket>, event: string) =>
  new Promise<T>(resolve => socket.once(event, resolve));

describe('transport options', () => {
  it('sends the checksum of the view with every patch, by default', async () => {
    const server = await startCounterServer();
    const spaceId = await newSpace(server);
    const { token } = await join(server, spaceId, 'alice');
    const socket = openSocket(
      serverUrl(server),
      { spaceId, token },
      { query: { format: 'immer' } }
    );
    try {
      const { state, sequence } = await next<StateEvent>(socket, 'state');
      const patched = next<PatchesEvent>(socket, 'patches');
      await sendAction(server, spaceId, token, { type: 'increment' }).expect(201);
      const event = await patched;
      const view = applyPatches(state as object, event.patches);
      assert.equal(event.checksum, checksumOf(view));
      assert.deepEqual(view, (await getState(server, spaceId, token)).body.state);

      const caughtUp = (await getUpdates(server, spaceId, token, sequence).expect(200)).body;
      assert.equal(caughtUp.checksum, checksumOf(view));
      const none = (await getUpdates(server, spaceId, token, sequence + 1).expect(200)).body;
      assert.deepEqual([none.patches, none.checksum], [[], checksumOf(view)]);
    } finally {
      socket.disconnect();
      await server.close();
    }
  });

  it('sends no checksums when turned off', async () => {
    const server = await startCounterServer(undefined, { checksums: false });
    const spaceId = await newSpace(server);
    const { token } = await join(server, spaceId, 'alice');
    const socket = openSocket(
      serverUrl(server),
      { spaceId, token },
      { query: { format: 'immer' } }
    );
    try {
      const { sequence } = await next<StateEvent>(socket, 'state');
      const patched = next<PatchesEvent>(socket, 'patches');
      await sendAction(server, spaceId, token, { type: 'increment' }).expect(201);
      assert.equal('checksum' in (await patched), false);
      const caughtUp = (await getUpdates(server, spaceId, token, sequence).expect(200)).body;
      assert.equal('checksum' in caughtUp, false);
    } finally {
      socket.disconnect();
      await server.close();
    }
  });

  for (const [name, socketOptions] of [
    ['MessagePack', { parser: msgpackParser }],
    ['compressed messages', { perMessageDeflate: { threshold: 0 } }],
  ] as const) {
    it(`sends views and patches as ${name}`, async () => {
      const server = await startCounterServer(undefined, { socket: socketOptions });
      const spaceId = await newSpace(server);
      const { token } = await join(server, spaceId, 'alice');
      const parser = 'parser' in socketOptions ? { parser: socketOptions.parser } : {};
      const socket = openSocket(
        serverUrl(server),
        { spaceId, token },
        { query: { format: 'immer' }, ...parser }
      );
      try {
        const { state } = await next<StateEvent>(socket, 'state');
        // The WebSocket's negotiated extensions, from the `ws` client underneath
        const { ws } = socket.io.engine.transport as unknown as { ws: { extensions: string } };
        assert.equal(
          ws.extensions.includes('permessage-deflate'),
          'perMessageDeflate' in socketOptions
        );
        const patched = next<PatchesEvent>(socket, 'patches');
        await sendAction(server, spaceId, token, { type: 'increment' }).expect(201);
        assert.deepEqual(
          applyPatches(state as object, (await patched).patches),
          (await getState(server, spaceId, token)).body.state
        );
      } finally {
        socket.disconnect();
        await server.close();
      }
    });
  }
});
