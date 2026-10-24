/**
 * A small space for the client's tests: members raise a shared counter and keep
 * private notes. Each member sees the counter and only their own notes, so views
 * have a shared part and a private part.
 */

import type { Rules } from '@malte.muth/remote-state';

export interface NotesState {
  board: { count: number };
  notes: Record<string, string[]>;
}

export type NotesAction = { type: 'count' } | { type: 'note'; text: string } | { type: 'bad' };

export interface NotesView {
  board: { count: number };
  mine: string[];
}

export const newNotesSpace = (): NotesState => ({ board: { count: 0 }, notes: {} });

export const notesRules: Rules<NotesState, NotesAction, NotesView> = {
  onJoin: (state, { memberId }) => ({ ...state, notes: { ...state.notes, [memberId]: [] } }),
  validateAction: (_state, action) => action.type !== 'bad' || 'Bad move',
  executeAction: (state, action, memberId) =>
    action.type === 'count'
      ? { ...state, board: { count: state.board.count + 1 } }
      : action.type === 'note'
        ? {
            ...state,
            notes: { ...state.notes, [memberId]: [...state.notes[memberId], action.text] },
          }
        : state,
  view: (state, audience) => ({
    board: state.board,
    mine: state.notes[audience] ?? [],
  }),
};
