/**
 * The history of a player's audience: one row when the player joins, and one for
 * every change. A player's audience at any sequence is the latest row at or before
 * it (decision 0024).
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Player } from './Player.js';

@Entity({ tableName: 'audience_memberships' })
@Index({ properties: ['player', 'sequence'] })
export class AudienceMembership {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Player)
  player!: Player;

  /** The sequence from which this audience applies */
  @Property({ type: 'integer' })
  sequence!: number;

  /** As on the player: null for the default audience */
  @Property({ type: 'string', nullable: true })
  audience: Opt<string> | null = null;
}
