# State synchronization

Status: Open

## Problem

The second of the project's [goals](../goals.md) is that clients keep game state in their own state library, through a middleware. That middleware needs a clearly defined way to keep its copy of the state in step with the server. Today there's only an informal one:

- **After an action,** the acting player gets their new view of the state in the HTTP response.
- **After any action,** every connected socket of the game receives `game-state-update` with the player's full view of the new state and its `sequence`. The acting player's sockets receive it too, so they get the same view twice.
- **After reconnecting,** a client can only fetch the latest state. Updates it missed are gone, including the intermediate states between its last one and now.
- **Cursors aren't implemented.** `GET /api/games/:gameId/state/:cursor` ignores `:cursor` and always returns the latest state. The original project plan described per-player cursors, catch-up between cursors, and sending only changed parts of the state.

## Constraints

- **Hidden information.** Every payload must be derived from the player's filtered view, never from the full state. A change computed on the full state and then sent to a player can leak what the filter hides.
- **The history is stored.** Every state is kept as a full, unfiltered snapshot with its `sequence` ([Architecture](../architecture.md)). Any past player view can be recomputed by filtering an old snapshot, as long as `filterStateForPlayer` is a pure function.
- **Several state libraries.** What reaches the store must fit Redux and its alternatives, without depending on one of them.
- **Transport.** Actions go over HTTP, and updates over Socket.IO ([0001](../decisions/0001-http-actions-socket-updates.md)).
- **Delivery isn't exactly once.** A client can receive an update twice (the HTTP response and the socket), late, or not at all (while disconnected).

## Every client has its own view

No client receives the game's state. Each receives a *view*: the state as `filterStateForPlayer` produces it for that player. Some parts may be hidden from everyone, like the deck in a card game. Some are hidden differently per player: each sees their own hand, but not the others'. So in every option below, "the state" a client holds means its own view.

How much a game hides varies a lot:

| Kind of game | Example | Views |
|---|---|---|
| **Open information** | Chess, tic-tac-toe | Every player's view equals the full state |
| **Hidden from everyone** | A shuffled deck | Every player's view is the same, but less than the state |
| **Hidden per player** | Hands of cards, battleship fleets | Every player's view is different |
| **Revealed later** | Rock-paper-scissors choices | Views differ until a reveal, then become the same |

A game can mix these: a card game has a hidden deck and private hands, and reveals cards as they're played. A mostly open game may still hide a detail. This repository's tic-tac-toe example, for instance, shows each player the other's ID only as `"opponent"`.

### Games without hidden information

For an open-information game, all views are the same, and equal the state. The constraints below mostly disappear:

- **One message for everyone.** The server can serialize the state once, and broadcast it to the whole game.
- **Clients can run the game's rules.** A client holding the full state can apply its own action immediately, and correct itself if the server disagrees (question 5B).
- **Change sets are computed once,** between two states, and are the same for every client (question 2B).
- **Every action changes every view,** so there are no unchanged views and no gaps in `sequence`.

So the library could treat such games differently: a game without `filterStateForPlayer`, or one that declares it has no hidden information, would get broadcasting and client-side prediction. Games with hidden information would get per-player views. Whether the library should make that distinction, and how a game declares it, is an open question.

### Games with hidden information

These consequences apply to every game with a filter that makes views differ:

- **One update is many messages.** After each action, the server filters the new state once per recipient, and sends each their own payload. A single message can't be broadcast to the whole game. The server does this today, filtering separately for every connected socket.
- **The server can't reuse work across recipients.** Each view must be filtered and serialized on its own.
- **A client can't compute its own next state.** Its view lacks what's hidden, so it can't run the game's rules on it. This rules out using the game's own rules for prediction (question 5B), and means any change set must be computed between two views, never between two states (question 2B).
- **A view can stay the same while the game moves on.** If another player makes a hidden move, a player's view may not change at all. Or it changes only slightly: in the [tutorial](../../tutorials/build-your-first-game.md)'s rock-paper-scissors, Bob only learns *that* Alice has chosen. Today every player receives an update on every action, identical or not. Skipping unchanged views would save messages, but then a client sees gaps in `sequence` and can't tell a skipped update from a missed one, which matters for catch-up (question 3).
- **Views can depend on more than the player.** Players who haven't taken a seat, or spectators, need a view too. What they may see is part of [Player information](player-information.md).
- **Rejections can leak.** The reason `validateAction` gives for rejecting an action goes to the acting client without being filtered.

## Option 0: the naive approach

