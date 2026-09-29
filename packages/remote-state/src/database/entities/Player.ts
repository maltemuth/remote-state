import { type Opt } from '@mikro-orm/core';
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';

export type PlayerRole = 'admin' | 'player';

@Entity({ tableName: 'players' })
export class Player {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Game)
  game!: Game;

  @Property({ type: 'string' })
  name!: string;

  /** The game's creator is `admin` */
  @Enum({ items: ['admin', 'player'] })
  role!: PlayerRole;

  @Property({ type: 'string', unique: true })
  token!: string;

  /** Updated on each accepted action */
  @Property({ type: 'datetime', nullable: true })
  lastActivityAt: Opt<Date | null> = null;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
