/**
 * Audiences and views: which audience a member is in, and what an audience sees
 * (decisions 0024, 0025).
 */

import { toJson } from '../json.js';
import { type AnyRules } from './types.js';

/** The single default audience of spaces without a view filter */
export const EVERYONE = 'everyone';

/**
 * A member's audience: the one the space set, or the default. The default is one
 * audience per member when the space filters views, and everyone otherwise.
 */
export const effectiveAudience = (
  plugin: AnyRules,
  member: { id: string; audience: string | null }
): string => member.audience ?? (plugin.view ? member.id : EVERYONE);

/** What an audience sees of a full state, as plain JSON like everything that's diffed or sent */
export const viewFor = async (
  plugin: AnyRules,
  state: unknown,
  audience: string
): Promise<unknown> => (plugin.view ? toJson(await plugin.view(state, audience)) : state);
