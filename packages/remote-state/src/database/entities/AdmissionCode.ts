/**
 * A single-use, short-lived code issued by `admit`, which a client exchanges for a
 * token (decision 0020). Only the code's hash is stored.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Game } from './Game.js';

@Entity({ tableName: 'admission_codes' })
export class AdmissionCode {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Game)
  game!: Game;

  /** SHA-256 of the code, hex-encoded */
  @Property({ type: 'string', unique: true })
  codeHash!: string;

  @Property({ type: 'string' })
  identityId!: string;

  /** Identity details from the host, handed to the game's join hook */
  @Property({ type: 'json' })
  details!: Record<string, unknown>;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'datetime', nullable: true })
  usedAt: Opt<Date> | null = null;
}
