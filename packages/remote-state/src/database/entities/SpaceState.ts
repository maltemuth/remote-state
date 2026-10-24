/**
 * One row per state of a space: `createSpace` stores sequence 0, and every join or
 * accepted action appends the next. Full states are the record of a space; diffs
 * between them are computed when needed (decision 0050).
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Space } from './Space.js';
import { Member } from './Member.js';

@Entity({ tableName: 'space_states' })
@Unique({ properties: ['space', 'sequence'] })
export class SpaceState {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Space)
  space!: Space;

  @Property({ type: 'integer' })
  sequence!: number;

  /** The full, unfiltered state */
  @Property({ type: 'json' })
  state!: unknown;

  /** Who caused this state; null for the initial state and system actions */
  @ManyToOne(() => Member, { nullable: true })
  member: Opt<Member> | null = null;

  /** The author's audience when they acted, or joined into; null without a member (0039) */
  @Property({ type: 'string', nullable: true })
  audience: Opt<string> | null = null;

  /** `initial`, `join`, or the action's `type` */
  @Property({ type: 'string' })
  actionType!: string;

  /** The action as the client sent it, or null */
  @Property({ type: 'json', nullable: true })
  actionData: Opt<unknown> | null = null;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
