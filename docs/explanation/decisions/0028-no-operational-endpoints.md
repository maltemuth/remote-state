# 0028. The library installs no operational endpoints

Status: Superseded by [0049](0049-health-check-under-the-api.md)
Date: 2026-09-29

## Context

The library installs `POST /admin/log-level` on its server, unless `NODE_ENV` is `production`. It changes the log level of every logger in the process at runtime. It has no authentication, so anyone who can reach the server can switch on `debug` logging, which floods the logs and may write game state, including hidden information, to them. Nothing in the project uses it.

Operating the server is the host's business, not the library's ([0016](0016-authentication-in-library-authorization-by-implementer.md)).

## Decision

The library installs no operational endpoints. `POST /admin/log-level` is removed. Hosts that want to change logging at runtime build that themselves, behind their own login, using the library's logging options.

## Alternatives considered

- **Keeping it, opt-in and authenticated.** The library would need a credential for operators, which it doesn't have: it only authenticates players ([0015](0015-library-issues-opaque-tokens.md)).
- **Keeping it outside production,** as today. Depends on every deployment setting `NODE_ENV`, which many don't.

## Consequences

- No route exists that the host didn't ask for, beyond the game's API.
- Changing the log level at runtime needs host code, once the log level is a per-server option and hosts can supply their own logger ([backlog](../../../BACKLOG.md)).
- `/admin/log-level` disappears from the HTTP reference, a breaking change for anyone calling it.
