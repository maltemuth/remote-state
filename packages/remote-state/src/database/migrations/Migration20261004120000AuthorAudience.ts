/**
 * Adds the author's audience to every recorded state (decision 0039).
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20261004120000AuthorAudience extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `game_states` add column `audience` text null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_states` drop column `audience`;');
  }
}
