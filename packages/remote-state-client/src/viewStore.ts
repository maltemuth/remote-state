/**
 * Keeps the player's current view and its sequence, and tells subscribers when it
 * changes (decision 0044). Updates at or before the current sequence are ignored;
 * patches for the next one are applied with Immer; after a gap, or patches that
 * don't apply, it catches up through the server and applies what arrived meanwhile.
 */

import { applyPatches, enablePatches, freeze } from 'immer';
import { type Patch, type Snapshot, type Update } from './types.js';

enablePatches();

export interface CatchUp<View> {
  /** Patches from the view at `since` to the latest one, or the whole latest view */
  updates: (
    since: number
  ) => Promise<{ sequence: number; patches: Patch[] } | { sequence: number; state: View }>;
  /** The whole latest view */
  state: () => Promise<{ sequence: number; state: View }>;
}

export interface ViewStore<View> {
  getSnapshot: () => Snapshot<View> | null;
  subscribe: (listener: (snapshot: Snapshot<View>) => void) => () => void;
  /** Resolves once the view has reached this sequence */
  waitFor: (sequence: number) => Promise<Snapshot<View>>;
  receive: (update: Update<View>) => void;
}

export const createViewStore = <View>(
  catchUp: CatchUp<View>,
  onError: (error: unknown) => void
): ViewStore<View> => {
  let current: Snapshot<View> | null = null;
  const listeners = new Set<(snapshot: Snapshot<View>) => void>();
  const waiting = new Set<{ sequence: number; resolve: (snapshot: Snapshot<View>) => void }>();
  let catchingUp = false;
  const arrivedMeanwhile: Update<View>[] = [];

  const set = (sequence: number, view: View) => {
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
          if (!current || result.sequence > current.sequence) set(result.sequence, result.state);
        } else if (current && result.sequence > current.sequence) {
          set(result.sequence, applyPatches(current.view, result.patches) as View);
        }
      } catch (error) {
        onError(error);
      } finally {
        catchingUp = false;
        const queued = arrivedMeanwhile.splice(0);
        // Without progress, replaying would only start the same catch-up again; the
        // next update, or the whole view on the next reconnect, tries again
        if (current?.sequence !== since) queued.forEach(receive);
      }
    })();
  };

  const receive = (update: Update<View>) => {
    if (catchingUp) {
      arrivedMeanwhile.push(update);
      return;
    }
    if (current && update.sequence <= current.sequence) return;
    if ('state' in update) {
      set(update.sequence, update.state);
      return;
    }
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
    set(update.sequence, view);
  };

  return {
    getSnapshot: () => current,
    subscribe: listener => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    waitFor: sequence =>
      current && current.sequence >= sequence
        ? Promise.resolve(current)
        : new Promise(resolve => waiting.add({ sequence, resolve })),
    receive,
  };
};
