/**
 * Lets the join hook and actions return audience changes alongside the new state
 * (decision 0027), without wrapping every plain state.
 */

const transitionMarker = Symbol('remote-state transition');

/** Player ID → new audience, or null to return to the default audience */
export type AudienceChanges = Record<string, string | null>;

export interface Transition<StateType> {
  readonly [transitionMarker]: true;
  state: StateType;
  audiences: AudienceChanges;
}

/** Return a new state together with audience changes for some of the game's players */
export const withAudiences = <StateType>(
  state: StateType,
  audiences: AudienceChanges
): Transition<StateType> => ({ [transitionMarker]: true, state, audiences });

/** Split what a game returned into the state and any audience changes */
export const unwrapTransition = <StateType>(
  result: StateType | Transition<StateType>
): { state: StateType; audiences: AudienceChanges } =>
  typeof result === 'object' && result !== null && transitionMarker in result
    ? { state: result.state, audiences: result.audiences }
    : { state: result as StateType, audiences: {} };
