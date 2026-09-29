# 0019. A player can have several tokens

Status: Accepted
Date: 2026-09-29

## Context

The library stores only a hash of each token ([0017](0017-hashed-tokens-in-header-and-handshake.md)), so it can never hand out a player's existing token again. Whenever a player needs a token after the first one, on another device, in another browser, or after losing it, the library has to create a new one. Either the new token replaces the old one, or both stay valid.

## Decision

A player can have several tokens at the same time. Issuing a new token for a player adds it; existing tokens stay valid.

Whether the host can limit this, for example to one token per player, is left for later.

## Alternatives considered

- **One token per player, replaced when a new one is issued.** Keeps today's schema, and a lost or leaked token is replaced automatically. But playing on a second device logs out the first, and a player can't use two devices at once.

## Consequences

- One person can play the same seat on several devices or browsers at once.
- Tokens move from a column on the player to their own table, with a migration.
- A leaked token isn't invalidated by issuing a new one. Until revocation exists ([0018](0018-no-token-expiration-or-revocation.md)), it stays valid for as long as its player exists.
- Revoking a single device's token later is possible, since each token is its own record.
