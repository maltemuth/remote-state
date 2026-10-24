/**
 * A space for testing timers and system actions: members arm and cancel named
 * timers, and only the system may fire them, which records the label it fired.
 */

import { SYSTEM, transition, type Rules } from '../../src/index.js';

export interface TimerState {
  fired: string[];
}

export type TimerAction =
  | { type: 'arm'; name: string; ms: number; label: string }
  | { type: 'cancel'; name: string }
  | { type: 'fire'; label: string };

export const timerRules: Rules<TimerState, TimerAction> = {
  validateAction: (_state, action, memberId) =>
    (action.type === 'fire') === (memberId === SYSTEM) || `${memberId} can't ${action.type}`,
  executeAction: (state, action) => {
    switch (action.type) {
      case 'arm':
        return transition(state, {
          schedule: [
            { name: action.name, in: action.ms, action: { type: 'fire', label: action.label } },
          ],
        });
      case 'cancel':
        return transition(state, { cancel: [action.name] });
      case 'fire':
        return { fired: [...state.fired, action.label] };
    }
  },
};
