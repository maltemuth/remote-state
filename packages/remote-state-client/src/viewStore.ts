/**
 * Keeps the player's current view and its sequence, and tells subscribers when it
 * changes (decision 0044). Updates at or before the current sequence are ignored;
 * patches for the next one are applied with Immer; after a gap, or patches that
 * don't apply, it catches up through the server and applies what arrived meanwhile.
 * The whole view sent on a (re)connect, and one fetched while catching up, replace
 * the view whatever its sequence: a restarted server may have gone back. Patches
 * with a checksum must lead to a view with that checksum; otherwise the client
 * reports a `ChecksumError` and fetches the whole view (0059).
 */

import { applyPatches, enablePatches, freeze } from 'immer';
import { checksumOf } from './checksum.js';
import { type Patch, type Snapshot, type Update } from './types.js';

enablePatches();

/** Patches didn't lead to the view the server has; the client fetched the whole view */
export class ChecksumError extends Error {
  constructor(readonly sequence: number) {
    super(`The view at ${sequence} doesn't match the server's checksum`);
    this.name = 'ChecksumError';
  }
}

export interface CatchUp<View> {
  /** Patches from the view at `since` to the latest one, or the whole latest view */
  updates: (
    since: number
  ) => Promise<
    { sequence: number; patches: Patch[]; checksum?: number } | { sequence: number; state: View }
  >;
  /** The whole latest view */
  state: () => Promise<{ sequence: number; state: View }>;
}

export interface ViewStore<View> {
  getSnapshot: () => Snapshot<View> | null;
  subscribe: (listener: (snapshot: Snapshot<View>) => void) => () => void;
  /** Resolves once the view has reached this sequence */
  waitFor: (sequence: number) => Promise<Snapshot<View>>;
  receive: (update: Update<View>) => void;
  /** No more updates will come: reject waiters, and stop telling subscribers */
  close: (reason: Error) => void;
}

export const createViewStore = <View>(
  catchUp: CatchUp<View>,
  onError: (error: unknown) => void
): ViewStore<View> => {
  let current: Snapshot<View> | null = null;
  const listeners = new Set<(snapshot: Snapshot<View>) => void>();
  const waiting = new Set<{
    sequence: number;
    resolve: (snapshot: Snapshot<View>) => void;
    reject: (reason: Error) => void;
  }>();
  let closedBy: Error | null = null;
  let catchingUp = false;
  const isReset = (update: Update<View>) => 'state' in update && update.reset === true;
  const arrivedMeanwhile: Update<View>[] = [];

  /** Whether a view built from patches has the checksum they came with, if any */
  const matches = (view: View, checksum: number | undefined, sequence: number) => {
    if (checksum === undefined || checksumOf(view) === checksum) return true;
    onError(new ChecksumError(sequence));
    return false;
  };

  const set = (sequence: number, view: View) => {
    if (closedBy) return;
    // Frozen, so no one can change a view that later patches apply to
    current = { sequence, view: freeze(view, true) };
    const snapshot = current;
    listeners.forEach(listener => listener(snapshot));
    for (const waiter of waiting) {
      if (waiter.sequence <= sequence) {
        waiting.delete(waiter);
        waiter.resolve(snapshot);
      }
    }
  };

  const startCatchingUp = (wholeState: boolean) => {
    catchingUp = true;
    const since = current?.sequence;
    void (async () => {
      try {
        const result =
          wholeState || since === undefined ? await catchUp.state() : await catchUp.updates(since);
        if ('state' in result) {
          // Updates wait while catching up, so the view is still at `since`: an earlier
          // whole view means the server went back, and it replaces this one too
          if (result.sequence !== since) set(result.sequence, result.state);
        } else if (current && result.sequence > current.sequence) {
          const view = applyPatches(current.view, result.patches) as View;
          if (matches(view, result.checksum, result.sequence)) set(result.sequence, view);
          else {
            const whole = await catchUp.state();
            set(whole.sequence, whole.state);
          }
        }
      } catch (error) {
        onError(error);
      } finally {
        catchingUp = false;
        const arrived = arrivedMeanwhile.splice(0);
        // A reset replaces everything that arrived before it
        const queued = arrived.slice(Math.max(0, arrived.findLastIndex(isReset)));
        // Without progress, replaying patches would only start the same catch-up
        // again; whole views still apply, and the next update tries again
        const progressed = current?.sequence !== since;
        queued.filter(update => progressed || 'state' in update).forEach(receive);
      }
    })();
  };

  const receive = (update: Update<View>) => {
    if (closedBy) return;
    if (catchingUp) {
      arrivedMeanwhile.push(update);
      return;
    }
    if ('state' in update) {
      if (!update.reset && current && update.sequence <= current.sequence) return;
      set(update.sequence, update.state);
      return;
    }
    if (current && update.sequence <= current.sequence) return;
    if (!current || update.sequence !== current.sequence + 1) {
      arrivedMeanwhile.push(update);
      startCatchingUp(false);
      return;
    }
    let view: View;
    try {
      view = applyPatches(current.view, update.patches) as View;
    } catch {
      startCatchingUp(true);
      return;
    }
    if (!matches(view, update.checksum, update.sequence)) {
      startCatchingUp(true);
      return;
    }
    set(update.sequence, view);
  };

  return {
    getSnapshot: () => current,
    subscribe: listener => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    waitFor: sequence => {
      if (current && current.sequence >= sequence) return Promise.resolve(current);
      if (closedBy) return Promise.reject(closedBy);
      return new Promise((resolve, reject) => waiting.add({ sequence, resolve, reject }));
    },
    receive,
    close: reason => {
      closedBy ??= reason;
      listeners.clear();
      waiting.forEach(waiter => waiter.reject(reason));
      waiting.clear();
    },
  };
};