The client dispatches an action, and the server sends back their whole new view. Every other player receives their own whole new view as well. Nothing else: no changes, no history, no prediction.

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
- **Size out of proportion to the change.** Each message is the whole view, however little changed. For a large view where one value changed, nearly all of every message is repeated data. The total grows with view size multiplied by the number of players and actions.
- **The change itself is lost.** The client receives a result, not what happened. To animate the piece that moved, or to re-render only what changed, it has to compare the old and new views itself. Stores that detect changes by object identity see every part of a freshly received view as new, so everything re-renders.
- **Missed steps are lost.** A client that reconnects jumps to the latest state, and can't show what happened in between.
- **Every action waits for a round trip** before the player sees its effect.

If the target games have small states and don't need to show missed steps, option 0 may be enough. The questions below are about going further.

## Option 0a: actions over HTTP, all state over the socket

Like option 0, but each kind of traffic has exactly one path:

- **Actions go over HTTP.** The response only says whether the action was accepted: an acknowledgement with the new `sequence`, or the rejection reason. It carries no state.
- **New views go over the socket, to everyone.** Each player receives their own view of the new state. The acting player receives the result of their own action the same way as every other player.
- **The current state is fetched over HTTP,** with `GET …/state/current`, when a client starts or reconnects.

In terms of the questions below, it's option 0 with 6B instead of 6A.

What it gives, compared to option 0:

- **No duplicate delivery.** Each view reaches each client once, so the race between the HTTP response and the socket disappears.
- **One code path for applying state.** The middleware handles the acting player's update exactly like everyone else's.
- **A clear division.** HTTP means "do something" and "tell me where we are", and the socket means "something happened".

What it costs:

- **The acting player needs a working socket to see their own action's effect.** If the socket is down, the action is accepted but the client sees nothing until it reconnects and fetches the state.
- **Connecting has an ordering race.** Updates can arrive over the socket while the GET for the current state is still in flight. To lose nothing, the client connects the socket first, then fetches the state, and applies whichever is newest by `sequence`, dropping anything older than what it already shows.
- **Matching an action to its result** uses the `sequence` from the acknowledgement. The client waits until an update with that `sequence` arrives, for example to clear a "sending" indicator.

Message size, the lost change itself, lost intermediate steps, and the round trip per action are the same as in option 0.

## Questions to decide

### 1. What is a cursor?

A cursor identifies how far a client is in a game's history.

- **A. The `sequence` number.** It already exists, grows by one per accepted action, and is included in every update. The client keeps its own cursor.
- **B. An opaque token from the server.** The server can change what the cursor encodes later, for example to add a checksum of the player's view, without breaking clients.
- **C. A cursor per player, kept by the server,** as in the original plan. The server knows what each player has seen, and can resend exactly what's missing. It adds state to the server for every player.

### 2. What does an update contain?

