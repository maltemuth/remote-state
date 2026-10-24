/**
 * The history of a member's audience: one row when the member joins, and one for
 * every change. A member's audience at any sequence is the latest row at or before
 * it (decision 0024).
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Member } from './Member.js';

@Entity({ tableName: 'audience_memberships' })
@Index({ properties: ['member', 'sequence'] })
export class AudienceMembership {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Member)
  member!: Member;

  /** The sequence from which this audience applies */
  @Property({ type: 'integer' })
  sequence!: number;

  /** As on the member: null for the default audience */
  @Property({ type: 'string', nullable: true })
  audience: Opt<string> | null = null;
}
