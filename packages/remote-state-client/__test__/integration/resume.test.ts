/**
 * The client when its page comes back (0062): it drops its connection and
 * connects again at once, ending with the server's current view; it does the same
 * when asked to reconnect, and not at all with `resumeAfter: null`.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { type ConnectionState, type Page } from '../../src/index.js';
import { type NotesServer, startNotesServer } from '../helpers/testServer.js';

/** A page that's been hidden for a long while, ready to be shown */
const hiddenPage = () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
  const window = new EventTarget();
  return {
    page: { document, window } as unknown as Page,
    show: () => {
      document.visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    },
  };
};

const reconnected = (statuses: ConnectionState['status'][]) =>
  new Promise<void>(resolve => {
    const check = setInterval(() => {
      if (statuses.includes('disconnected') && statuses.at(-1) === 'connected') {
        clearInterval(check);
        resolve();
      }
    }, 10);
  });

describe('client when its page resumes', () => {
  let server: NotesServer;
  before(async () => {
    server = await startNotesServer();
  });
  after(() => server.close());

  it('reconnects at once, and ends with the current view', async () => {
    const spaceId = await server.newSpace();
    const fake = hiddenPage();
    // Hidden for any time at all counts, so showing the page resumes it
    const alice = await server.join(spaceId, 'alice', undefined, {
      page: fake.page,
      resumeAfter: 0,
    });
    const bob = await server.join(spaceId, 'bob');
    const statuses: ConnectionState['status'][] = [];
    try {
      await alice.waitFor(0);
      alice.onConnection(({ status }) => statuses.push(status));
      fake.show();
      await reconnected(statuses);
      const { sequence } = await bob.dispatch({ type: 'count' });
      assert.deepEqual((await alice.waitFor(sequence)).view.board, { count: 1 });
    } finally {
      alice.close();
      bob.close();
    }
  });

  it('reconnects when asked to', async () => {
    const spaceId = await server.newSpace();
    const alice = await server.join(spaceId, 'alice', undefined, { resumeAfter: null });
    const statuses: ConnectionState['status'][] = [];
    try {
      await alice.waitFor(0);
      alice.onConnection(({ status }) => statuses.push(status));
      alice.reconnect();
      await reconnected(statuses);
    } finally {
      alice.close();
    }
  });

  it("doesn't watch the page with resumeAfter null", async () => {
    const spaceId = await server.newSpace();
    const fake = hiddenPage();
    const alice = await server.join(spaceId, 'alice', undefined, {
      page: fake.page,
      resumeAfter: null,
    });
    const statuses: ConnectionState['status'][] = [];
    try {
      await alice.waitFor(0);
      alice.onConnection(({ status }) => statuses.push(status));
      fake.show();
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.deepEqual(statuses, []);
    } finally {
      alice.close();
    }
  });
});
