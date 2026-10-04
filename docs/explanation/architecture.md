# Architecture

Remote State is a server-authoritative game server. Clients never change the game state themselves. They ask the server to apply an action, and the server decides.

The library handles transport, storage, identity and fan-out. A game supplies only its rules, as a [`GamePlugin`](../reference/game-plugin.md). The application around it, the host, decides who may create and join games.

## The pieces

```
                              client
             │                   │                    ▲
        host routes          HTTP /api            Socket.IO
       (games, codes)    (tokens, actions,     (state, patches)
             │            state, updates)             │
 ┌───────────┼───────────────────┼────────────────────┼───────┐
 │           ▼                   ▼                    │       │
 │       host app ──────► engine: per-game lock, join, act,   │
 │  (createGame, admit)   record, publish, catch up           │
 │                               │                            │
 │                  GamePlugin: onJoin, validate,             │
 │                  execute, filter per audience              │
 │                               │                            │
 │                           MikroORM                         │
 └───────────────────────────────┼────────────────────────────┘
                                 ▼
          SQLite: games, players, tokens, admission codes,
                  states, audience diffs, audience memberships
```

Everything runs in one Node.js process, and that assumption shapes several decisions below.

## Why actions go over HTTP and updates over sockets

Actions need a reply: accepted or rejected with a reason. A request/response protocol gives that reply, with status codes and ordinary tooling (curl, supertest, retries), without building acknowledgements on top of Socket.IO.

Updates need to reach every player, including those who didn't act. That needs a push channel, which is what Socket.IO is for.

This was decided in [0001](decisions/0001-http-actions-socket-updates.md). Keeping them separate means the socket carries only server-to-client traffic. Clients never send anything over it, so authentication happens once, in the handshake, and there's no second write path to secure.

The reply to an action carries only its `sequence`, not the new state ([0034](decisions/0034-action-response-with-sequence.md)). The state reaches the acting client the same way it reaches everyone else, over the socket, so there's one path for state and the client can match the update to its action.

## Hosts, codes and tokens

The library has no accounts and no endpoints for creating or joining games. Who may play is the host's business, decided with its own login ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md), [0020](decisions/0020-hosts-admit-players-through-codes.md)).

The host calls the library in-process ([0023](decisions/0023-no-server-to-server-admit.md)):

- `createGame(initialState)` stores a new game. The host gets the initial state from the game's own code, so the library needs no notion of game options ([0036](decisions/0036-hosts-pass-the-initial-state.md)).
- `admit({ gameId, identity })` returns a single-use code that's valid for a minute. The host passes it to its client in a response body.

The client exchanges the code at `POST /api/tokens` for a token. From then on, the token is the only credential, sent in the `Authorization` header or the socket handshake ([0017](decisions/0017-hashed-tokens-in-header-and-handshake.md)).

This way, the host never handles tokens or keeps its own table linking users to players, and a leaked code is worth little: it works once, for a minute. Tokens are stored only as hashes, so the library can never show one again. A returning person, or the same person on another device, is admitted again and gets a new token; a player can hold several ([0019](decisions/0019-several-tokens-per-player.md)). The host's `identity.id` ties them to one player per game.

A player exists per game. The library knows nothing else about them: names, seats and roles are game state, set by the game ([0022](decisions/0022-roles-belong-to-game-state.md)).

## Joining is a transition

When a code is redeemed for an identity the game hasn't seen, the game's `onJoin` runs with the current state. It can seat the player, or refuse them with a `GameRefusal`, for example when the game is full ([0026](decisions/0026-join-hook-is-a-state-transition.md)).

A join is recorded like an action: it gets the next `sequence`, and connected players receive the new state. That keeps the library's players and the game's seats consistent; nobody has a token without the game having agreed.

## The life of an action

When `POST /api/games/:gameId/actions` arrives:

1. **Authenticate.** The token is resolved to a player, who must belong to this game.
2. **Lock.** All following steps run inside a per-game lock, so two transitions on the same game can't interleave. Different games run in parallel.
3. **Load** the latest state (highest `sequence`).
4. **Validate.** If `validateAction` returns a string, the request ends with 400 and nothing changes.
5. **Execute.** `executeAction` returns the next state, and possibly audience changes. A `GameRefusal` ends the request with 400.
6. **Record**, in one transaction: the new state with `sequence + 1`, a diff of the full state, the diff of each audience's view, and any audience changes.
7. **Publish.** Each connected socket of the game receives its audience's new view, as a whole state or as patches.
8. **Unlock**, and respond with 201 and the `sequence`.

Without the lock, two actions could both read state _n_, both be validated against it, and both try to write state _n + 1_. The unique `(gameId, sequence)` index would reject the second write, but only after its validation had already passed against stale state. The lock keeps each validation in step with the state it's validated against, and keeps socket events in `sequence` order.

## State as an append-only log

The server never overwrites a state. Each transition appends a full snapshot, together with the action that produced it and who sent it. The current state is simply the newest row.

This gives you:

- **An audit trail** of every move, from the stored action and the player who sent it
- **A cursor** for clients: `sequence` tells a client how far it is, and is all it needs to ask for what changed since ([0029](decisions/0029-sequence-is-the-cursor.md))
- **Crash safety**: a transition is either fully written or not written at all

Next to each state, the server stores diffs: one of the full state ([0013](decisions/0013-store-full-state-diffs.md)), and one per audience ([0012](decisions/0012-store-player-diffs.md)). A client that reconnects gets its whole view from the socket ([0031](decisions/0031-socket-sends-state-on-connect.md)). A client that asks `GET …/updates?since=n` gets the stored diffs of its audience after _n_, joined into one patch ([0030](decisions/0030-updates-in-one-jump.md)).

The cost is storage. Every transition stores the whole state and its diffs, which suits small board-game states well and large, frequently changing states badly.

## Hidden information

Every game is treated as having hidden information ([0010](decisions/0010-every-game-has-hidden-information.md)). `filterStateForAudience` is the security boundary for it. Every path that sends state to a client goes through it:

- socket events, on connect and after every transition
- `GET …/state`
- `GET …/updates`

Patches are diffs between two views, never between full states ([0011](decisions/0011-patches-are-diffs-of-views.md)), so they can't leak what the views hide.

Views are computed per audience, not per player ([0024](decisions/0024-views-per-audience.md)). By default, a game with a filter gives each player an audience of their own, and a game without one puts everyone in a single audience ([0025](decisions/0025-default-audiences.md)). Games move players into shared audiences, such as spectators, by returning `withAudiences` from `onJoin` or an action ([0027](decisions/0027-audiences-set-by-join-hook-and-actions.md)). Players who see the same thing then cost one view and one stored diff, however many they are.

When a player changes audience, no stored diff leads from their old view to their new one. The server rebuilds the old view from the stored state and the player's audience history, and diffs the two ([0035](decisions/0035-updates-across-audiences.md)). That's why filters must be pure functions of the state and the audience.

Filtering happens at send time, so the stored state stays complete. That's what lets the server keep enforcing rules that depend on hidden facts.

Two consequences:

- **Anything outside the filter can leak.** That includes `validateAction` messages and `GameRefusal` reasons, and anything the host app sends on its own routes.
- **The database is not filtered.** Anyone with access to the SQLite file sees everything, including every past action and the full-state diffs.

## Single process

The per-game lock, the Socket.IO rooms and the SQLite database all live in one process. That keeps the moving parts few, and it means one server instance per deployment, as decided in [0006](decisions/0006-single-process.md). [Limitations](limitations.md) lists what would need to change to go beyond that.
