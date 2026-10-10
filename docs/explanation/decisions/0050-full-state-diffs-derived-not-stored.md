# 0050. Full-state diffs are derived, not stored

Status: Accepted
Date: 2026-10-10

## Context

[0013](0013-store-full-state-diffs.md) stores the diff between the previous and the new full state with every state, for debugging, reviewing a game move by move, or replays. None of those exist. The only reader is a test that checks the diffs replay.

Every full state is stored as well, so each diff can be computed from two neighbouring rows at any time. Storing it costs a diff on every action, a JSON column per state, and one more copy of hidden information that has to be kept out of logs and away from clients.

## Decision

The full states stay the record of a game. The library no longer computes or stores full-state diffs; a feature that needs them computes them from the stored states when it's built.

## Alternatives considered

- **Keeping them for a snapshot every N actions,** the likely fix for storage growth in [Known limitations](../limitations.md). That fix stores diffs instead of most states, which changes the schema anyway; storing both until then buys nothing.

## Consequences

- One diff less per action, and one column less per state.
- Hidden information is stored once per state, not twice.
- Reviewing or replaying a game needs the stored states compared pairwise, which costs a diff per step at that time.
