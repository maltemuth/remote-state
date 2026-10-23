# 0005. MikroORM with standard decorators for the data layer

Status: Accepted; migrations dropped until 1.0 by [0048](0048-no-database-upgrades-before-1-0.md); npm runs `node-gyp rebuild` for `better-sqlite3` when installing from a lockfile, so installs use `--ignore-scripts` since [0064](0064-install-without-scripts.md)
Date: 2026-09-29

## Context

The data layer used Sequelize 6 with `sequelize-typescript`. This stack:

- had 3 remaining audit findings, which ruled it out under [0003](0003-no-known-vulnerabilities.md)
- depended on `sequelize-typescript`, last released in November 2023
- used legacy decorators with decorator metadata, which crashed under ESM
- had no schema migrations

The data layer itself is small: 3 tables, about 6 queries, and 2 transactions. Decorator-based entity definitions were preferred. Postgres support may be wanted later, so the replacement should include a database abstraction layer.

## Decision

Use MikroORM 7 with SQLite, through its `better-sqlite3` driver. Entities use standard (TC39) decorators with every property type written out, so they need neither `experimentalDecorators` nor decorator metadata. Migrations are listed in code and applied on startup.

## Alternatives considered

- **Sequelize 7.** Still in alpha since 2022, and its SQLite package pins `sqlite3` 5, which brought back 8 audit findings, 1 of them critical.
- **Kysely.** A typed query builder and database abstraction layer that MikroORM itself is built on. Thinner, with no entities or decorators.
- **Drizzle.** A lightweight ORM with schemas as code and generated migrations. No decorators.
- **Hand-written SQL on `node:sqlite`.** Zero dependencies, but no database abstraction, so Postgres would mean writing every query twice.
- **TypeORM.** Depends on decorator metadata, the same problem that crashed under ESM.

## Consequences

- `npm audit` reports 0 findings.
- Migrations exist, so database files survive schema changes. Databases created by 0.1.0 or earlier had to be deleted once.
- MikroORM brings a unit-of-work layer, which tracks loaded entities and writes changes back on flush, that this project barely needs. The database service uses a fresh entity manager per call to keep that simple.
- `better-sqlite3` is a native module, but ships prebuilt binaries, so no install script runs.
- Postgres is possible through the same ORM, but needs its own migrations, since the current ones are written in SQLite's SQL.
