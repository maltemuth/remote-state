# 0003. Ship with no known dependency vulnerabilities

Status: Accepted
Date: 2026-09-29

## Context

A dependency review found 35 `npm audit` findings, 2 of them critical. Most came from the database stack: `sqlite3` 5 pulled its native build tooling, including a vulnerable `tar`, into the runtime dependencies. After updating everything, 3 moderate findings remained, all through Sequelize 6's pinned `uuid` 8.

## Decision

`npm audit` must report 0 findings. When a dependency can't meet that on its own, replacing it is preferred over overriding its transitive dependencies.

## Alternatives considered

- **Accept findings that can't be exploited here.** The remaining `uuid` advisory affected functions Sequelize doesn't call, so it was harmless in practice. But judging each finding by hand doesn't scale, and it hides new findings among old ones.
- **npm `overrides`.** Forcing `uuid` 11 under Sequelize would have cleared the findings. It was rejected as a lasting approach: it forces versions a dependency wasn't released with, and it has to be repeated for every new advisory in an unmaintained dependency.

## Consequences

- This decision ruled out Sequelize 6, and Sequelize 7, whose SQLite package still pins `sqlite3` 5 ([0005](0005-mikro-orm.md)).
- Choosing a new dependency now includes auditing it first.
- A new advisory in an existing dependency has to be resolved, not waived.
