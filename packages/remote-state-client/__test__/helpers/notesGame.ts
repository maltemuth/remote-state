/**
 * A small game for the client's tests: players raise a shared counter and keep
 * private notes. Each player sees the counter and only their own notes, so views
 * have a shared part and a private part.
 */

import type { GamePlugin } from '@malte.muth/remote-state';

export interface NotesState {
  board: { count: number };
  notes: Record<string, string[]>;
}

export type NotesAction = { type: 'count' } | { type: 'note'; text: string } | { type: 'bad' };

export interface NotesView {
  board: { count: number };
  mine: string[];
}

export const newNotesGame = (): NotesState => ({ board: { count: 0 }, notes: {} });

export const notesGame: GamePlugin<NotesState, NotesAction, NotesView> = {
  onJoin: (state, { playerId }) => ({ ...state, notes: { ...state.notes, [playerId]: [] } }),
  validateAction: (_state, action) => action.type !== 'bad' || 'Bad move',
  executeAction: (state, action, playerId) =>
    action.type === 'count'
      ? { ...state, board: { count: state.board.count + 1 } }
      : action.type === 'note'
        ? {
            ...state,
            notes: { ...state.notes, [playerId]: [...state.notes[playerId], action.text] },
          }
        : state,
  filterStateForAudience: (state, audience) => ({
    board: state.board,
    mine: state.notes[audience] ?? [],
  }),
};
