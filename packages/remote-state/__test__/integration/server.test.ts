import request from 'supertest';
import { Express } from 'express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { createRemoteStateServer, RemoteStateServer } from '../../src/core/server';
import {
  counterGame,
  CounterAction,
  CounterPlayerState,
  CounterState,
} from '../helpers/counterGame';

type CounterServer = RemoteStateServer<CounterState, CounterAction, CounterPlayerState>;

const createGame = async (server: { app: Express }) => {
  const owner = await request(server.app)
    .post('/api/games')
    .send({ playerName: 'Owner', gameName: 'Counter game' })
    .expect(201);
  const joiner = await request(server.app)
    .post(`/api/games/${owner.body.gameId}/players`)
    .send({ playerName: 'Joiner' })
    .expect(201);
  return {
    gameId: owner.body.gameId as string,
    owner: { id: owner.body.playerId as string, token: owner.body.token as string },
    joiner: { id: joiner.body.playerId as string, token: joiner.body.token as string },
  };
};

const increment = (server: { app: Express }, gameId: string, token: string) =>
  request(server.app)
    .post(`/api/games/${gameId}/actions`)
    .send({ action: { type: 'increment' }, token });

describe('Remote State HTTP API', () => {
  let server: CounterServer;

  beforeAll(async () => {
    server = await createRemoteStateServer(counterGame(), 0);
  });

  afterAll(async () => {
    await server.shutdown(false);
  });

  describe('GET state', () => {
    it('requires a token', async () => {
      const { gameId } = await createGame(server);
      await request(server.app).get(`/api/games/${gameId}/state/current`).expect(401);
    });

    it('rejects a token from another game', async () => {
      const { gameId } = await createGame(server);
      const other = await createGame(server);
      await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set('Authorization', `Bearer ${other.owner.token}`)
        .expect(401);
    });

    it('returns the latest state filtered for the authenticated player', async () => {
      const { gameId, owner, joiner } = await createGame(server);
      await increment(server, gameId, owner.token).expect(201);
      await increment(server, gameId, owner.token).expect(201);
      await increment(server, gameId, joiner.token).expect(201);

      const ownerView = await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(ownerView.body.sequence).toBe(3);
      expect(ownerView.body.state).toEqual({ count: 3, mine: 2 });

      const joinerView = await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .expect(200);
      expect(joinerView.body.state).toEqual({ count: 3, mine: 1 });
    });
  });

  describe('POST action', () => {
    it('responds with the state filtered for the acting player', async () => {
      const { gameId, owner } = await createGame(server);
      const response = await increment(server, gameId, owner.token).expect(201);
      expect(response.body).toEqual({ count: 1, mine: 1 });
    });

    it('accepts the token as a bearer header', async () => {
      const { gameId, owner } = await createGame(server);
      await request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ action: { type: 'increment' } })
        .expect(201);
    });

    it('returns the validation message for rejected actions', async () => {
      const { gameId, owner } = await createGame(server);
      const response = await request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .send({ action: { type: 'forbidden' }, token: owner.token })
        .expect(400);
      expect(response.body.error).toBe('Action forbidden is not allowed');
    });

    it('serializes concurrent actions on the same game', async () => {
      const { gameId, owner, joiner } = await createGame(server);
      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          increment(server, gameId, i % 2 ? owner.token : joiner.token)
        )
      );
      expect(responses.map(r => r.status)).toEqual(Array(20).fill(201));

      const final = await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(final.body.sequence).toBe(20);
      expect(final.body.state).toEqual({ count: 20, mine: 10 });
    });
  });

  describe('routing', () => {
    it('responds 404 for unknown API routes', async () => {
      const response = await request(server.app).get('/api/unknown').expect(404);
      expect(response.body.error).toBe('Endpoint not found');
    });

    it('lets the host app add routes outside /api after creation', async () => {
      server.app.get('/hello', (_req, res) => {
        res.send('hi');
      });
      await request(server.app).get('/hello').expect(200, 'hi');
    });
  });

  describe('POST game', () => {
    it('responds with 500 when the initial state cannot be created', async () => {
      const failing = await createRemoteStateServer(
        counterGame({ getInitialState: () => Promise.reject(new Error('boom')) }),
        0
      );
      try {
        const response = await request(failing.app)
          .post('/api/games')
          .send({ playerName: 'Owner', gameName: 'Broken' })
          .expect(500);
        expect(response.body.error).toBe('Internal server error');
      } finally {
        await failing.shutdown(false);
      }
    });
  });
});

describe('Remote State server without a state filter', () => {
  it('sends the full state', async () => {
    const server = await createRemoteStateServer<CounterState, CounterAction, CounterState>(
      { ...counterGame(), filterStateForPlayer: undefined },
      0
    );
    try {
      const { gameId, owner } = await createGame(server);
      const response = await increment(server, gameId, owner.token).expect(201);
      expect(response.body).toEqual({ count: 1, incrementedBy: [owner.id] });
    } finally {
      await server.shutdown(false);
    }
  });
});

describe('Remote State server startup', () => {
  it('keeps accepting actions after restarting on a persisted database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'remote-state-'));
    const configuration = { persistDatabase: true, databaseFilename: join(directory, 'games.db') };
    try {
      const first = await createRemoteStateServer(counterGame({}, configuration), 0);
      const { gameId, owner } = await createGame(first);
      await increment(first, gameId, owner.token).expect(201);
      await first.shutdown(false);

      const second = await createRemoteStateServer(counterGame({}, configuration), 0);
      try {
        await increment(second, gameId, owner.token).expect(201);
        const other = await createGame(second);
        await increment(second, other.gameId, other.owner.token).expect(201);
      } finally {
        await second.shutdown(false);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps the underlying database error as the cause', async () => {
    const failure = createRemoteStateServer(
      counterGame(
        {},
        { persistDatabase: true, databaseFilename: '/nonexistent-directory/games.db' }
      ),
      0
    );
    const error = await failure.catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Failed to initialize database');
    expect((error as Error).cause).toBeDefined();
  });
});
