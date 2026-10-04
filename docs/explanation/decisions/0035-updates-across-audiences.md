# 0035. Updates across audience changes are computed; otherwise 303 to the whole state

Status: Accepted
Date: 2026-10-04

## Context

A jump in `GET …/updates` joins the stored diffs of the player's audience after `since` ([0030](0030-updates-in-one-jump.md)). That chain only exists within one audience. When the player changed audience after `since`, no stored diff leads from the old audience's view to the new one's, and [0024](0024-views-per-audience.md) sent such a player a whole state. When `since` is before the player joined, the player never had a view there at all.

The server keeps every full state, and records which audience each player was in after each action ([0024](0024-views-per-audience.md)), so the view a player had at any `sequence` can be rebuilt.

## Decision

- **Audience changed after `since`:** the server rebuilds the player's view at `since`, by filtering the stored state at `since` for the audience the player was in then, and diffs it against the player's current view. The socket does the same at the moment a player changes audience: it sends the computed diff instead of a whole state.
- **When that's not possible,** for example because the state at `since` can't be found, `GET …/updates` answers **303 See Other** with `Location` pointing to `GET …/state`.
- **`since` before the player joined:** **404 Not Found**.

## Alternatives considered

- **Always a whole state on audience change,** as in 0024. Simpler, but sends a whole view for a change that a diff can describe.
- **409 Conflict pointing to `GET …/state`** as the fallback. Keeps each endpoint to one response shape, like 303, but every client must handle it explicitly, where a redirect is followed automatically.
- **302 Found.** Behaves the same for a GET, but means "temporarily elsewhere"; 303 means "the answer is at another URL".
- **The whole state in the `/updates` response itself.** One request, but two response shapes for one endpoint, which [0009](0009-separate-state-and-update-endpoints.md) avoids.

## Consequences

- Changing audience costs one filter and one diff, computed when needed, instead of a whole view.
- The rebuilt view is filtered by the game's current code. If the game's view filter changed since `since`, the rebuilt view may differ from what the client holds, and the patch may not apply cleanly. Within one audience, stored diffs avoid this ([0012](0012-store-player-diffs.md)); across audiences, the risk is accepted.
- Clients following redirects, as `fetch` does, receive a whole state from `/updates` in the fallback case, and must recognize it, for example by `response.redirected`.
- A 404 means the client sent a `sequence` it can't have had as this player, which only a faulty client does.
