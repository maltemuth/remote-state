/**
 * A space for property tests, built to stress diffs and views: a list with inserts,
 * removals and reversals, a table with keys that need escaping in JSON Pointers,
 * secret notes per member, and members moving to and from the spectators. Members
 * see the public parts and their own notes; spectators see only the public parts.
 */

import { withAudiences, type Rules } from '../../src/index.js';

export interface ModelState {
  items: string[];
  table: Record<string, number>;
  /** Member ID → notes, which only that member sees */
  secrets: Record<string, string[]>;
  spectating: string[];
}

export type ModelAction =
  | { type: 'insert'; index: number; value: string }
  | { type: 'remove'; index: number }
  | { type: 'reverse' }
  | { type: 'set'; key: string; value: number }
  | { type: 'unset'; key: string }
  | { type: 'note'; text: string }
  | { type: 'spectate' }
  | { type: 'sit' }
  | { type: 'invalid' };

export interface ModelView {
  items: string[];
  table: Record<string, number>;
  spectating: string[];
  /** Null for spectators */
  mine: string[] | null;
}

export const SPECTATORS = 'spectators';

export const initialModelState = (): ModelState => ({
  items: [],
  table: {},
  secrets: {},
  spectating: [],
});

export const viewOf = (state: ModelState, audience: string): ModelView => ({
  items: state.items,
  table: state.table,
  spectating: state.spectating,
  mine: audience === SPECTATORS ? null : (state.secrets[audience] ?? []),
});

const at = (index: number, length: number) => (length === 0 ? 0 : index % length);

export const modelRules: Rules<ModelState, ModelAction, ModelView> = {
  onJoin: (state, { memberId }) => ({ ...state, secrets: { ...state.secrets, [memberId]: [] } }),
  validateAction: (state, action, memberId) => {
    if (action.type === 'invalid') return 'Invalid move';
    const spectating = state.spectating.includes(memberId);
    if (action.type === 'spectate' && spectating) return 'Already spectating';
    if (action.type === 'sit' && !spectating) return 'Already seated';
    return true;
  },
  executeAction: (state, action, memberId) => {
    switch (action.type) {
      case 'insert': {
        const items = [...state.items];
        items.splice(at(action.index, items.length + 1), 0, action.value);
        return { ...state, items };
      }
      case 'remove':
        return {
          ...state,
          items: state.items.filter((_, i) => i !== at(action.index, state.items.length)),
        };
      case 'reverse':
        return { ...state, items: [...state.items].reverse() };
      case 'set':
        return { ...state, table: { ...state.table, [action.key]: action.value } };
      case 'unset': {
        const { [action.key]: _, ...table } = state.table;
        return { ...state, table };
      }
      case 'note':
        return {
          ...state,
          secrets: { ...state.secrets, [memberId]: [...state.secrets[memberId], action.text] },
        };
      case 'spectate':
        return withAudiences(
          { ...state, spectating: [...state.spectating, memberId] },
          { [memberId]: SPECTATORS }
        );
      case 'sit':
        return withAudiences(
          { ...state, spectating: state.spectating.filter(id => id !== memberId) },
          { [memberId]: null }
        );
      default:
        return state;
    }
  },
  view: viewOf,
};
