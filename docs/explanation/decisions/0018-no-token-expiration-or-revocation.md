# 0018. Tokens don't expire and can't be revoked

Status: Accepted for now; to be revisited when a game or host needs it
Date: 2026-09-29

## Context

Tokens are opaque and looked up in the database ([0015](0015-library-issues-opaque-tokens.md)), so expiring or revoking one would be a database change. But each needs answers that don't exist yet: when a token of an unfinished game should expire, who may revoke a token now that authorization is the implementer's job ([0016](0016-authentication-in-library-authorization-by-implementer.md)), and what happens to a socket that's connected with it.

## Decision

For now, tokens don't expire and can't be revoked. A token is valid for as long as its player exists.

## Alternatives considered

- **Expiring tokens,** for example after inactivity or when the game ends. Board games can pause for days, and when games end is still open ([Game lifecycle](../designs/game-lifecycle.md)).
- **Revocation,** by an admin or by the implementer. Needs an extension point and a policy for connected sockets, which aren't designed yet.

## Consequences

- Behavior stays as it is today, and nothing needs to be built.
- A leaked token stays usable for as long as its player exists.
- Adding expiry or revocation later is a database change, with no change to the token format.
