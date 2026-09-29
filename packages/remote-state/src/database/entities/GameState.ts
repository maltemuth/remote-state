import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';
import { Player } from './Player.js';

/**
 * One row per state of a game: the initial state has sequence 0, and every accepted
 * action appends the resulting state with the next sequence number.
 */
@Entity({ tableName: 'game_states' })
@Unique({ properties: ['game', 'sequence'] })
export class GameState {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Game)
  game!: Game;

  @Property({ type: 'integer' })
  sequence!: number;

  /** The full, unfiltered state */
  @Property({ type: 'json' })
  state!: unknown;

  /** Who caused this state; the creator for sequence 0 */
  @ManyToOne(() => Player)
  player!: Player;

  /** `initial`, or the action's `type` */
  @Property({ type: 'string' })
  actionType!: string;

  /** The action as the client sent it */
  @Property({ type: 'json' })
  actionData!: unknown;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
