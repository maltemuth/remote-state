/**
 * Waits for something that happens asynchronously, such as a socket event or a due
 * timer, by polling instead of sleeping for a fixed time.
 */

import { setTimeout as sleep } from 'timers/promises';

export const waitUntil = async (condition: () => boolean | Promise<boolean>, what: string) => {
  for (let i = 0; i < 500; i++) {
    if (await condition()) return;
    await sleep(10);
  }
  throw new Error(`Timed out waiting for ${what}`);
};
