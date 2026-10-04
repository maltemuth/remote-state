/**
 * Lets the join hook and actions return more than a new state: audience changes
 * (decision 0027), and timers to schedule or cancel (0041), without wrapping every
 * plain state.
 */

const transitionMarker = Symbol('remote-state transition');

/** Player ID → new audience, or null to return to the default audience */
export type AudienceChanges = Record<string, string | null>;

/** Run `action` as the system in `in` milliseconds; a pending timer with the same name is replaced */
export interface TimerRequest<ActionType = unknown> {
  name: string;
  in: number;
  action: ActionType;
}

export interface TransitionChanges<ActionType = unknown> {
  audiences?: AudienceChanges;
  schedule?: TimerRequest<ActionType>[];
  /** Names of pending timers to drop */
  cancel?: string[];
}

export interface Transition<StateType, ActionType = unknown> {
  readonly [transitionMarker]: true;
  state: StateType;
  changes: TransitionChanges<ActionType>;
}

/** Return a new state together with audience changes and timers */
export const transition = <StateType, ActionType = unknown>(
  state: StateType,
  changes: TransitionChanges<ActionType>
): Transition<StateType, ActionType> => ({ [transitionMarker]: true, state, changes });

/** Return a new state together with audience changes for some of the game's players */
export const withAudiences = <StateType>(
  state: StateType,
  audiences: AudienceChanges
): Transition<StateType, never> => transition<StateType, never>(state, { audiences });

/** Split what a game returned into the state and its changes, with defaults */
export const unwrapTransition = <StateType>(
  result: StateType | Transition<StateType>
): { state: StateType; changes: Required<TransitionChanges> } => {
  const isTransition = typeof result === 'object' && result !== null && transitionMarker in result;
  const { state, changes } = isTransition
    ? (result as Transition<StateType>)
    : { state: result as StateType, changes: {} as TransitionChanges };
  return {
    state,
    changes: { audiences: {}, schedule: [], cancel: [], ...changes },
  };
};
