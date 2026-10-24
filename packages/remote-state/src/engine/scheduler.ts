/**
 * Pending timers, in memory only (decision 0042): named per space, replaced when
 * scheduled again, dropped when cancelled (0041). When one is due, it's handed to
 * `onDue`, which runs it under the space's lock if it's still pending then.
 */

import { type TimerRequest } from '../plugin/transition.js';

/** Node's limit for a timeout, about 24.8 days */
const MAX_DELAY_MS = 2 ** 31 - 1;

export interface PendingTimer {
  spaceId: string;
  name: string;
  action: unknown;
}

export interface Scheduler {
  /** Apply what a transition scheduled and cancelled; call after it's recorded */
  apply: (spaceId: string, schedule: TimerRequest[], cancel: string[]) => void;
  /** Remove the timer if it's still the pending one with this name; false if not */
  claim: (timer: PendingTimer) => boolean;
  /** Drop every pending timer */
  close: () => void;
}

/** Reject timer requests a space shouldn't make, before anything is recorded */
export const checkTimerRequests = (requests: TimerRequest[], cancel: string[]) => {
  for (const name of cancel) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Timers to cancel are named by non-empty strings');
    }
  }
  for (const { name, in: delay } of requests) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('A timer needs a non-empty name');
    }
    if (!Number.isFinite(delay) || delay < 0 || delay > MAX_DELAY_MS) {
      throw new Error(`Timer ${name}: \`in\` must be between 0 and ${MAX_DELAY_MS} ms`);
    }
  }
};

export const createScheduler = (onDue: (timer: PendingTimer) => void): Scheduler => {
  const spaces = new Map<string, Map<string, { timer: PendingTimer; handle: NodeJS.Timeout }>>();
  const timersOf = (spaceId: string) => {
    if (!spaces.has(spaceId)) spaces.set(spaceId, new Map());
    return spaces.get(spaceId)!;
  };
  const drop = (spaceId: string, name: string) => {
    const timers = spaces.get(spaceId);
    const entry = timers?.get(name);
    if (!entry) return;
    clearTimeout(entry.handle);
    timers!.delete(name);
    if (timers!.size === 0) spaces.delete(spaceId);
  };

  return {
    apply: (spaceId, schedule, cancel) => {
      cancel.forEach(name => drop(spaceId, name));
      for (const { name, in: delay, action } of schedule) {
        drop(spaceId, name);
        const timer: PendingTimer = { spaceId, name, action };
        timersOf(spaceId).set(name, { timer, handle: setTimeout(() => onDue(timer), delay) });
      }
    },
    claim: timer => {
      if (spaces.get(timer.spaceId)?.get(timer.name)?.timer !== timer) return false;
      drop(timer.spaceId, timer.name);
      return true;
    },
    close: () => {
      for (const [spaceId, timers] of spaces)
        [...timers.keys()].forEach(name => drop(spaceId, name));
    },
  };
};
