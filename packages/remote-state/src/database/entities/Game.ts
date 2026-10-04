/**
 * A game session. Everything else (players, states, diffs) belongs to one game;
 * what the game is about lives entirely in its states.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'games' })
export class Game {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
