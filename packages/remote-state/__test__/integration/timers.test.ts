/**
 * Server-initiated actions: named timers that fire as the system, replacing and
 * cancelling them, the host acting as the system (0040, 0041), and actions logged
 * and recorded with their author's audience (0039).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MikroORM } from '@mikro-orm/sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import request from 'supertest';
import {
  createRemoteStateServer,
  type Logger,
  type RemoteStateServer,
  UnknownGameError,
} from '../../src/index.js';
import { entities, GameState } from '../../src/database/entities/index.js';
import { waitUntil } from '../helpers/waitUntil.js';
import { type TimerAction, timerGame, type TimerState } from '../helpers/timerGame.js';

import { setTimeout as sleep } from 'timers/promises';

describe('timers', () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'remote-state-timers-'));
  const database = joinPath(directory, 'games.db');
  const logged: string[] = [];
  const record = (message: string) => void logged.push(message);
  const logger: Logger = { debug: () => undefined, info: record, warn: record, error: record };
  let server: RemoteStateServer<TimerState>;

  beforeAll(async () => {
    server = await createRemoteStateServer(timerGame, { port: 0, logger, database });
  });
  afterAll(async () => {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const newPlayer = async () => {
    const gameId = await server.createGame({ fired: [] });
    const code = await server.admit({ gameId, identity: { id: 'alice' } });
    const { body } = await request(server.app).post('/api/tokens').send({ code }).expect(201);
    const send = (action: TimerAction) =>
      request(server.app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${body.token}`)
        .send({ action });
    const fired = async () =>
      (
        await request(server.app)
          .get(`/api/games/${gameId}/state`)
          .set('Authorization', `Bearer ${body.token}`)
      ).body.state.fired;
    return { gameId, playerId: body.playerId as string, send, fired };
  };

  it('runs a due timer as the system', async () => {
    const { send, fired } = await newPlayer();
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'timeout' }).expect(201);
    expect(await fired()).toEqual([]);
    await waitUntil(async () => (await fired()).length > 0, 'the timer');
    expect(await fired()).toEqual(['timeout']);
  });

  it('replaces a timer scheduled again under the same name', async () => {
    const { send, fired } = await newPlayer();
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'first' }).expect(201);
    await send({ type: 'arm', name: 'turn', ms: 300, label: 'second' }).expect(201);
    await send({ type: 'arm', name: 'clock', ms: 300, label: 'clock' }).expect(201);
    await waitUntil(async () => (await fired()).length === 2, 'two timers');
    expect((await fired()).sort()).toEqual(['clock', 'second']);
  });

  it('drops a cancelled timer', async () => {
    const { send, fired } = await newPlayer();
    await send({ type: 'arm', name: 'turn', ms: 200, label: 'never' }).expect(201);
    await send({ type: 'cancel', name: 'turn' }).expect(201);
    // Nothing to wait for: give the timer time to fire if it weren't cancelled
    await sleep(300);
    expect(await fired()).toEqual([]);
  });

  it("doesn't let players act as the system", async () => {
    const { send } = await newPlayer();
    await send({ type: 'fire', label: 'cheat' }).expect(400);
  });

  it('lets the host act as the system', async () => {
    const { gameId, fired } = await newPlayer();
    expect(await server.act(gameId, { type: 'fire', label: 'host' })).toEqual({ sequence: 2 });
    expect(await server.act(gameId, { type: 'arm', name: 'x', ms: 1, label: 'x' })).toEqual({
      rejected: "system can't arm",
    });
    expect(await fired()).toEqual(['host']);
    await expect(server.act('nope', { type: 'fire', label: 'x' })).rejects.toThrow(
      UnknownGameError
    );
  });

  it('logs and records who acted, from which audience', async () => {
    const { gameId, playerId, send } = await newPlayer();
    await send({ type: 'arm', name: 'turn', ms: 1, label: 'late' }).expect(201);
    const fire = `fire by system in game ${gameId}, now at 3`;
    await waitUntil(() => logged.includes(fire), 'the timer');
    expect(logged).toContain(`arm by everyone:${playerId} in game ${gameId}, now at 2`);

    const orm = await MikroORM.init({ dbName: database, entities, debug: false });
    try {
      const rows = await orm.em
        .fork()
        .find(GameState, { game: gameId }, { orderBy: { sequence: 'asc' } });
      expect(rows.map(row => [row.actionType, row.player?.id ?? null, row.audience])).toEqual([
        ['initial', null, null],
        ['join', playerId, 'everyone'],
        ['arm', playerId, 'everyone'],
        ['fire', null, null],
      ]);
    } finally {
      await orm.close();
    }
  });
});
