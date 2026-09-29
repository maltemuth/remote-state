# Architecture

Remote State is a server-authoritative game server. Clients never change the game state themselves. They ask the server to apply an action, and the server decides.

The library handles transport, storage, identity and fan-out. A game supplies only its rules, as a [`GamePlugin`](../reference/game-plugin.md).

## The pieces

```
            HTTP (actions, reads)           Socket.IO (push)
 client ─────────────────────────┐   ┌───────────────────────── client
                                 ▼   ▲
                    ┌─────────── Express app ─────────┐
                    │ routes: games, players,         │
                    │         actions, state          │
                    │            │          ▲         │
                    │   per-game lock   SocketManager │
                    │            │          │         │
                    │      GamePlugin (validate,      │
                    │      execute, filter)           │
                    │            │                    │
                    │  database service (MikroORM)    │
                    └────────────┼────────────────────┘
                                 ▼
                  SQLite: games, players, game_states
```

Everything runs in one Node.js process, and that assumption shapes several decisions below.

## Why actions go over HTTP and updates over sockets

Actions need a reply: accepted with the new state, or rejected with a reason. A request/response protocol gives that reply, with status codes and ordinary tooling (curl, supertest, retries), without building acknowledgements on top of Socket.IO.

Updates need to reach players who didn't act. That needs a push channel, which is what Socket.IO is for.

This was decided in [0001](decisions/0001-http-actions-socket-updates.md). Keeping them separate means the socket carries only server-to-client traffic. Clients never send anything over it, so authentication happens once, in the handshake, and there's no second write path to secure.

## The life of an action

When `POST /api/games/:gameId/actions` arrives:

1. **Authenticate.** The token is resolved to a player, who must belong to this game.
2. **Lock.** All following steps run inside a per-game lock, so two actions on the same game can't interleave. Different games run in parallel.
3. **Load** the latest state (highest `sequence`).
4. **Validate.** If `validateAction` returns a string, the request ends with 400 and nothing changes.
5. **Execute.** The action is enriched with the server-side `playerId` and `timestamp`, and passed to `executeAction`.
6. **Record.** The new state is appended with `sequence + 1`, in a transaction.
7. **Unlock.**
8. **Respond** to the acting player with the new state, filtered for them.
9. **Broadcast.** Each connected socket of the game receives the new state, filtered for its player.

Without the lock, two actions could both read state *n*, both be validated against it, and both try to write state *n + 1*. The unique `(gameId, sequence)` index would reject the second write, but only after its validation had already passed against stale state. The lock keeps each validation in step with the state it's validated against.

## State as an append-only log

The server never overwrites a state. Each accepted action appends a full snapshot, together with the action that produced it and who sent it. The current state is simply the newest row.

This gives you:

- **An audit trail** of every move, from the stored action and the player who sent it
- **A version number** for clients: `sequence` tells a client whether an update is newer than what it has, and whether it missed any
- **Crash safety**: a state is either fully written or not written at all

The cost is storage. Every action stores the whole state, which suits small board-game states well and large, frequently changing states badly.

## Identity

Creating or joining a game issues a player ID and a random 64-character token. The token is the credential; the player ID is public and can safely appear in game state.

A player exists per game. The same person in two games has two identities. There are no accounts, passwords or sessions, which keeps the library free of user management. It also means a lost token can't be recovered.

Registering as a player and taking part in the game are separate steps. Registration gets you a token. Whether you're seated, and as what, is game state that your plugin controls, for example through a `join` action. This lets each game decide its own seating rules, spectators and team sizes.

## Hidden information

`filterStateForPlayer` is the security boundary for hidden information. Every path that sends state to a client goes through it:

- the action response
- `GET …/state/current`
- every broadcast

Filtering happens per recipient, at send time, so the stored state stays complete. That's what lets the server keep enforcing rules that depend on hidden facts.

Two consequences:

- **Anything outside the filter can leak.** That includes `validateAction` messages and custom socket events the host app sends.
- **The database is not filtered.** Anyone with access to the SQLite file sees everything, including every past action.

## Single process

The per-game lock, the Socket.IO rooms and the SQLite database all live in one process. That keeps the moving parts few, and it means one server instance per deployment, as decided in [0006](decisions/0006-single-process.md). [Limitations](limitations.md) lists what would need to change to go beyond that.
