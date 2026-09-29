import { Collection, type Opt } from '@mikro-orm/core';
import { Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Player } from './Player.js';

@Entity({ tableName: 'games' })
export class Game {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @Property({ type: 'string' })
  name!: string;

  @OneToMany(() => Player, player => player.game)
  players = new Collection<Player>(this);

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
