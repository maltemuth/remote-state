/**
 * The contract between the library and a game: the functions a game provides, and
 * what they receive. Games never see hosts, tokens or the transport.
 */

import { type RemoteStateServerConfiguration } from '../server/configuration.js';
import { type Transition } from './transition.js';

export type Awaitable<T> = T | Promise<T>;

/** `true` to accept an action, or the reason for rejecting it */
export type ActionValidationResult = true | string;

/** Who is joining: the library's new player ID, and the details the host passed to `admit` */
export interface JoiningPlayer {
  playerId: string;
  details: Record<string, unknown>;
}

/** A new state, optionally with audience changes (see `withAudiences`) */
export type StateResult<StateType> = StateType | Transition<StateType>;

export interface GamePlugin<StateType, ActionType, ViewType = StateType> {
  /** Accept an action, or return why it's rejected. Runs before `executeAction`. */
  validateAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => Awaitable<ActionValidationResult>;

  /** The state after an accepted action. Must not modify `state`. */
  executeAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => Awaitable<StateResult<StateType>>;

  /**
   * Add a new player to the game's state (decision 0026), or throw a `GameRefusal`
   * to refuse them. Without it, everyone admitted joins and the state is unchanged.
   */
  onJoin?: (state: StateType, player: JoiningPlayer) => Awaitable<StateResult<StateType>>;

  /**
   * Reduce the full state to what an audience may see (decision 0024). By default,
   * each player is an audience of their own, named by their player ID. Without a
   * filter, everyone sees the full state.
   */
  filterStateForAudience?: (state: StateType, audience: string) => Awaitable<ViewType>;

  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}

/** A plugin as the library handles it, independent of the game's types */
export type AnyGamePlugin = GamePlugin<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
