# 0017. Tokens are stored hashed, and accepted only in the header and the handshake

Status: Accepted; existing databases weren't migrated after all: the rebuild after 0.2.0 starts with a new schema (see the changelog)
Date: 2026-09-29

## Context

Tokens are opaque lookup keys issued by the library ([0015](0015-library-issues-opaque-tokens.md)). Two things about them were weaker than they need to be:

- **They're stored in plain text,** so anyone who can read the database, or a backup of it, can act as any player and see their hidden information ([0010](0010-every-game-has-hidden-information.md)).
- **They travel in two places on HTTP.** Actions accept a bearer header or a `token` field in the request body; reads and the socket accept only the header or the handshake.

## Decision

- **The database stores a hash of each token,** never the token itself. The token is returned once, when the player is created. Tokens are long and random, so a fast hash such as SHA-256 is enough; a slow password hash isn't needed.
- **Tokens are accepted in one place per channel:** the `Authorization: Bearer` header on HTTP, and the handshake on the socket. The `token` field in action bodies is dropped.

## Alternatives considered

- **A slow password hash** such as bcrypt or argon2. These protect short, guessable secrets; for a random 256-bit token they only add work to every request.
- **Keeping the body field.** It lets clients send an action without setting a header, but it's a second code path to secure, and bodies are logged more often than headers.

## Consequences

- A database leak no longer lets anyone act as a player.
- A lost token can't be recovered from the database. Reissuing one is still open ([Authorization](../designs/authorization.md), question 5).
- Tokens are looked up by their hash, through the existing unique index, now on the hash.
- Existing databases need a migration that hashes the stored tokens.
- Clients sending the token in the action body break, and must send the header instead.
