/**
 * A host for the client's tests: the notes game mounted under `/notes` of an
 * Express app, with its socket at `/notes/socket.io`, as the example server does.
 */

import express from 'express';
import { createServer } from 'http';
import { type AddressInfo } from 'net';
import { createRemoteState, silentLogger } from '@malte.muth/remote-state';
import { newNotesGame, notesGame } from './notesGame.js';

export const startNotesServer = async () => {
  const remote = await createRemoteState(notesGame, {
    database: ':memory:',
    logger: silentLogger,
    socket: { path: '/notes/socket.io' },
  });
  const app = express();
  app.use('/notes', remote.router);
  const server = createServer(app);
  remote.attach(server);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/notes`;

  return {
    baseUrl,
    newGame: () => remote.createGame(newNotesGame()),
    admit: (gameId: string, id: string) => remote.admit({ gameId, identity: { id } }),
    close: async () => {
      await remote.close();
      await new Promise(resolve => server.close(resolve));
    },
  };
};

export type NotesServer = Awaited<ReturnType<typeof startNotesServer>>;
