# 0049. One operational endpoint: a health check under the API

Status: Accepted
Date: 2026-10-10

## Context

[0028](0028-no-operational-endpoints.md) ruled out operational endpoints, but the router still serves `GET /health`, next to `/api` rather than under it. It answers `{ "status": "ok", "game": … }` without authentication, and is the only reader of the plugin's `gameConfig.name`.

A liveness check is useful to every host: load balancers, container orchestrators and the load test need to know whether an instance answers. Unlike the removed `POST /admin/log-level`, it changes nothing and reveals nothing beyond the game's name.

Because it sits beside `/api`, the router claims two paths in the host's app instead of one.

## Decision

The library's only operational endpoint is a read-only liveness check at `GET <base>/api/health`, without authentication. Everything the router serves is now under `<base>/api`. Anything that changes the server or exposes more than the game's name stays the host's to build, behind its own login.

## Alternatives considered

- **No health check, as 0028 says.** Each host writes the same few lines, and the load test would need its own readiness check.
- **Keeping `/health` beside `/api`.** The router keeps claiming a second path in the host's app.
- **Checking the database in the health check.** What "healthy" means differs per deployment; a host that wants a deeper check builds it.

## Consequences

- The router owns one path, `<base>/api`, and the rest of the host's app is free.
- `GET /health` moves to `GET /api/health`, a breaking change for anyone polling it.
- The check reports that the process answers, not that the database works.
