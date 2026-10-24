/**
 * The client converges: in generated scenarios, clients in either format act in
 * turn, and each ends with the view `GET …/state` answers, after views with
 * strictly increasing sequences (0044).
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fc from 'fast-check';
import { ActionRejectedError, type Format, type RemoteStateClient } from '../../src/index.js';
import { type NotesAction, type NotesView } from '../helpers/notesRules.js';
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

  before(async () => {
    server = await startNotesServer();
  });
  after(() => server.close());

  it("ends every client at the server's view", { timeout: 600_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArbitrary, async ({ formats, steps }) => {
        const spaceId = await server.newSpace();
        const clients: RemoteStateClient<NotesView, NotesAction>[] = [];
        const seen: number[][] = [];
        try {
          for (const [index, format] of formats.entries()) {
            const client = await server.join(spaceId, `member-${index}`, format);
            const sequences: number[] = [];
            client.subscribe(({ sequence }) => sequences.push(sequence));
            clients.push(client);
            seen.push(sequences);
          }

          // One join per member after the initial state
          let latest = formats.length;
          for (const [member, action] of steps) {
            try {
              latest = (await clients[member].dispatch(action)).sequence;
            } catch (error) {
              if (!(error instanceof ActionRejectedError)) throw error;
            }
          }

          for (const [index, client] of clients.entries()) {
            const { view } = await client.waitFor(latest);
            const response = await fetch(`${server.baseUrl}/api/spaces/${spaceId}/state`, {
              headers: { Authorization: `Bearer ${client.session.token}` },
            });
            const current = (await response.json()) as { sequence: number; state: NotesView };
            assert.equal(current.sequence, latest);
            assert.deepEqual(view, current.state);
            assert.deepEqual(
              seen[index],
              [...seen[index]].sort((a, b) => a - b)
            );
            assert.equal(new Set(seen[index]).size, seen[index].length);
          }
        } finally {
          clients.forEach(client => client.close());
        }
      }),
      { numRuns: RUNS }
    );
  });
});
