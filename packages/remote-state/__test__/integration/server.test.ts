/**
 * The standalone server's deployment options: the reported port, CORS, a
 * disabled socket, the diff, a logger that receives the library's and MikroORM's
 * output, and WebSocket upgrades that nothing handles.
 */

import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { describe, it } from 'node:test';
import request from 'supertest';
import { type Logger } from '../../src/index.js';
import { counterRules } from '../helpers/counterRules.js';
import { startCounterServer } from '../helpers/testServer.js';

describe('standalone server', () => {
  it('reports the port it listens on', async () => {
    const server = await startCounterServer();
    try {
      assert.ok(server.port > 0);
      await request(`http://localhost:${server.port}`).get('/api/health').expect(200, '');
    } finally {
      await server.close();
    }
    assert.equal(server.server.listening, false);
  });

  it('applies the CORS options to the API', async () => {
    const server = await startCounterServer(counterRules(), {
      cors: { origin: 'https://spaces.example' },
    });
    try {
      const response = await request(server.app)
        .options('/api/tokens')
        .set('Origin', 'https://spaces.example')
        .set('Access-Control-Request-Method', 'POST');
      assert.equal(response.headers['access-control-allow-origin'], 'https://spaces.example');
    } finally {
      await server.close();
    }
  });

  it('can run without a socket', async () => {
    const server = await startCounterServer(counterRules(), { socket: false });
    try {
      await request(`http://localhost:${server.port}`)
        .get('/socket.io/?EIO=4&transport=polling')
        .expect(404);
    } finally {
      await server.close();
    }
  });

  it("refuses a diff it doesn't know", async () => {
    await assert.rejects(
      startCounterServer(counterRules(), { diff: 'microdiff' as 'rfc6902' }),
      /Unknown diff microdiff; use one of positional, rfc6902/
    );
  });

  it('logs through the given logger, including the database setup', async () => {
    const messages: string[] = [];
    const record = (message: string) => void messages.push(message);
    const logger: Logger = { debug: record, info: record, warn: record, error: record };
    const server = await startCounterServer(counterRules(), { logger });
    await server.close();
    assert.equal(
      messages.some(message => message.includes('Created the schema')),
      true
    );
    assert.equal(
      messages.some(message => message.includes('listening')),
      true
    );
  });

  /** The status an upgrade request to `path` is answered with, or what happened instead */
  const upgrade = (port: number, path: string) =>
    new Promise<number | string>(resolve => {
      const req = httpRequest({
        port,
        path,
        headers: { Connection: 'Upgrade', Upgrade: 'websocket' },
      });
      req.on('response', response => resolve(response.statusCode!));
      req.on('upgrade', response => {
        response.socket.destroy();
        resolve(response.statusCode!);
      });
      req.on('error', err => resolve(err.message));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve('timeout');
      });
      req.end();
    });

  it('refuses upgrades for paths that nothing handles, with or without a socket', async () => {
    for (const socket of [undefined, false] as const) {
      const server = await startCounterServer(counterRules(), { socket });
      try {
        assert.equal(await upgrade(server.port, '/elsewhere'), 404);
      } finally {
        await server.close();
      }
    }
  });

  it('leaves upgrades to the host once it handles them', async () => {
    const server = await startCounterServer();
    server.server.on('upgrade', (_req, socket) =>
      socket.end(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          '',
          '',
        ].join('\r\n')
      )
    );
    try {
      assert.equal(await upgrade(server.port, '/elsewhere'), 101);
    } finally {
      await server.close();
    }
  });
});
