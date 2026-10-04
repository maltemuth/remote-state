/**
 * Audiences and views: which audience a player is in, and what an audience sees
 * (decisions 0024, 0025).
 */

import { type AnyGamePlugin } from './types.js';

/** The single default audience of games without a view filter */
export const EVERYONE = 'everyone';

/**
 * A player's audience: the one the game set, or the default. The default is one
 * audience per player when the game filters views, and everyone otherwise.
 */
export const effectiveAudience = (
  plugin: AnyGamePlugin,
  player: { id: string; audience: string | null }
): string => player.audience ?? (plugin.filterStateForAudience ? player.id : EVERYONE);

/** What an audience sees of a full state */
export const viewFor = async (
  plugin: AnyGamePlugin,
  state: unknown,
  audience: string
): Promise<unknown> =>
  plugin.filterStateForAudience ? await plugin.filterStateForAudience(state, audience) : state;
