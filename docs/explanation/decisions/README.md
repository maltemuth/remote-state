# Decisions

Records of design decisions: what was decided, in what context, and what was rejected. They explain why the project is the way it is. For how it currently behaves, see the [reference](../../reference/) and [Architecture](../architecture.md).

Records aren't edited after the fact, except to update their status. A decision that changes gets a new record, and the old one is marked as superseded.

| # | Decision | Status |
|---|---|---|
| [0001](0001-http-actions-socket-updates.md) | Actions over HTTP, updates over Socket.IO | Accepted |
| [0002](0002-node-24.md) | Require Node.js 24 | Accepted |
| [0003](0003-no-known-vulnerabilities.md) | Ship with no known dependency vulnerabilities | Accepted |
| [0004](0004-esm-with-jest.md) | ESM throughout, tested with Jest | Accepted |
| [0005](0005-mikro-orm.md) | MikroORM with standard decorators for the data layer | Accepted |
| [0006](0006-single-process.md) | Run as a single process for now | Accepted |

## Writing a record

Create `decisions/NNNN-short-title.md` with the next free number, and add it to the table above:

```markdown
# NNNN. <Decision, stated as a short phrase>

Status: Proposed | Accepted | Superseded by [NNNN](NNNN-title.md)
Date: YYYY-MM-DD

## Context

The situation and forces that made a decision necessary.

## Decision

What was decided, in a few sentences.

## Alternatives considered

Each serious alternative, and why it wasn't chosen.

## Consequences

What follows, good and bad, including what becomes harder.
```
