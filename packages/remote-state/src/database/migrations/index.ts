/**
 * Every schema migration, oldest first. Listed explicitly so nothing is looked up on
 * disk at runtime; each name is recorded in `mikro_orm_migrations`.
 */

import { Migration20261004000000Initial } from './Migration20261004000000Initial.js';

export const migrations = [
  { name: 'Migration20261004000000Initial', class: Migration20261004000000Initial },
];
