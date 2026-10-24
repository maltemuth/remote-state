/**
 * The contract between the library and your rules: the functions they provide,
 * and what they receive. Rules never see hosts, tokens, the transport or
 * deployment settings.
 */

import { type Transition } from './transition.js';

export type Awaitable<T> = T | Promise<T>;

/** `true` to accept an action, or the reason for rejecting it */
export type ActionValidationResult = true | string;

/** Who is joining: the library's new member ID, and the details the host passed to `admit` */
export interface JoiningMember {
  memberId: string;
  details: Record<string, unknown>;
}

/** A new state, optionally with audience changes and timers (see `transition`) */
export type StateResult<StateType, ActionType = unknown> =
  StateType | Transition<StateType, ActionType>;

export interface Rules<StateType, ActionType, ViewType = StateType> {
  /**
   * Accept an action, or return why it's rejected. Runs before `executeAction`.
   * `memberId` is `SYSTEM` for actions from timers and from the host's `dispatch`.
   */
  validateAction: (
    state: StateType,
    action: ActionType,
    memberId: string
  ) => Awaitable<ActionValidationResult>;

  /** The state after an accepted action. Must not modify `state`. */
  executeAction: (
    state: StateType,
    action: ActionType,
    memberId: string
  ) => Awaitable<StateResult<StateType, ActionType>>;

  /**
   * Add a new member to the space's state (decision 0026), or throw a `Refusal`
   * to refuse them. Without it, everyone admitted joins and the state is unchanged.
   */
  onJoin?: (
    state: StateType,
    member: JoiningMember
  ) => Awaitable<StateResult<StateType, ActionType>>;

  /**
   * Called for every stored space when the library starts on a database that
   * already has spaces (decision 0052). Pending timers were lost (0042): pause the
   * space, or schedule again what it needs. Return the state it was given to
   * record nothing. Runs as `SYSTEM`; an error is logged and leaves the space as
   * it was.
   */
  onRestart?: (state: StateType) => Awaitable<StateResult<StateType, ActionType>>;

  /**
   * Reduce the full state to what an audience may see (decision 0024). By default,
   * each member is an audience of their own, named by their member ID. Without
   * `view`, everyone sees the full state.
   */
  view?: (state: StateType, audience: string) => Awaitable<ViewType>;
}

/** Rules as the library handles them, whatever their types */
export type AnyRules = Rules<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
