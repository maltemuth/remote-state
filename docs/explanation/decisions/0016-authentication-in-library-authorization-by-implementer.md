# 0016. The library authenticates; implementers authorize

Status: Accepted
Date: 2026-09-29

## Context

The [Authorization](../designs/authorization.md) proposal mixed two concerns:

- **Authentication:** which player is making this request? The library issues the tokens that answer this ([0015](0015-library-issues-opaque-tokens.md)).
- **Authorization:** may this player do this? For example, create a game, join one, remove a player, or make a move.

The library runs inside someone else's server, with someone else's game. What's allowed differs from game to game and from host to host: a public lobby, private games, invitations, player limits, admins, spectators.

## Decision

Authentication is the library's job. It issues credentials, checks them on every channel, and tells the implementer which player is acting.

Authorization is the implementer's job: the game plugin and the host application decide who may do what. The library defines no policy of its own, beyond what authentication needs: a request without a valid token is rejected, and a player only ever acts, and sees, as themselves.

## Alternatives considered

- **The library defines permissions and roles,** such as an `admin` who may remove players. Every game and host would get the same rules, whether or not they fit, and the library would need to grow options for each exception.

## Consequences

- The library must give implementers a place to decide, wherever a decision is needed: at least when a game is created, a player joins, and an action is taken. `validateAction` already covers actions; the others need new extension points.
- Without a decision from the implementer, the library allows the request, as today.
- The library doesn't give roles any meaning. Roles, if any, are the game's to define and check.
- Protecting the service, such as rate limiting, is the host's job, for example with its own middleware in front of the library's routes.
- Credential handling stays with the library: how tokens are stored, where they're accepted, and how they're revoked or reissued.
