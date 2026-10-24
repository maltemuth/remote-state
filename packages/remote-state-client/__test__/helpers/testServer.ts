/**
 * A host for the client's tests: the notes space mounted under `/notes` of an
 * Express app, with its socket at `/notes/socket.io`, as the example server does,
 * and members joining it through the client.
 */

import express from 'express';
import { createServer } from 'http';
import { type AddressInfo } from 'net';
import { createRemoteState, type RemoteStateOptions, silentLogger } from '@malte.muth/remote-state';
import { type ClientOptions, createClient, type Format, redeemCode } from '../../src/index.js';
import { type NotesAction, type NotesView, newNotesSpace, notesRules } from './notesRules.js';

export interface NotesServerOptions {
  /** SQLite file, to restart on the same spaces; in memory by default */
  database?: string;
  /** 0, the default, picks a free port */
  port?: number;
  /** More library options, such as `checksums` or the socket's parser */
  remote?: RemoteStateOptions;
}

export const startNotesServer = async ({
  database,
  port = 0,
  remote: more = {},
}: NotesServerOptions = {}) => {
  const remote = await createRemoteState(notesRules, {
    database: database ?? ':memory:',
    logger: silentLogger,
    ...more,
    socket: { path: '/notes/socket.io', ...(more.socket || {}) },
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
    newSpace: () => remote.createSpace(newNotesSpace()),
    admit: (spaceId: string, id: string) => remote.admit({ spaceId, identity: { id } }),
    /** Admit an identity and connect a client for it, as a member's browser would */
    join: async (
      spaceId: string,
      id: string,
      format?: Format,
      options: Partial<ClientOptions> = {}
    ) =>
      createClient<NotesView, NotesAction>({
        session: await redeemCode(await remote.admit({ spaceId, identity: { id } }), { baseUrl }),
        baseUrl,
        format,
        ...options,
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
