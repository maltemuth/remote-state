/**
 * Test helpers acting as a host and as clients: start a server for any game (the
 * counter game by default), create games, admit and join players, and send actions.
 */

import { io, type ManagerOptions, type SocketOptions } from 'socket.io-client';
import request from 'supertest';
import {
  createRemoteStateServer,
  type GamePlugin,
  type RemoteStateServerOptions,
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
/** Any game's server, for the helpers that don't depend on the game */
type AnyServer = RemoteStateServer<unknown>;

export interface TestPlayer {
  playerId: string;
  token: string;
}

/** A standalone server on a free port, silent unless given a logger */
export const startServer = async <S, A, V>(
  plugin: GamePlugin<S, A, V>,
  options: RemoteStateServerOptions = {}
): Promise<RemoteStateServer<S>> => {
  const server = await createRemoteStateServer(plugin, {
    port: 0,
    logger: silentLogger,
    ...options,
  });
  await server.startServer();
  return server;
};

export const startCounterServer = (
  plugin: GamePlugin<CounterState, CounterAction, CounterView> = counterGame(),
  options: RemoteStateServerOptions = {}
): Promise<CounterServer> => startServer(plugin, options);

export const serverUrl = (server: AnyServer) => `http://localhost:${server.port}`;

/** A Socket.IO client over WebSocket only, which doesn't reconnect unless asked to */
export const openSocket = (
  url: string,
  auth: object,
  options: Partial<ManagerOptions & SocketOptions> = {}
) => io(url, { auth, transports: ['websocket'], reconnection: false, ...options });

export const newGame = (server: CounterServer) => server.createGame(initialCounterState());

/** Admit an identity as the host would, and redeem the code as its client would */
export const join = async (
  server: AnyServer,
  gameId: string,
  identityId: string,
  details: Record<string, unknown> = {}
): Promise<TestPlayer> => {
  const code = await server.admit({ gameId, identity: { id: identityId, ...details } });
  const response = await request(server.app).post('/api/tokens').send({ code }).expect(201);
  return { playerId: response.body.playerId, token: response.body.token };
};

export const sendAction = (server: AnyServer, gameId: string, token: string, action: unknown) =>
  request(server.app)
    .post(`/api/games/${gameId}/actions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action });

export const getState = (server: AnyServer, gameId: string, token: string) =>
  request(server.app).get(`/api/games/${gameId}/state`).set('Authorization', `Bearer ${token}`);

export const getUpdates = (server: AnyServer, gameId: string, token: string, since: unknown) =>
  request(server.app)
    .get(`/api/games/${gameId}/updates`)
    .query({ since: String(since) })
    .set('Authorization', `Bearer ${token}`)
    .redirects(0);
