import request from 'supertest';
import { AddressInfo } from 'net';
import { io as connect, Socket } from 'socket.io-client';
import { describe, beforeAll, afterAll, afterEach, it, expect } from '@jest/globals';
import { createRemoteStateServer, RemoteStateServer } from '../../src/core/server.js';
import { GameStateUpdateEvent } from '../../src/core/socket.js';
import {
  counterGame,
  CounterAction,
  CounterPlayerState,
  CounterState,
} from '../helpers/counterGame.js';

describe('Socket.IO integration', () => {
  let server: RemoteStateServer<CounterState, CounterAction, CounterPlayerState>;
  let url: string;
  const sockets: Socket[] = [];

  const open = (auth: Record<string, string>) => {
    const socket = connect(url, { auth, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return socket;
  };

  const connected = (socket: Socket) =>
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });

  const rejected = (socket: Socket) =>
    new Promise<Error>((resolve, reject) => {
      socket.once('connect', () => reject(new Error('connection was accepted')));
      socket.once('connect_error', resolve);
    });

  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>(resolve => socket.once(event, resolve));

  const createGame = async () => {
    const owner = await request(server.app)
      .post('/api/games')
      .send({ playerName: 'Owner', gameName: 'Counter game' });
    const joiner = await request(server.app)
      .post(`/api/games/${owner.body.gameId}/players`)
      .send({ playerName: 'Joiner' });
    return {
      gameId: owner.body.gameId as string,
      owner: { playerId: owner.body.playerId as string, token: owner.body.token as string },
      joiner: { playerId: joiner.body.playerId as string, token: joiner.body.token as string },
    };
  };

  beforeAll(async () => {
    server = await createRemoteStateServer(counterGame(), 0);
    await server.startServer();
    url = `http://localhost:${(server.server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    sockets.splice(0).forEach(socket => socket.disconnect());
  });

  afterAll(async () => {
    await server.shutdown(false);
  });

  it('rejects an unknown token', async () => {
    const { gameId } = await createGame();
    const error = await rejected(open({ gameId, token: 'not-a-token' }));
    expect(error.message).toBe('Invalid player or game');
  });

  it('rejects a token from another game', async () => {
    const { gameId } = await createGame();
    const other = await createGame();
    await rejected(open({ gameId, token: other.owner.token }));
  });

  it('rejects a playerId that does not match the token', async () => {
    const { gameId, owner, joiner } = await createGame();
    await rejected(open({ gameId, token: owner.token, playerId: joiner.playerId }));
  });

  it('sends every player their own view of each new state', async () => {
    const { gameId, owner, joiner } = await createGame();
    const ownerSocket = open({ gameId, ...owner });
    const joinerSocket = open({ gameId, token: joiner.token });
    await Promise.all([connected(ownerSocket), connected(joinerSocket)]);

    const ownerUpdate = next<GameStateUpdateEvent<CounterPlayerState>>(
      ownerSocket,
      'game-state-update'
    );
    const joinerUpdate = next<GameStateUpdateEvent<CounterPlayerState>>(
      joinerSocket,
      'game-state-update'
    );
    await request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({ action: { type: 'increment' }, token: owner.token })
      .expect(201);

    expect(await ownerUpdate).toMatchObject({ gameId, sequence: 1, state: { count: 1, mine: 1 } });
    expect(await joinerUpdate).toMatchObject({ gameId, sequence: 1, state: { count: 1, mine: 0 } });
  });

  it('announces players joining and leaving', async () => {
    const { gameId, owner, joiner } = await createGame();
    const ownerSocket = open({ gameId, token: owner.token });
    await connected(ownerSocket);

    const joined = next(ownerSocket, 'player-joined');
    const joinerSocket = open({ gameId, token: joiner.token });
    expect(await joined).toEqual({ playerId: joiner.playerId, playerName: 'Joiner' });

    const left = next(ownerSocket, 'player-left');
    joinerSocket.disconnect();
    expect(await left).toEqual({ playerId: joiner.playerId });
  });

  it('delivers direct messages only to the addressed player', async () => {
    const { gameId, owner, joiner } = await createGame();
    const ownerSocket = open({ gameId, token: owner.token });
    const joinerSocket = open({ gameId, token: joiner.token });
    await Promise.all([connected(ownerSocket), connected(joinerSocket)]);

    let ownerReceived = false;
    ownerSocket.on('private-event', () => (ownerReceived = true));
    const received = next(joinerSocket, 'private-event');
    server.socketIOManager!.sendToPlayer(joiner.playerId, 'private-event', { secret: 42 });

    expect(await received).toEqual({ secret: 42 });
    expect(ownerReceived).toBe(false);
  });
});
