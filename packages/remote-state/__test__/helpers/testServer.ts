/**
 * Test helpers acting as a host and as clients: start a server for any space (the
 * counter space by default), create spaces, admit and join members, and send actions.
 */

import { io, type ManagerOptions, type SocketOptions } from 'socket.io-client';
import request from 'supertest';
import {
  createRemoteStateServer,
  type Rules,
  type RemoteStateServerOptions,
  type RemoteStateServer,
  silentLogger,
} from '../../src/index.js';
import {
  counterRules,
  type CounterAction,
  type CounterState,
  type CounterView,
  initialCounterState,
} from './counterRules.js';

export type CounterServer = RemoteStateServer<CounterState>;
/** Any space's server, for the helpers that don't depend on the space */
type AnyServer = RemoteStateServer<unknown>;

export interface TestMember {
  memberId: string;
  token: string;
}

/** A standalone server on a free port, silent unless given a logger */
export const startServer = async <S, A, V>(
  plugin: Rules<S, A, V>,
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
  plugin: Rules<CounterState, CounterAction, CounterView> = counterRules(),
  options: RemoteStateServerOptions = {}
): Promise<CounterServer> => startServer(plugin, options);

export const serverUrl = (server: AnyServer) => `http://localhost:${server.port}`;

/** A Socket.IO client over WebSocket only, which doesn't reconnect unless asked to */
export const openSocket = (
  url: string,
  auth: object,
  options: Partial<ManagerOptions & SocketOptions> = {}
) => io(url, { auth, transports: ['websocket'], reconnection: false, ...options });

export const newSpace = (server: CounterServer) => server.createSpace(initialCounterState());

/** Admit an identity as the host would, and redeem the code as its client would */
export const join = async (
  server: AnyServer,
  spaceId: string,
  identityId: string,
  details: Record<string, unknown> = {}
): Promise<TestMember> => {
  const code = await server.admit({ spaceId, identity: { id: identityId, ...details } });
  const response = await request(server.app).post('/api/tokens').send({ code }).expect(201);
  return { memberId: response.body.memberId, token: response.body.token };
};

export const sendAction = (server: AnyServer, spaceId: string, token: string, action: unknown) =>
  request(server.app)
    .post(`/api/spaces/${spaceId}/actions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action });

export const getState = (server: AnyServer, spaceId: string, token: string) =>
  request(server.app).get(`/api/spaces/${spaceId}/state`).set('Authorization', `Bearer ${token}`);

export const getUpdates = (server: AnyServer, spaceId: string, token: string, since: unknown) =>
  request(server.app)
    .get(`/api/spaces/${spaceId}/updates`)
    .query({ since: String(since) })
    .set('Authorization', `Bearer ${token}`)
    .redirects(0);
