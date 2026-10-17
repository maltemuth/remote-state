/**
 * The view store's ordering rules (decision 0044): stale updates are ignored,
 * patches for the next sequence are applied, and gaps or patches that don't apply
 * are caught up through the server, with updates from meanwhile applied after. A
 * server that went back replaces the view, on a reconnect or when catching up.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
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
  const updates = mock.fn<CatchUp<View>['updates']>(catchUp.updates);
  const state = mock.fn<CatchUp<View>['state']>(catchUp.state);
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
    assert.deepEqual(store.getSnapshot(), { sequence: 2, view: view('a', 'b') });
    assert.equal(updates.mock.callCount(), 0);
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
    assert.equal(store.getSnapshot()?.sequence, 1);
    await settle();
    assert.ok(updates.mock.calls.some(call => isDeepStrictEqual(call.arguments, [1])));
    assert.deepEqual(store.getSnapshot(), { sequence: 5, view: view('a', 'b', 'c', 'd', 'e') });
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
    assert.ok(state.mock.callCount() > 0);
    assert.deepEqual(store.getSnapshot(), { sequence: 2, view: view('fresh') });
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
    assert.deepEqual(errors, [new Error('offline')]);
    store.receive({ sequence: 4, state: view('back') });
    assert.deepEqual(store.getSnapshot(), { sequence: 4, view: view('back') });
  });

  it('resolves waiters once their sequence is reached', async () => {
    const { store } = storeWith();
    const waited = store.waitFor(2);
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 2, patches: add(1, 'b') });
    assert.equal((await waited).sequence, 2);
    assert.equal((await store.waitFor(1)).sequence, 2);
  });
});

describe('view store, catching up and closing', () => {
  it('still applies a whole view that arrived during a failed catch-up', async () => {
    let fail: (error: Error) => void = () => undefined;
    const { store } = storeWith({
      updates: () => new Promise((_resolve, reject) => (fail = reject)),
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 3, patches: add(1, 'c') });
    store.receive({ sequence: 4, state: view('reconnected') });
    fail(new Error('offline'));
    await settle();
    assert.deepEqual(store.getSnapshot(), { sequence: 4, view: view('reconnected') });
  });

  it('takes the view sent on a reconnect, also an earlier one, and goes on from it', () => {
    const { store, updates } = storeWith();
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 2, patches: add(1, 'lost') });
    store.receive({ sequence: 3, patches: add(2, 'lost too') });
    // The restarted server went back to 1, and the game went on differently
    store.receive({ sequence: 1, state: view('a'), reset: true });
    store.receive({ sequence: 2, patches: add(1, 'b') });
    assert.deepEqual(store.getSnapshot(), { sequence: 2, view: view('a', 'b') });
    assert.equal(updates.mock.callCount(), 0);
  });

  it('takes an earlier whole view when catching up, since the server went back', async () => {
    const { store } = storeWith({
      // Asked for updates since 3, which the server doesn't have; it answers with its view
      updates: async () => ({ sequence: 2, state: view('a', 'b') }),
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 2, patches: add(1, 'lost') });
    store.receive({ sequence: 3, patches: add(2, 'lost too') });
    store.receive({ sequence: 5, patches: add(3, 'gap') });
    await settle();
    assert.deepEqual(store.getSnapshot(), { sequence: 2, view: view('a', 'b') });
  });

  it('drops what arrived before a reconnect while catching up', async () => {
    const { store } = storeWith({
      updates: async () => ({ sequence: 3, patches: [...add(1, 'old'), ...add(2, 'history')] }),
    });
    store.receive({ sequence: 1, state: view('a') });
    store.receive({ sequence: 3, patches: add(2, 'history') });
    store.receive({ sequence: 4, patches: add(3, 'before the restart') });
    store.receive({ sequence: 2, state: view('a', 'new'), reset: true });
    store.receive({ sequence: 3, patches: add(2, 'after') });
    await settle();
    assert.deepEqual(store.getSnapshot(), { sequence: 3, view: view('a', 'new', 'after') });
  });

  it('rejects waiters and stops telling subscribers once closed', async () => {
    const { store } = storeWith();
    const seen: number[] = [];
    store.subscribe(({ sequence }) => seen.push(sequence));
    const waiting = store.waitFor(2);
    store.close(new Error('closed'));
    store.receive({ sequence: 2, state: view('late') });
    await assert.rejects(waiting, { message: 'closed' });
    await assert.rejects(store.waitFor(3), { message: 'closed' });
    assert.deepEqual(seen, []);
  });
});
