/**
 * A host for the client's tests: the notes game mounted under `/notes` of an
 * Express app, with its socket at `/notes/socket.io`, as the example server does,
 * and players joining it through the client.
 */

import express from 'express';
import { createServer } from 'http';
import { type AddressInfo } from 'net';
import { createRemoteState, silentLogger } from '@malte.muth/remote-state';
import { createClient, type Format, redeemCode } from '../../src/index.js';
import { type NotesAction, type NotesView, newNotesGame, notesGame } from './notesGame.js';

export interface NotesServerOptions {
  /** SQLite file, to restart on the same games; in memory by default */
  database?: string;
  /** 0, the default, picks a free port */
  port?: number;
}

export const startNotesServer = async ({ database, port = 0 }: NotesServerOptions = {}) => {
  const remote = await createRemoteState(notesGame, {
    database: database ?? ':memory:',
    logger: silentLogger,
    socket: { path: '/notes/socket.io' },
  });
  const app = express();
  app.use('/notes', remote.router);
  const server = createServer(app);
  remote.attach(server);
  await new Promise<void>(resolve => server.listen(port, resolve));
  const listening = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${listening}/notes`;

  return {
    baseUrl,
    port: listening,
    newGame: () => remote.createGame(newNotesGame()),
    admit: (gameId: string, id: string) => remote.admit({ gameId, identity: { id } }),
    /** Admit an identity and connect a client for it, as a player's browser would */
    join: async (gameId: string, id: string, format?: Format) =>
      createClient<NotesView, NotesAction>({
        session: await redeemCode(await remote.admit({ gameId, identity: { id } }), { baseUrl }),
        baseUrl,
        format,
      }),
    close: async () => {
      await remote.close();
      // fetch keeps connections alive, which would hold the server open
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
};

export type NotesServer = Awaited<ReturnType<typeof startNotesServer>>;
