/**
 * The client converges: in generated scenarios, clients in either format act in
 * turn, and each ends with the view `GET …/state` answers, after views with
 * strictly increasing sequences (0044).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import {
  ActionRejectedError,
  createClient,
  type Format,
  redeemCode,
  type RemoteStateClient,
} from '../../src/index.js';
import { type NotesAction, type NotesView } from '../helpers/notesGame.js';
import { type NotesServer, startNotesServer } from '../helpers/testServer.js';

const RUNS = Number(process.env.PROPERTY_RUNS ?? 25);

const actionArbitrary: fc.Arbitrary<NotesAction> = fc.oneof(
  fc.constant({ type: 'count' as const }),
  fc.nat(9).map(n => ({ type: 'note' as const, text: `note ${n}` })),
  fc.constant({ type: 'bad' as const })
);

const scenarioArbitrary = fc
  .array(fc.constantFrom<Format>('state', 'immer'), { minLength: 1, maxLength: 3 })
  .chain(formats =>
    fc.record({
      formats: fc.constant(formats),
      steps: fc.array(fc.tuple(fc.nat(formats.length - 1), actionArbitrary), { maxLength: 20 }),
    })
  );

describe('client convergence', () => {
  let server: NotesServer;

  beforeAll(async () => {
    server = await startNotesServer();
  });
  afterAll(() => server.close());

  it("ends every client at the server's view", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArbitrary, async ({ formats, steps }) => {
        const gameId = await server.newGame();
        const clients: RemoteStateClient<NotesView, NotesAction>[] = [];
        const seen: number[][] = [];
        try {
          for (const [index, format] of formats.entries()) {
            const code = await server.admit(gameId, `player-${index}`);
            const session = await redeemCode(code, { baseUrl: server.baseUrl });
            const client = createClient<NotesView, NotesAction>({
              session,
              baseUrl: server.baseUrl,
              format,
            });
            const sequences: number[] = [];
            client.subscribe(({ sequence }) => sequences.push(sequence));
            clients.push(client);
            seen.push(sequences);
          }

          // One join per player after the initial state
          let latest = formats.length;
          for (const [player, action] of steps) {
            try {
              latest = (await clients[player].send(action)).sequence;
            } catch (error) {
              if (!(error instanceof ActionRejectedError)) throw error;
            }
          }

          for (const [index, client] of clients.entries()) {
            const { view } = await client.waitFor(latest);
            const response = await fetch(`${server.baseUrl}/api/games/${gameId}/state`, {
              headers: { Authorization: `Bearer ${client.session.token}` },
            });
            const current = (await response.json()) as { sequence: number; state: NotesView };
            expect(current.sequence).toBe(latest);
            expect(view).toEqual(current.state);
            expect(seen[index]).toEqual([...seen[index]].sort((a, b) => a - b));
            expect(new Set(seen[index]).size).toBe(seen[index].length);
          }
        } finally {
          clients.forEach(client => client.close());
        }
      }),
      { numRuns: RUNS }
    );
  }, 600_000);
});
