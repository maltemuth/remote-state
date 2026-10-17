/**
 * Server-initiated actions: named timers that fire as the system, replacing and
 * cancelling them, the host acting as the system (0040, 0041), and actions logged
 * and recorded with their author's audience (0039).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { setTimeout as sleep } from 'timers/promises';
import { type Logger, type RemoteStateServer, UnknownGameError } from '../../src/index.js';
import { GameState } from '../../src/database/entities/index.js';
import { tempDatabases, withOrm } from '../helpers/tempDatabase.js';
import { getState, join, sendAction, startServer } from '../helpers/testServer.js';
import { type TimerAction, timerGame, type TimerState } from '../helpers/timerGame.js';
import { waitUntil } from '../helpers/waitUntil.js';

describe('timers', () => {
  let server: RemoteStateServer<TimerState>;
  afterAll(() => server.close());
  const database = tempDatabases('timers')();
  const logged: string[] = [];
  const record = (message: string) => void logged.push(message);
  const logger: Logger = { debug: () => undefined, info: record, warn: record, error: record };

  beforeAll(async () => {
    server = await startServer(timerGame, { logger, database });
  });

  const newPlayer = async () => {
    const gameId = await server.createGame({ fired: [] });
    const { playerId, token } = await join(server, gameId, 'alice');
    const send = (action: TimerAction) => sendAction(server, gameId, token, action);
    const fired = async () => (await getState(server, gameId, token)).body.state.fired;
    return { gameId, playerId, send, fired };
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

    const rows = await withOrm(database, em =>
      em.find(GameState, { game: gameId }, { orderBy: { sequence: 'asc' } })
    );
    expect(rows.map(row => [row.actionType, row.player?.id ?? null, row.audience])).toEqual([
      ['initial', null, null],
      ['join', playerId, 'everyone'],
      ['arm', playerId, 'everyone'],
      ['fire', null, null],
    ]);
  });
});
