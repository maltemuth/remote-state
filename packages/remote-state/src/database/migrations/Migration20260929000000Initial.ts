import { Migration } from '@mikro-orm/migrations';

/** Initial SQLite schema, generated from the entities by MikroORM's schema generator */
export class Migration20260929000000Initial extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table `games` (`id` text not null primary key, `name` text not null, `created_at` datetime not null, `updated_at` datetime not null);'
    );

    this.addSql(
      "create table `players` (`id` text not null primary key, `game_id` text not null, `name` text not null, `role` text check (`role` in ('admin', 'player')) not null, `token` text not null, `last_activity_at` datetime null, `created_at` datetime not null, `updated_at` datetime not null, constraint `players_game_id_foreign` foreign key (`game_id`) references `games` (`id`));"
    );
    this.addSql('create index `players_game_id_index` on `players` (`game_id`);');
    this.addSql('create unique index `players_token_unique` on `players` (`token`);');

    this.addSql(
      'create table `game_states` (`id` text not null primary key, `game_id` text not null, `sequence` integer not null, `state` json not null, `player_id` text not null, `action_type` text not null, `action_data` json not null, `created_at` datetime not null, constraint `game_states_game_id_foreign` foreign key (`game_id`) references `games` (`id`), constraint `game_states_player_id_foreign` foreign key (`player_id`) references `players` (`id`));'
    );
    this.addSql('create index `game_states_game_id_index` on `game_states` (`game_id`);');
    this.addSql('create index `game_states_player_id_index` on `game_states` (`player_id`);');
    this.addSql(
      'create unique index `game_states_game_id_sequence_unique` on `game_states` (`game_id`, `sequence`);'
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `game_states`;');
    this.addSql('drop table if exists `players`;');
    this.addSql('drop table if exists `games`;');
  }
}
