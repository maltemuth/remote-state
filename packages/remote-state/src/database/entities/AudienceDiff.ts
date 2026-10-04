/**
 * The change of one audience's view caused by one state transition, as Immer
 * patches (decisions 0012, 0014, 0024). Catch-up joins these per audience.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';

@Entity({ tableName: 'audience_diffs' })
@Unique({ properties: ['game', 'audience', 'sequence'] })
export class AudienceDiff {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Game)
  game!: Game;

  @Property({ type: 'string' })
  audience!: string;

  /** The sequence of the state this diff leads to */
  @Property({ type: 'integer' })
  sequence!: number;

  @Property({ type: 'json' })
  patches!: unknown;
}