This question stays semi-open: what updates need to carry will become clearer as more example games are built. The current direction is data changes, the part of the state that changed, as JSON patches recorded by Immer. See [JSON diffs](#json-diffs) below.

The format is partly decided ([0007](../decisions/0007-client-chosen-update-format.md)): each client chooses whole state, JSON Patch, or Immer patches, both for its socket subscription and for GET requests.

Sending only what changed matters for two separate reasons:

- **Size.** A message should grow with the change, not with the whole view.
- **Rendering.** Clients use the change itself: to animate a move, to highlight what's new, or to re-render only the affected parts. Most Redux-style stores decide what to re-render by object identity, so what matters is which parts of the store actually get replaced.

Changes can be described at two levels, which serve rendering differently:

- **Data changes** say which values changed: "the cell at 0,2 is now X". They're generic, so the library can compute them without knowing the game, but they don't say what happened. A chess move shows up as two squares changing, not as a move.
- **Game events** say what happened: "X played 0,2", or "the knight moved from g1 to f3". They carry the meaning an animation needs, but only the game can produce them.

A client could also get part of the rendering benefit without any protocol change. Its middleware can compare each new full view with the current one, and keep the unchanged parts as the same objects (structural sharing). That keeps re-rendering minimal and lets the client work out data changes itself, but it doesn't reduce message size, and it can't recover game events.

- **A. The full player view every time,** as today. Simple, and each update stands alone, so a lost update does no harm. Bandwidth grows with state size, which suits small board-game states.
- **B. Changes to the player view,** for example as JSON Patch operations (RFC 6902), computed between the player's previous and new views. Updates are small, but only valid on top of exactly the previous state; a client that missed one needs a full snapshot. The server must compute a separate change set per player, from the filtered views.
- **C. Mixed.** Changes when the client is known to be one step behind, a full view otherwise, and a full view every few updates as a checkpoint.
- **D. Game events.** The game's rules produce events, for example "X placed at 1,1", and each event is filtered per player like the state. Clients update their copy with their own reducers, the way Redux works locally. It fits the Redux model best, and gives rendering the meaning of each change. But game authors must write event filtering as well as state filtering, and client and server rules must stay in agreement.
- **E. Game events alongside data.** Each update carries the data (a full view or data changes) together with the game's events for rendering. The store stays correct from the data alone, and events are only used for presentation, so a client that ignores them still works. It sends more than B or D alone.

### JSON diffs

The current direction is to use [Immer](https://immerjs.github.io/immer/)'s patches, rather than writing or adding a diffing algorithm.

**How Immer produces them.** Immer doesn't compare two states. It records changes while they're made: `produceWithPatches` hands the code a draft of the state, and every change made to the draft is recorded as a patch. That's the same mechanism Redux Toolkit uses for its reducers.

Tested on a chess move, rules written as changes to a draft (`draft.board[4][4] = "wP"`, and so on) produced exactly the parts that changed: the two squares, the turn, and the appended move. Applied on the client with Immer's `applyPatches`, only the two changed board rows became new objects, so identity-based stores re-render only those.

**Immer stays on the server.** What crosses the network is plain JSON data; clients don't need Immer. Immer's patches use the JSON Patch (RFC 6902) operations, but give each path as an array (`["board", 4, 4]`) rather than a string (`/board/4/4`). Clients choose which of the two they receive ([0007](../decisions/0007-client-chosen-update-format.md)). For JSON Patch, the server converts each path to its string form, which is a format translation, not diffing.

**Why not a general-purpose diff.** A diff library compares two finished states and has to guess what happened. Tested with the `rfc6902` library on the same chess move, it described e2-e4 as "insert a row at index 4, remove row 7", because the empty rows all look alike. The result was correct, but it didn't show which squares changed, and applying it replaced rows that hadn't changed. Recording changes as they're made has no such ambiguity.

**What Immer's patches require from the rest of the design:**

- **The game's rules must change a draft.** Immer only records what's done to its draft. If `executeAction` returns a new object, as the plugin interface expects today, the only recorded patch is "replace the whole state", which gains nothing. So `executeAction` would have to be written as a reducer that changes a draft, in Redux Toolkit style. That's a breaking change to the [GamePlugin](../../reference/game-plugin.md) interface.
- **Patches describe the full state, so they can leak hidden information.** In a card game, the patch for Alice drawing a card is `add ["hands", "alice", 2] = "Q♦"`. Sent to Bob, it reveals the card. Immer can't produce patches for a filtered view, because the view isn't what the rules change. For games with hidden information, the options are:
  - **Full views only.** Patches are sent only for games without hidden information (see [Games without hidden information](#games-without-hidden-information)). Other games keep receiving full views, as in option 0 or 0a.
  - **Patch filtering by the game.** Next to `filterStateForPlayer`, the game provides a filter for patches that drops or rewrites the ones a player mustn't see. Game authors then maintain two filters that must agree, and a mistake in the second one leaks information.
- **A patch is only valid on its exact base.** Each update must say which `sequence` it applies to. A client that isn't at that base needs a full view instead, which is option C.
- **An empty patch list** means the state didn't change.

### 3. How does a client catch up after missing updates?

- **A. Fetch the latest state,** as today. Simple, but intermediate states are lost; a client can't animate the moves it missed.
- **B. Fetch everything since a cursor.** `GET …/state/:cursor` returns every update after the cursor, in the client's chosen format ([0007](../decisions/0007-client-chosen-update-format.md)), or a single full view if the gap is too large. For patch formats, this needs the recorded patches stored with each state.
- **C. Send the cursor when connecting.** The client includes its cursor in the socket handshake, and the server sends the missed updates before live ones. This keeps catch-up and live updates in one ordered stream. Clients still send nothing over the socket after connecting.

### 4. What reaches the client's store?

The middleware turns server messages into actions for the store. For example:

- `state-replaced` with a sequence and a full view
- `state-changed` with a sequence and patches, in JSON Patch or Immer format
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

- How does a client state its format choice: a handshake option for the socket and a query parameter for GET, or HTTP content negotiation? JSON Patch has a registered media type, `application/json-patch+json`; Immer's format doesn't.
- Is it acceptable to change `executeAction` into a reducer that changes an Immer draft?
- For games with hidden information: full views only, or patch filtering by the game?
- What do clients need for rendering: to know which data changed, or what happened in game terms? Is keeping unchanged parts as the same objects on the client enough, or must the server send the change?
- Should the library treat games without hidden information differently, for example by broadcasting one message and allowing client-side prediction? If so, does a game declare it, or does the library infer it from the missing `filterStateForPlayer`?
- How large are the states of the games this is meant for, and how often do they change? This decides whether sending changes is worth the complexity.
- Do clients need intermediate states, for example to animate each move, or only the latest one?
- Should a player joining late see the game's earlier history?
- Which state libraries must the middleware support first? See [Client package](client-package.md).
