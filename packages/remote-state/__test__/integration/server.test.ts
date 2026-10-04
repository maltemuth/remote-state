/**
 * The standalone server's deployment options: the reported port, CORS, a
 * disabled socket, and a logger that receives the library's and MikroORM's output.
 */

import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { type Logger } from '../../src/index.js';
import { counterGame } from '../helpers/counterGame.js';
import { startCounterServer } from '../helpers/testServer.js';

describe('standalone server', () => {
  it('reports the port it listens on', async () => {
    const server = await startCounterServer();
    try {
      expect(server.port).toBeGreaterThan(0);
      await request(`http://localhost:${server.port}`).get('/health').expect(200);
    } finally {
      await server.close();
    }
    expect(server.server.listening).toBe(false);
  });

  it('applies the CORS options to the API', async () => {
    const server = await startCounterServer(counterGame(), {
      cors: { origin: 'https://games.example' },
    });
    try {
      const response = await request(server.app)
        .options('/api/tokens')
        .set('Origin', 'https://games.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(response.headers['access-control-allow-origin']).toBe('https://games.example');
    } finally {
      await server.close();
    }
  });

  it('can run without a socket', async () => {
    const server = await startCounterServer(counterGame(), { socket: false });
    try {
      await request(`http://localhost:${server.port}`)
        .get('/socket.io/?EIO=4&transport=polling')
        .expect(404);
    } finally {
      await server.close();
    }
  });

  it('logs through the given logger, including the database setup', async () => {
    const messages: string[] = [];
    const record = (message: string) => void messages.push(message);
    const logger: Logger = { debug: record, info: record, warn: record, error: record };
    const server = await startCounterServer(counterGame(), { logger });
    await server.close();
    expect(messages.some(message => message.includes('Created the schema'))).toBe(true);
    expect(messages.some(message => message.includes('listening'))).toBe(true);
  });
});
