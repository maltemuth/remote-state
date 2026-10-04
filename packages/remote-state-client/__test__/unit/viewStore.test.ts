/**
 * The view store's ordering rules (decision 0044): stale updates are ignored,
 * patches for the next sequence are applied, and gaps or patches that don't apply
 * are caught up through the server, with updates from meanwhile applied after.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { type CatchUp, createViewStore } from '../../src/viewStore.js';

interface View {
  items: string[];
  other: { n: number };
}

const view = (...items: string[]): View => ({ items, other: { n: 0 } });
const add = (index: number, item: string) => [
  { op: 'add' as const, path: ['items', index], value: item },
];
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const storeWith = (catchUp: Partial<CatchUp<View>> = {}) => {
  const updates = jest.fn<CatchUp<View>['updates']>(catchUp.updates);
  const state = jest.fn<CatchUp<View>['state']>(catchUp.state);
  const errors: unknown[] = [];
  const store = createViewStore<View>({ updates, state }, error => errors.push(error));
  return { store, updates, state, errors };
};

describe('view store', () => {
  it('applies patches for the next sequence and ignores stale updates', () => {
    const { store, updates } = storeWith();
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 2, patches: add(1, 'b') });
    store.receive({ sequence: 2, patches: add(2, 'again') });
    store.receive({ sequence: 1, state: view('old') });
    expect(store.getSnapshot()).toEqual({ sequence: 2, view: view('a', 'b') });
    expect(updates).not.toHaveBeenCalled();
  });

  it('catches up after a gap, then applies what arrived meanwhile', async () => {
    const { store, updates } = storeWith({
      updates: async () => ({
        sequence: 4,
        patches: [...add(1, 'b'), ...add(2, 'c'), ...add(3, 'd')],
      }),
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 4, patches: add(3, 'd') });
    store.receive({ sequence: 5, patches: add(4, 'e') });
    expect(store.getSnapshot()?.sequence).toBe(1);
    await settle();
    expect(updates).toHaveBeenCalledWith(1);
    expect(store.getSnapshot()).toEqual({ sequence: 5, view: view('a', 'b', 'c', 'd', 'e') });
  });

  it("fetches the whole view when patches don't apply", async () => {
    const { store, state } = storeWith({
      state: async () => ({ sequence: 2, state: view('fresh') }),
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({
      sequence: 2,
      patches: [{ op: 'replace', path: ['missing', 'deep'], value: 1 }],
    });
    await settle();
    expect(state).toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ sequence: 2, view: view('fresh') });
  });

  it('reports a failed catch-up and recovers with the next whole view', async () => {
    const { store, errors } = storeWith({
      updates: async () => {
        throw new Error('offline');
      },
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 3, patches: add(1, 'c') });
    await settle();
    expect(errors).toEqual([new Error('offline')]);
    store.receive({ sequence: 4, state: view('back') });
    expect(store.getSnapshot()).toEqual({ sequence: 4, view: view('back') });
  });

  it('resolves waiters once their sequence is reached', async () => {
    const { store } = storeWith();
    const waited = store.waitFor(2);
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 2, patches: add(1, 'b') });
    expect((await waited).sequence).toBe(2);
    expect((await store.waitFor(1)).sequence).toBe(2);
  });
});
