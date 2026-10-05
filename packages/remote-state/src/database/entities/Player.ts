/**
 * Anyone admitted to a game, seated or watching (decisions 0020, 0024). A player is
 * identified within its game by the host's identity ID, which the library never
 * interprets.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';

@Entity({ tableName: 'players' })
@Unique({ properties: ['game', 'identityId'] })
export class Player {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Game)
  game!: Game;

  /** Chosen by the host when admitting */
  @Property({ type: 'string' })
  identityId!: string;

  /** The audience set by the game, or null for the default audience (decision 0025) */
  @Property({ type: 'string', nullable: true })
  audience: Opt<string> | null = null;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
