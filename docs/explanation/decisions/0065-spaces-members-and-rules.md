# 0065. Spaces, members and rules

Status: Accepted
Date: 2026-10-24

## Context

The library's names came from its first use: `GamePlugin`, `createGame`, `gameId`, players and `GameRefusal`. Nothing in it is specific to games, though. Any state that several people share, with rules for changing it and things some of them mustn't see, fits: an auction, a shared document, a poker table. The names told readers otherwise. The README already introduces the library as "like Redux, Pinia or NgRx, but on the server".

## Decision

- **A space** is what the host creates and people join: `createSpace`, `spaceId`, `/api/spaces/:spaceId/…`, `UnknownSpaceError`.
- **A member** is someone admitted to a space: `memberId`, `JoiningMember`, in `Session`, the token response and the socket handshake.
- **`Rules<State, Action, View>`** is what the developer writes, formerly `GamePlugin`. Its filter is `view(state, audience)`, formerly `filterStateForAudience`.
- **`Refusal`** replaces `GameRefusal`.
- **`dispatch`** replaces the client's `send` and the host's `act`, with `DispatchResult` for `ActResult`, as in Redux.
- **Unchanged:** `validateAction`, `executeAction`, `onJoin`, `onRestart`, `admit`, `identity`, audiences, `transition`, `withAudiences`, `SYSTEM`, `EVERYONE`, timers and `sequence`.
- **Examples stay games.** Multiplayer games are the first use that comes to mind, so the tutorial and the example server keep theirs.
- **The database's tables** are `spaces`, `members` and `space_states`, and the schema version is 4. Databases from earlier versions must be deleted ([0048](0048-no-database-upgrades-before-1-0.md)).

## Alternatives considered

- **Room and member.** Well known from Socket.IO and Liveblocks, but sounds social for a shared document.
- **Store and client.** Closest to Redux, but "store" would name both the library and each instance, and "client" already names the browser package.
- **Session and participant.** Collides with the client's `Session`, its token.
- **Keeping the game names.** No breaking change, but the names would keep saying the library is only for games.

## Consequences

- Every host, rules module and client must be updated, and every database deleted. Before 1.0, that's allowed.
- Decision records before this one keep the old names.
- A host's own routes may still speak of games, as the example's lobby does: a host's names are its own.
