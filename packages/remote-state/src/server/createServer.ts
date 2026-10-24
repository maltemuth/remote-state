/**
 * A standalone Remote State server for one space: its own Express app and HTTP
 * server around the embeddable core. Hosts add their routes to `app`. It never
 * exits the process; the host decides when to.
 */

import express, { type Express } from 'express';
import { createServer, type Server as HTTPServer } from 'http';
import { consoleLogger } from '../logging/logger.js';
import { type Rules } from '../plugin/types.js';
import { createRemoteState, type RemoteState } from './createRemoteState.js';
import { type RemoteStateServerOptions } from './options.js';
import { refuseUnhandledUpgrades } from './refuseUpgrades.js';

export interface RemoteStateServer<StateType> extends Omit<RemoteState<StateType>, 'attach'> {
  app: Express;
  server: HTTPServer;
  /** The port listened on once started, also when 0 was requested; the requested port before */
  readonly port: number;
  /** Listen; resolves with the port */
  startServer: () => Promise<number>;
  /** Stop listening, disconnect clients and close the database */
  close: () => Promise<void>;
}

export const createRemoteStateServer = async <StateType, ActionType, ViewType>(
  plugin: Rules<StateType, ActionType, ViewType>,
  { port: requestedPort = 3000, ...options }: RemoteStateServerOptions = {}
): Promise<RemoteStateServer<StateType>> => {
  const logger = options.logger ?? consoleLogger();
  const remote = await createRemoteState(plugin, { ...options, logger });
  const app = express();
  app.use(remote.router);
  const server = createServer(app);
  if (options.socket !== false) remote.attach(server);
  refuseUnhandledUpgrades(
    server,
    options.socket === false ? null : (options.socket?.path ?? '/socket.io')
  );

  const listeningPort = () => {
    const address = server.address();
    return address && typeof address === 'object' ? address.port : requestedPort;
  };

  const startServer = () =>
    new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(requestedPort, () => {
        server.off('error', reject);
        logger.info(`Remote State server listening at http://localhost:${listeningPort()}`);
        resolve(listeningPort());
      });
    });

  const close = async () => {
    await remote.close();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close(err => (err ? reject(err) : resolve()))
      );
    }
  };

  return {
    app,
    server,
    get port() {
      return listeningPort();
    },
    router: remote.router,
    createSpace: remote.createSpace,
    admit: remote.admit,
    dispatch: remote.dispatch,
    startServer,
    close,
  };
};
