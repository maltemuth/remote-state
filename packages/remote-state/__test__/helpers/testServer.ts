/**
 * Test helpers acting as a host and as clients: start a server for the counter
 * game, create games, admit and join players, and send actions.
 */

import request from 'supertest';
import {
  createRemoteStateServer,
  type GamePlugin,
  type RemoteStateOptions,
  type RemoteStateServer,
  silentLogger,
} from '../../src/index.js';
import {
  counterGame,
  type CounterAction,
  type CounterState,
  type CounterView,
  initialCounterState,
} from './counterGame.js';

export type CounterServer = RemoteStateServer<CounterState>;

export interface TestPlayer {
  playerId: string;
  token: string;
}

export const startCounterServer = async (
  plugin: GamePlugin<CounterState, CounterAction, CounterView> = counterGame(),
  options: RemoteStateOptions = {}
): Promise<CounterServer> => {
  const server = await createRemoteStateServer(plugin, {
    port: 0,
    logger: silentLogger,
    ...options,
  });
  await server.startServer();
  return server;
};

export const serverUrl = (server: CounterServer) => `http://localhost:${server.port}`;

export const newGame = (server: CounterServer) => server.createGame(initialCounterState());

/** Admit an identity as the host would, and redeem the code as its client would */
export const join = async (
  server: CounterServer,
  gameId: string,
  identityId: string,
  details: Record<string, unknown> = {}
): Promise<TestPlayer> => {
  const code = await server.admit({ gameId, identity: { id: identityId, ...details } });
  const response = await request(server.app).post('/api/tokens').send({ code }).expect(201);
  return { playerId: response.body.playerId, token: response.body.token };
};

export const sendAction = (
  server: CounterServer,
  gameId: string,
  token: string,
  action: CounterAction
) =>
  request(server.app)
    .post(`/api/games/${gameId}/actions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action });

export const getState = (server: CounterServer, gameId: string, token: string) =>
  request(server.app).get(`/api/games/${gameId}/state`).set('Authorization', `Bearer ${token}`);

export const getUpdates = (server: CounterServer, gameId: string, token: string, since: unknown) =>
  request(server.app)
    .get(`/api/games/${gameId}/updates`)
    .query({ since: String(since) })
    .set('Authorization', `Bearer ${token}`)
    .redirects(0);
