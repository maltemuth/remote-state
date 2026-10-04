/**
 * Initial SQLite schema for hosts, codes, tokens and audiences, generated from the
 * entities by MikroORM's schema generator. Replaces the 0.2.0 schema, which isn't
 * migrated.
 */

import { Migration } from '@mikro-orm/migrations';

const statements = [
  'create table `games` (`id` text not null primary key, `created_at` datetime not null);',

  'create table `players` (`id` text not null primary key, `game_id` text not null, `identity_id` text not null, `audience` text null, `last_activity_at` datetime null, `created_at` datetime not null, constraint `players_game_id_foreign` foreign key (`game_id`) references `games` (`id`));',
  'create index `players_game_id_index` on `players` (`game_id`);',
  'create unique index `players_game_id_identity_id_unique` on `players` (`game_id`, `identity_id`);',

  'create table `tokens` (`id` text not null primary key, `player_id` text not null, `token_hash` text not null, `created_at` datetime not null, constraint `tokens_player_id_foreign` foreign key (`player_id`) references `players` (`id`));',
  'create index `tokens_player_id_index` on `tokens` (`player_id`);',
  'create unique index `tokens_token_hash_unique` on `tokens` (`token_hash`);',

  'create table `admission_codes` (`id` text not null primary key, `game_id` text not null, `code_hash` text not null, `identity_id` text not null, `details` json not null, `expires_at` datetime not null, `used_at` datetime null, constraint `admission_codes_game_id_foreign` foreign key (`game_id`) references `games` (`id`));',
  'create index `admission_codes_game_id_index` on `admission_codes` (`game_id`);',
  'create unique index `admission_codes_code_hash_unique` on `admission_codes` (`code_hash`);',

  'create table `game_states` (`id` text not null primary key, `game_id` text not null, `sequence` integer not null, `state` json not null, `full_diff` json null, `player_id` text null, `action_type` text not null, `action_data` json null, `created_at` datetime not null, constraint `game_states_game_id_foreign` foreign key (`game_id`) references `games` (`id`), constraint `game_states_player_id_foreign` foreign key (`player_id`) references `players` (`id`) on delete set null);',
  'create index `game_states_game_id_index` on `game_states` (`game_id`);',
  'create index `game_states_player_id_index` on `game_states` (`player_id`);',
  'create unique index `game_states_game_id_sequence_unique` on `game_states` (`game_id`, `sequence`);',

  'create table `audience_diffs` (`id` text not null primary key, `game_id` text not null, `audience` text not null, `sequence` integer not null, `patches` json not null, constraint `audience_diffs_game_id_foreign` foreign key (`game_id`) references `games` (`id`));',
  'create index `audience_diffs_game_id_index` on `audience_diffs` (`game_id`);',
  'create unique index `audience_diffs_game_id_audience_sequence_unique` on `audience_diffs` (`game_id`, `audience`, `sequence`);',

  'create table `audience_memberships` (`id` text not null primary key, `player_id` text not null, `sequence` integer not null, `audience` text null, constraint `audience_memberships_player_id_foreign` foreign key (`player_id`) references `players` (`id`));',
  'create index `audience_memberships_player_id_index` on `audience_memberships` (`player_id`);',
  'create index `audience_memberships_player_id_sequence_index` on `audience_memberships` (`player_id`, `sequence`);',
];

const tables = [
  'audience_memberships',
  'audience_diffs',
  'game_states',
  'admission_codes',
  'tokens',
  'players',
  'games',
];

export class Migration20261004000000Initial extends Migration {
  override async up(): Promise<void> {
    statements.forEach(sql => this.addSql(sql));
  }

  override async down(): Promise<void> {
    tables.forEach(table => this.addSql(`drop table if exists \`${table}\`;`));
  }
}
