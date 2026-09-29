import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { createRemoteStateServer, RemoteStateServer } from '../../src/core/server';
import { LogLevel } from '../../src';
import { ticTacToePlugin } from '../../../remote-state-example-server/src/games/tic-tac-toe/plugin';
import {
  TicTacToeAction,
  TicTacToeState,
} from '../../../remote-state-example-server/src/games/tic-tac-toe/types';

describe('Tic-Tac-Toe E2E', () => {
  let server: RemoteStateServer<TicTacToeState, TicTacToeAction, TicTacToeState>;

  const act = (gameId: string, token: string, action: TicTacToeAction) =>
    request(server.app).post(`/api/games/${gameId}/actions`).send({ action, token });

  const move = (gameId: string, token: string, row: number, col: number) =>
    act(gameId, token, { type: 'move', position: [row, col] });

  const stateFor = async (gameId: string, token: string) =>
    (
      await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.state as TicTacToeState;

  /** Create a game, register a second player, and seat both (owner as X) */
  const startGame = async () => {
    const owner = await request(server.app)
      .post('/api/games')
      .send({ playerName: 'Xavier', gameName: 'E2E game' })
      .expect(201);
    const { gameId } = owner.body;
    const joiner = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({ playerName: 'Olivia' })
      .expect(201);

    const x = { id: owner.body.playerId as string, token: owner.body.token as string };
    const o = { id: joiner.body.playerId as string, token: joiner.body.token as string };
    await act(gameId, x.token, { type: 'join' }).expect(201);
    await act(gameId, o.token, { type: 'join' }).expect(201);
    return { gameId: gameId as string, x, o };
  };

  beforeAll(async () => {
    server = await createRemoteStateServer(
      { ...ticTacToePlugin, serverConfiguration: { minimumLogLevel: LogLevel.error } },
      0
    );
  });

  afterAll(async () => {
    await server.shutdown(false);
  });

  it('waits for two seated players before accepting moves', async () => {
    const owner = await request(server.app)
      .post('/api/games')
      .send({ playerName: 'Xavier', gameName: 'E2E game' })
      .expect(201);
    const { gameId, token } = owner.body;

    const joined = await act(gameId, token, { type: 'join' }).expect(201);
    expect(joined.body.players.X).toBe(owner.body.playerId);
    expect(joined.body.status).toBe('waiting');

    const early = await move(gameId, token, 0, 0).expect(400);
    expect(early.body.error).toBe('Waiting for a second player');
  });

  it('seats the second player as O and starts the game', async () => {
    const { gameId, x, o } = await startGame();
    const state = await stateFor(gameId, x.token);
    expect(state.status).toBe('playing');
    expect(state.players).toEqual({ X: x.id, O: 'opponent' });
    expect((await stateFor(gameId, o.token)).players).toEqual({ X: 'opponent', O: o.id });
  });

  it('rejects a third player', async () => {
    const { gameId } = await startGame();
    const third = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({ playerName: 'Third' })
      .expect(201);
    const response = await act(gameId, third.body.token, { type: 'join' }).expect(400);
    expect(response.body.error).toBe('Both seats are taken');
  });

  it('enforces turn order and empty cells', async () => {
    const { gameId, x, o } = await startGame();

    expect((await move(gameId, o.token, 0, 0).expect(400)).body.error).toBe("It's X's turn");
    await move(gameId, x.token, 0, 0).expect(201);
    expect((await move(gameId, o.token, 0, 0).expect(400)).body.error).toBe(
      'Position is already occupied'
    );
    expect((await move(gameId, o.token, 3, 0).expect(400)).body.error).toBe(
      'Position must be [row, col] between 0-2'
    );
  });

  it('plays to a win and then rejects further moves', async () => {
    const { gameId, x, o } = await startGame();

    await move(gameId, x.token, 0, 0).expect(201);
    await move(gameId, o.token, 1, 0).expect(201);
    await move(gameId, x.token, 0, 1).expect(201);
    await move(gameId, o.token, 1, 1).expect(201);
    const winning = await move(gameId, x.token, 0, 2).expect(201);

    expect(winning.body.winner).toBe('X');
    expect(winning.body.status).toBe('finished');
    expect(winning.body.winLine.type).toBe('row');

    const final = await stateFor(gameId, o.token);
    expect(final.board[0]).toEqual(['X', 'X', 'X']);
    expect(final.winner).toBe('X');

    const late = await move(gameId, o.token, 2, 2).expect(400);
    expect(late.body.error).toBe('Game is already finished');
  });

  it('restarts with the same seats', async () => {
    const { gameId, x, o } = await startGame();
    await move(gameId, x.token, 1, 1).expect(201);

    const restarted = await act(gameId, o.token, { type: 'restart' }).expect(201);
    expect(restarted.body.board.flat().every((cell: string | null) => cell === null)).toBe(true);
    expect(restarted.body.status).toBe('playing');
    expect(restarted.body.currentPlayer).toBe('X');
  });
});
