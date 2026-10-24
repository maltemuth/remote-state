# Architecture

Remote State keeps state that several people share on a server, in **spaces**: a game, an auction, a document. Clients ask the server to apply an action; the server decides. Your [rules](../reference/rules.md) supply the logic, and the people in a space are its **members**. The app around it, the host, decides who may create and join spaces.

```
                              client
             │                   │                    ▲
        host routes          HTTP /api            Socket.IO
      (spaces, codes)     (tokens, actions,     (state, patches)
             │            state, updates)             │
 ┌───────────┼───────────────────┼────────────────────┼───────┐
 │           ▼                   ▼                    │       │
 │       host app ──────► engine: per-space lock, join,       │
 │  (createSpace, admit)  dispatch, record, publish,          │
 │                        catch up                            │
 │                               │                            │
 │                  Rules: onJoin, validateAction,            │
 │                  executeAction, view per audience          │
 │                               │                            │
 │                           MikroORM                         │
 └───────────────────────────────┼────────────────────────────┘
                                 ▼
          SQLite: spaces, members, tokens, admission codes,
                  states, audience memberships
```

Everything runs in one Node.js process ([0006](decisions/0006-single-process.md)). The library runs inside the host: standalone, with the host adding routes to its app, or mounted in the host's own app ([0037](decisions/0037-embeddable-core-and-server-options.md)). One instance serves the spaces of one set of rules, with its own database; a host with several sets of rules mounts several ([0038](decisions/0038-several-games-by-mounting-several-instances.md)).

## Actions over HTTP, updates over sockets

An action needs a reply, accepted or rejected with a reason, which HTTP gives with ordinary tooling. An update must reach every member, which needs a push channel ([0001](decisions/0001-http-actions-socket-updates.md)). Clients never send anything over the socket, so it's authenticated once, in the handshake, and there's one write path to secure.

The reply carries only the action's `sequence`. The new state reaches the actor the way it reaches everyone, over the socket ([0034](decisions/0034-action-response-with-sequence.md)).

## Hosts, codes and tokens

The library has no accounts and no endpoints for creating or joining spaces ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md)). The host calls it in-process ([0023](decisions/0023-no-server-to-server-admit.md)): `createSpace(initialState)`, with a state from its own code ([0036](decisions/0036-hosts-pass-the-initial-state.md)), and `admit({ spaceId, identity })`, which returns a code valid once, for a minute ([0020](decisions/0020-hosts-admit-players-through-codes.md)).

The client trades the code for a token, its only credential from then on ([0017](decisions/0017-hashed-tokens-in-header-and-handshake.md)). So the host never handles tokens, and a leaked code is worth little. Tokens are stored as hashes. A person admitted again gets a new token for the same member ([0019](decisions/0019-several-tokens-per-player.md)). Names, seats and roles are part of the state, not the library's ([0022](decisions/0022-roles-belong-to-game-state.md)).

A join is a transition: the rules' `onJoin` seats or refuses the person, and the join is recorded and sent like an action. Nobody has a token without the rules having agreed ([0026](decisions/0026-join-hook-is-a-state-transition.md)).

## The life of an action

1. **Authenticate** the token to a member of this space.
2. **Lock** the space. Two transitions of one space never interleave; different spaces run in parallel.
3. **Load** the latest state.
4. **Validate.** A string from `validateAction` ends the request with 400.
5. **Execute.** `executeAction` returns the next state, and maybe audience changes and timers. A `Refusal` ends it with 400.
6. **Record**, in one transaction, the new state with the next `sequence`, the action and its author, and audience changes. Then the timers take effect.
7. **Publish** each connected socket's new view, whole or as patches, computed once per audience.
8. **Unlock,** and answer 201 with the `sequence`.

The lock keeps validation in step with the state it's validated against, and socket events in order.

Timers and the host's `dispatch` take the same path from step 2, as the system, the member ID `"system"` ([0040](decisions/0040-server-initiated-actions.md)). So the rules decide what the system may do, and the history shows it. Timers are named, so one turn timer is replaced by every move ([0041](decisions/0041-named-timers.md)). They live in memory; after a restart, the rules decide what to do in `onRestart` ([0052](decisions/0052-games-pause-on-restart.md), [0053](decisions/0053-restarts-are-game-logic.md)).

## State as an append-only log

Every transition appends a full snapshot with its action, author and the author's audience ([0039](decisions/0039-actions-recorded-with-authors-audience.md)); the newest row is the current state. That gives an audit trail, crash safety, and a cursor: `sequence` is all a client needs to ask what changed ([0029](decisions/0029-sequence-is-the-cursor.md)).

Only states are stored. Views and patches are computed when they're sent ([0050](decisions/0050-full-state-diffs-derived-not-stored.md), [0056](decisions/0056-views-and-patches-computed-when-sent.md)). A reconnecting client gets its whole view ([0031](decisions/0031-socket-sends-state-on-connect.md)); `GET …/updates?since=n` gives one patch from its view at _n_ ([0030](decisions/0030-updates-in-one-jump.md)). The cost is storage, which suits small states and punishes large ones.

## Hidden information

Every space is treated as having hidden information ([0010](decisions/0010-every-game-has-hidden-information.md)), and `view` is the boundary: socket events, `GET …/state` and `GET …/updates` all go through it. Patches are diffs between views, never between states, so they can't leak what views hide ([0011](decisions/0011-patches-are-diffs-of-views.md)).

Views are per audience, not per member ([0024](decisions/0024-views-per-audience.md)): by default each member's own with `view`, and one for everyone without ([0025](decisions/0025-default-audiences.md)). The rules move members into shared audiences, such as spectators, who then cost one view however many they are ([0027](decisions/0027-audiences-set-by-join-hook-and-actions.md)). Catching up rebuilds a member's old view from the stored state and their audience history ([0035](decisions/0035-updates-across-audiences.md)), which is why `view` must be pure.

Stored states stay complete, so the rules can depend on hidden facts. Two consequences: anything outside `view` can leak, such as rejection messages and the host's own routes; and the database is not filtered.

See [Known limitations](limitations.md) for what this design doesn't do yet.
