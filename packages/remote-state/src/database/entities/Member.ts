/**
 * Anyone admitted to a space, seated or watching (decisions 0020, 0024). A member is
 * identified within its space by the host's identity ID, which the library never
 * interprets.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';
import { Space } from './Space.js';

@Entity({ tableName: 'members' })
@Unique({ properties: ['space', 'identityId'] })
export class Member {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @ManyToOne(() => Space)
  space!: Space;

  /** Chosen by the host when admitting */
  @Property({ type: 'string' })
  identityId!: string;

  /** The audience set by the space, or null for the default audience (decision 0025) */
  @Property({ type: 'string', nullable: true })
  audience: Opt<string> | null = null;

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
