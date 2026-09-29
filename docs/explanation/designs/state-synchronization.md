# State synchronization

Status: Open

## Problem

The second of the project's [goals](../goals.md) is that clients keep game state in their own state library, through a middleware. That middleware needs a clearly defined way to keep its copy of the state in step with the server. Today there's only an informal one:

- **After an action,** the acting player gets their new view of the state in the HTTP response.
- **After any action,** every connected socket of the game receives `game-state-update` with the player's full view of the new state and its `sequence`. The acting player's sockets receive it too, so they get the same state twice.
- **After reconnecting,** a client can only fetch the latest state. Updates it missed are gone, including the intermediate states between its last one and now.
- **Cursors aren't implemented.** `GET /api/games/:gameId/state/:cursor` ignores `:cursor` and always returns the latest state. The original project plan described per-player cursors, catch-up between cursors, and sending only changed parts of the state.

## Constraints

- **Hidden information.** Every payload must be derived from the player's filtered view, never from the full state. A change computed on the full state and then sent to a player can leak what the filter hides.
- **The history is stored.** Every state is kept as a full, unfiltered snapshot with its `sequence` ([Architecture](../architecture.md)). Any past player view can be recomputed by filtering an old snapshot, as long as `filterStateForPlayer` is a pure function.
- **Several state libraries.** What reaches the store must fit Redux and its alternatives, without depending on one of them.
- **Transport.** Actions go over HTTP, and updates over Socket.IO ([0001](../decisions/0001-http-actions-socket-updates.md)).
- **Delivery isn't exactly once.** A client can receive an update twice (the HTTP response and the socket), late, or not at all (while disconnected).

## Option 0: the naive approach

The client dispatches an action, and the server sends back the whole new state. Every other player receives their whole new view as well. Nothing else: no changes, no history, no prediction.

It's essentially what the server does today, so it's the baseline the other options have to improve on. In terms of the questions below, it's:

- **Cursor:** only needed to tell newer from older states
- **Update contents:** 2A, full player views
- **Catch-up:** 3A, fetch the latest state
- **Store:** one message, `state-replaced`
- **Prediction:** 5A, none
- **Action response:** 6A, the new player view

What it gives:

- The client middleware is small: send the action, and replace the game state in the store whenever a new state arrives.
- Every message stands on its own, so duplicate or lost updates can't corrupt the client's copy.
- Hidden information stays safe without extra work, because only filtered views are ever sent.

Where it falls short:

- **Ordering needs one fix.** The acting client receives its new state twice, in the HTTP response and over the socket, and they can arrive in either order. The HTTP response doesn't include the state's `sequence`, so a late response could overwrite a newer state from the socket. Adding `sequence` to the response, and ignoring anything older than the current state, is enough.
- **Bandwidth** grows with state size multiplied by the number of players and actions.
- **Missed steps are lost.** A client that reconnects jumps to the latest state, and can't show what happened in between.
- **Every action waits for a round trip** before the player sees its effect.

If the target games have small states and don't need to show missed steps, option 0 may be enough. The questions below are about going further.

## Option 0a: actions over HTTP, all state over the socket

Like option 0, but each kind of traffic has exactly one path:

- **Actions go over HTTP.** The response only says whether the action was accepted: an acknowledgement with the new `sequence`, or the rejection reason. It carries no state.
- **New states go over the socket, to everyone.** The acting player receives the result of their own action the same way as every other player.
- **The current state is fetched over HTTP,** with `GET …/state/current`, when a client starts or reconnects.

In terms of the questions below, it's option 0 with 6B instead of 6A.

What it gives, compared to option 0:

- **No duplicate delivery.** Each state reaches each client once, so the race between the HTTP response and the socket disappears.
- **One code path for applying state.** The middleware handles the acting player's update exactly like everyone else's.
- **A clear division.** HTTP means "do something" and "tell me where we are", and the socket means "something happened".

What it costs:

- **The acting player needs a working socket to see their own action's effect.** If the socket is down, the action is accepted but the client sees nothing until it reconnects and fetches the state.
- **Connecting has an ordering race.** Updates can arrive over the socket while the GET for the current state is still in flight. To lose nothing, the client connects the socket first, then fetches the state, and applies whichever is newest by `sequence`, dropping anything older than what it already shows.
- **Matching an action to its result** uses the `sequence` from the acknowledgement. The client waits until an update with that `sequence` arrives, for example to clear a "sending" indicator.

Bandwidth, lost intermediate steps and the round trip per action are the same as in option 0.

## Questions to decide

### 1. What is a cursor?

A cursor identifies how far a client is in a game's history.

- **A. The `sequence` number.** It already exists, grows by one per accepted action, and is included in every update. The client keeps its own cursor.
- **B. An opaque token from the server.** The server can change what the cursor encodes later, for example to add a checksum of the player's view, without breaking clients.
- **C. A cursor per player, kept by the server,** as in the original plan. The server knows what each player has seen, and can resend exactly what's missing. It adds state to the server for every player.

### 2. What does an update contain?

- **A. The full player view every time,** as today. Simple, and each update stands alone, so a lost update does no harm. Bandwidth grows with state size, which suits small board-game states.
- **B. Changes to the player view,** for example as JSON Patch operations (RFC 6902), computed between the player's previous and new views. Updates are small, but only valid on top of exactly the previous state; a client that missed one needs a full snapshot. The server must compute a separate change set per player, from the filtered views.
- **C. Mixed.** Changes when the client is known to be one step behind, a full view otherwise, and a full view every few updates as a checkpoint.
- **D. Game events.** The game's rules produce events, for example "X placed at 1,1", and each event is filtered per player like the state. Clients update their copy with their own reducers, the way Redux works locally. It fits the Redux model best, but game authors must write event filtering as well as state filtering, and client and server rules must stay in agreement.

### 3. How does a client catch up after missing updates?

- **A. Fetch the latest state,** as today. Simple, but intermediate states are lost; a client can't animate the moves it missed.
- **B. Fetch everything since a cursor.** `GET …/state/:cursor` returns every update after the cursor, as full views or changes, or a single full view if the gap is too large.
- **C. Send the cursor when connecting.** The client includes its cursor in the socket handshake, and the server sends the missed updates before live ones. This keeps catch-up and live updates in one ordered stream. Clients still send nothing over the socket after connecting.

### 4. What reaches the client's store?

The middleware turns server messages into actions for the store. For example:

- `state-replaced` with a sequence and a full view
- `state-changed` with a sequence and a change set
- `action-rejected` with the action and the server's reason
- `connection-changed`

The questions are which of these exist, how the store's reducer applies them, and where in the store the game state lives.

### 5. Should actions apply before the server confirms them?

- **A. No.** The client waits for the server. It's always correct, but each action takes a round trip before the player sees it.
- **B. Yes, using the game's own rules on the client.** Instant, but only possible when the client can see everything the rules need, so it doesn't work for games with hidden information.
- **C. Yes, using a separate prediction per action** that the game provides for its clients. The prediction is rolled back when the server's version arrives or the action is rejected.

### 6. What does the HTTP response to an action contain?

- **A. The new player view,** as today. The acting client gets it twice, and must use `sequence` to ignore the second copy.
- **B. Only an acknowledgement with the new `sequence`.** All state arrives through one channel, the socket, so every client applies updates the same way. The acting client depends on its socket connection to see its own action's result.

## Open questions

- How large are the states of the games this is meant for, and how often do they change? This decides whether sending changes is worth the complexity.
- Do clients need intermediate states, for example to animate each move, or only the latest one?
- Should a player joining late see the game's earlier history?
- Which state libraries must the middleware support first? See [Client package](client-package.md).
