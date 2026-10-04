/**
 * A player's credential. Only the token's hash is stored (decision 0017), and a
 * player can hold several tokens, one per redeemed code (decision 0019).
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Player } from './Player.js';

@Entity({ tableName: 'tokens' })
export class Token {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Player)
  player!: Player;

  /** SHA-256 of the token, hex-encoded */
  @Property({ type: 'string', unique: true })
  tokenHash!: string;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
