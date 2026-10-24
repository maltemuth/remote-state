/**
 * A space session. Everything else (members, states, diffs) belongs to one space;
 * what the space is about lives entirely in its states.
 */

import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'spaces' })
export class Space {
  @PrimaryKey({ type: 'string' })
  id: Opt<string> = randomUUID();

  @Property({ type: 'datetime' })
  createdAt: Opt<Date> = new Date();
}
