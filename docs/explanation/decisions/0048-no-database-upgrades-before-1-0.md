# 0048. No database upgrades before 1.0

Status: Accepted
Date: 2026-10-04

## Context

Database files have been upgraded by MikroORM migrations since 0.3.0 ([0005](0005-mikro-orm.md)). Every schema change needs a migration, and testing upgrades needs databases from earlier versions as fixtures. Before 1.0, the schema still changes often, and no one depends on keeping stored games across library versions.

## Decision

Databases aren't upgraded before 1.0. The schema is generated from the entities when a database is new, and its version is stored as SQLite's `user_version`. A database with another version, or with tables but no version, as earlier versions created, is refused at startup with an `UnsupportedDatabaseError`, which tells the host to delete it. The version is raised whenever the entities' tables change.

The migrations, and the dependency on `@mikro-orm/migrations`, are removed.

## Alternatives considered

- **Keeping migrations** and testing upgrades from earlier versions. Costs a migration and a fixture per schema change, for databases no one needs to keep yet.
- **Recreating the schema silently** when the version differs. Deletes stored games without the host deciding to.

## Consequences

- Upgrading the library to a version with another schema means deleting the database files, and with them every game, player and token.
- Hosts can catch `UnsupportedDatabaseError` to delete the file themselves.
- Upgrades come back, as migrations or otherwise, before 1.0 is released.
