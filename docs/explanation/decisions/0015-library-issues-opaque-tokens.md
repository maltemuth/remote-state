# 0015. The library issues its own opaque tokens

Status: Accepted
Date: 2026-09-29

## Context

Every request and socket connection must be tied to a player, so that each player gets only their own view ([0010](0010-every-game-has-hidden-information.md)). Today the library issues a random token when a player is created, and checks it on every channel. The [Authorization](../designs/authorization.md) proposal asked where identity should come from: the library's own tokens, the host application's login, or both.

## Decision

The library provisions its own credentials. When a player is created, it issues a random, opaque token, and looks it up on every HTTP request and socket handshake to find the player.

Tokens carry no information. They're not JWTs or any other self-contained, signed format; the database is what says which player a token belongs to.

## Alternatives considered

- **The host authenticates, and the library maps users to players,** through a hook such as `authenticate(request) → userId`. It reuses the host's login and recognizes people across games, but makes every host implement and wire up authentication before anything works, and ties the library's security to each host's implementation.
- **Both,** with tokens by default and host authentication when configured. Two ways of establishing identity to build, document and test, for a need no user has stated yet.
- **Signed, self-contained tokens such as JWTs.** They can be checked without a database lookup, but the library reads the database on every request anyway, to load the game. They would add a signing key to manage, and make revocation harder, since a signed token stays valid until it expires.

## Consequences

- The library works on its own, with nothing to configure, as in the tutorial.
- A token is only a lookup key, so the database only needs to recognize it, not read it: tokens can be stored hashed.
- Revoking or reissuing a token is a database change, with no signing keys or expiry involved.
- The host's own login isn't used. A host that wants to restrict who plays does so around the library, for example by deciding who may create or join games ([Authorization](../designs/authorization.md), questions 2 and 3), or by handing out tokens only to its own users.
- Tokens are still issued per player, per game. Whether one person can be recognized across games stays open.
