/**
 * `createClient`: one player's client for one game. It keeps the player's view in
 * step with the server, which anything can subscribe to (decision 0043), and sends
 * actions over HTTP. It's generic over the game's view and action types (0045), and
 * shows results only once the server has sent them (0033).
 */

import { connect } from './connection.js';
import { resolveEndpoints } from './endpoints.js';
import { RequestError, requestJson } from './http.js';
import { type Session } from './session.js';
import { type ConnectionState, type Format, type Patch, type Snapshot } from './types.js';
import { createViewStore, type CatchUp } from './viewStore.js';

export interface ClientOptions {
  session: Session;
  /** Where the game's library routes are mounted; the page's origin by default */
  baseUrl?: string;
  /** The socket's path; `<baseUrl's path>/socket.io` by default */
  socketPath?: string;
  /** What the socket sends; `immer` patches by default, applied by the client */
  format?: Format;
  fetch?: typeof fetch;
  /** Errors the client can't report anywhere else, such as a failed catch-up */
  onError?: (error: unknown) => void;
}

export interface RemoteStateClient<View, Action> {
  readonly session: Session;
  /** The latest view and its sequence, or null before the first one arrived */
  getSnapshot: () => Snapshot<View> | null;
  /** Called with every new view; returns a function that unsubscribes */
  subscribe: (listener: (snapshot: Snapshot<View>) => void) => () => void;
  /** Resolves once the view has reached this sequence, such as an action's */
  waitFor: (sequence: number) => Promise<Snapshot<View>>;
  /**
   * Send an action. Resolves with the sequence of the state it produced, which
   * arrives through `subscribe`. A rejected action throws an `ActionRejectedError`.
   */
  send: (action: Action) => Promise<{ sequence: number }>;
  getConnection: () => ConnectionState;
  onConnection: (listener: (state: ConnectionState) => void) => () => void;
  /** Disconnect for good */
  close: () => void;
}

/** The game rejected an action; `message` is its reason */
export class ActionRejectedError extends RequestError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ActionRejectedError';
  }
}

export const createClient = <View = unknown, Action = unknown>(
  options: ClientOptions
): RemoteStateClient<View, Action> => {
  const { session } = options;
  const fetchImpl = options.fetch ?? fetch;
  const endpoints = resolveEndpoints(options.baseUrl, options.socketPath);
  const game = (path: string) => endpoints.api(`/games/${session.gameId}${path}`);
  const get = <T>(path: string) => requestJson<T>(fetchImpl, game(path), { token: session.token });

  const catchUp: CatchUp<View> = {
    state: () => get('/state'),
    updates: async since => {
      try {
        // A 303 to the state is followed, so the answer can be a whole view
        return await get<
          { sequence: number; patches: Patch[] } | { sequence: number; state: View }
        >(`/updates?since=${since}`);
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) return catchUp.state();
        throw error;
      }
    },
  };
  const store = createViewStore(catchUp, options.onError ?? (() => undefined));

  let connection: ConnectionState = { status: 'connecting' };
  const connectionListeners = new Set<(state: ConnectionState) => void>();
  const socket = connect<View>({
    endpoints,
    session,
    format: options.format ?? 'immer',
    onUpdate: store.receive,
    onState: state => {
      connection = state;
      connectionListeners.forEach(listener => listener(state));
    },
  });

  return {
    session,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    waitFor: store.waitFor,
    send: async action => {
      try {
        return await requestJson<{ sequence: number }>(fetchImpl, game('/actions'), {
          method: 'POST',
          body: { action },
          token: session.token,
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 400) {
          throw new ActionRejectedError(error.message);
        }
        throw error;
      }
    },
    getConnection: () => connection,
    onConnection: listener => {
      connectionListeners.add(listener);
      return () => void connectionListeners.delete(listener);
    },
    close: socket.close,
  };
};
