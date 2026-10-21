/**
 * Noticing that a page has come back (decision 0062): a phone that slept, or a tab
 * that was in the background, may hold a connection that's dead, which Socket.IO
 * only notices when its ping times out, or one that's waiting out its backoff. When
 * the page is shown again after being hidden for a while, or the network comes back,
 * the client reconnects at once instead. A short switch between tabs doesn't count.
 * Outside a browser there's no page, and nothing to notice.
 */

/** The parts of an event target the client uses */
interface Events {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/** The parts of a browser's `document` and `window` the client watches */
export interface Page {
  document: Events & { visibilityState: string };
  window: Events;
}

/** How long a page has to be hidden before being shown again counts as a resume */
export const DEFAULT_RESUME_AFTER = 10_000;

/** The page the client runs in, if it runs in a browser */
export const browserPage = (): Page | undefined => {
  const { document, window } = globalThis as Partial<Page>;
  return document && window ? { document, window } : undefined;
};

/**
 * Calls `resume` when the page is shown again after being hidden for at least
 * `after` milliseconds, and when the network comes back. Returns a function that
 * stops watching.
 */
export const onResume = (
  page: Page | undefined,
  after: number,
  resume: () => void,
  now: () => number = Date.now
): (() => void) => {
  if (!page) return () => undefined;
  let hiddenSince: number | null = page.document.visibilityState === 'hidden' ? now() : null;
  const visibilityChanged = () => {
    if (page.document.visibilityState === 'hidden') {
      hiddenSince ??= now();
      return;
    }
    if (hiddenSince === null) return;
    const away = now() - hiddenSince;
    hiddenSince = null;
    if (away >= after) resume();
  };
  page.document.addEventListener('visibilitychange', visibilityChanged);
  page.window.addEventListener('online', resume);
  return () => {
    page.document.removeEventListener('visibilitychange', visibilityChanged);
    page.window.removeEventListener('online', resume);
  };
};
