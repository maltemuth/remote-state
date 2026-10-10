/**
 * One row per state of a game: `createGame` stores sequence 0, and every join or
 * accepted action appends the next. Full states are the record of a game; diffs
 * between them are computed when needed (decision 0050).
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';
import { Player } from './Player.js';

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

  /** Who caused this state; null for the initial state and system actions */
  @ManyToOne(() => Player, { nullable: true })
  player: Opt<Player> | null = null;

  /** The author's audience when they acted, or joined into; null without a player (0039) */
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
