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

Two terms are used throughout, and never mean the same thing:

- **Full state:** the game's complete, unfiltered state. Only the server has it.
- **Whole state:** everything one player may see, their whole view. A "whole-state" update always sends that player's view, never the full state.

How much a game hides varies a lot:

| Kind of game | Example | Views |
|---|---|---|
| **Open information** | Chess, tic-tac-toe | Every player's view equals the full state |
| **Hidden from everyone** | A shuffled deck | Every player's view is the same, but less than the state |
| **Hidden per player** | Hands of cards, battleship fleets | Every player's view is different |
| **Revealed later** | Rock-paper-scissors choices | Views differ until a reveal, then become the same |

A game can mix these: a card game has a hidden deck and private hands, and reveals cards as they're played. A mostly open game may still hide a detail. This repository's tic-tac-toe example, for instance, shows each player the other's ID only as `"opponent"`.

### Games without hidden information

Every game is treated as a game with hidden information ([0010](../decisions/0010-every-game-has-hidden-information.md)). A game without hidden information is the special case where every player receives the same information, or all of it. There's no separate mode for it.

Where views happen to coincide, some things become possible as internal details, not as a mode:

- **One message for everyone.** When all views are equal, the server can serialize one and broadcast it.
- **Clients can run the game's rules** when their view equals the full state. A client can then apply its own action immediately, and correct itself if the server disagrees (question 5B).
- **Every action changes every view,** so there are no unchanged views and no gaps in `sequence`.

### When views differ

These consequences apply whenever views differ between players:

- **One update is many messages.** After each action, the server filters the new state once per recipient, and sends each their own payload. A single message can't be broadcast to the whole game. The server does this today, filtering separately for every connected socket.
- **The server can't reuse work across recipients.** Each view must be filtered and serialized on its own.
- **A client can't compute its own next state.** Its view lacks what's hidden, so it can't run the game's rules on it. This rules out using the game's own rules for prediction (question 5B), and means any change set must be computed between two views, never between two states (question 2B).
- **A view can stay the same while the game moves on.** If another player makes a hidden move, a player's view may not change at all. Or it changes only slightly: in the [tutorial](../../tutorials/build-your-first-game.md)'s rock-paper-scissors, Bob only learns *that* Alice has chosen. Today every player receives an update on every action, identical or not. Skipping unchanged views would save messages, but then a client sees gaps in `sequence` and can't tell a skipped update from a missed one, which matters for catch-up (question 3).
- **Views can depend on more than the player.** Players who haven't taken a seat, or spectators, need a view too. What they may see is part of [Player information](player-information.md).
- **Rejections can leak.** The reason `validateAction` gives for rejecting an action goes to the acting client without being filtered.

## Target flow of an action

This is the flow the decisions so far lead to. Open questions are marked at the step they affect.

1. **The client sends an action** over HTTP, with its token. The server authenticates the player. What the response contains is question 6.
2. **The server loads the state.** It takes the per-game lock, then loads the latest full state and its `sequence`.
3. **The plugin validates the action** on the read-only state. A rejected action ends the flow here, with nothing changed or stored.
4. **The server computes each subscriber's previous view,** before the rules run, since they may change the loaded state in place.
5. **The plugin determines the new state** with `executeAction`, by changing the state it received or returning a new one.
6. **The server stores** the new full state, the action and the new `sequence`, in one transaction, and releases the lock. No patches are stored ([0011](../decisions/0011-patches-are-diffs-of-views.md)).
7. **The server filters and sends, per player.** For each subscriber, it computes the new view with `filterStateForPlayer`, then sends:
   - a whole state: the new view
   - or patches: the difference between the previous and the new view ([0011](../decisions/0011-patches-are-diffs-of-views.md))

   Each is converted to the subscriber's chosen format ([0007](../decisions/0007-client-chosen-update-format.md)), and labeled with the `sequence` it applies to and the one it produces.

Step 7 runs again later, on stored data, whenever a reconnecting client asks `GET …/updates` ([0009](../decisions/0009-separate-state-and-update-endpoints.md)): views are recomputed from the stored states before and after each missed step, and diffed.

### Internal and external patches

An earlier version of this flow recorded *internal patches* of the full state while the rules ran, stored them, and filtered them into *external patches* for each player. Internal patches are only worth keeping if there's a generic way to turn them into external ones. The candidates were a second, game-written patch filter, or visibility declared by path, which would have made the game's state cater to its views. Neither was acceptable, so there are no internal patches: the patches clients receive are diffs of their views ([0011](../decisions/0011-patches-are-diffs-of-views.md)).

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
- **The current state is fetched over HTTP,** with `GET …/state` ([0009](../decisions/0009-separate-state-and-update-endpoints.md)), when a client starts or reconnects.

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

The format is partly decided ([0007](../decisions/0007-client-chosen-update-format.md)): each client chooses whole state, JSON Patch, or Immer patches. On the socket, it says so with a `format` handshake parameter ([0008](../decisions/0008-format-query-parameter.md)). Over GET, it uses one endpoint for the whole state and another for updates since a given `sequence`, which takes the patch format as a parameter ([0009](../decisions/0009-separate-state-and-update-endpoints.md)).

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

Decided in [0011](../decisions/0011-patches-are-diffs-of-views.md): patches are the difference between a player's previous and new view, computed with the `rfc6902` library, which produces standard JSON Patch. The alternatives examined on the way are kept here, because they explain the decision.

**Recording changes with Immer.** Immer's `produceWithPatches` records patches while code changes a draft of the state. On a chess move, rules written that way produced exactly the changed squares. But it records patches of the full state, which can leak hidden information, and it requires the rules to change a draft rather than return a new state. The decision drops it, and the server doesn't use Immer.

**Diff libraries.** They compare two finished values. Tested on chess positions:

- **`rfc6902`** gives exactly the two changed squares on full and middlegame boards. On sparse endgame boards, it sometimes describes a move as "insert a new row, remove the last row", because it treats arrays as lists and looks for the cheapest edit. The result is always correct, just not minimal.
- **`microdiff`** compares arrays position by position, so it always gives the changed squares. Its output needs converting to JSON Patch.

Minimal patches are a goal, but not a first concern, so `rfc6902` was chosen for producing standard JSON Patch directly.

**Formats on the wire.** Clients choose JSON Patch or Immer's format ([0007](../decisions/0007-client-chosen-update-format.md)). Immer's patches use the same operations, but give each path as an array (`["board", 4, 4]`) rather than a string (`/board/4/4`). The server converts paths for clients that choose it. Clients don't need Immer unless they choose its format.

**What view diffs require:**

- **A patch is only valid on its exact base.** Each update must say which `sequence` it applies to. A client that isn't at that base needs a whole state instead, which is option C.
- **An empty diff** means the player's view didn't change.

### Patches for games with hidden information

Decided in [0011](../decisions/0011-patches-are-diffs-of-views.md): option E, diffing views. The other options are kept for the reasoning.

Patches recorded on the full state can leak hidden information, and a player may only receive patches that describe their own view. These were the ways to get there.

**A. Whole states only.** Games with hidden information offer only whole-state updates, each player's whole view. Patches are offered only for games without hidden information.

- Safe without any extra work by the game.
- Ruled out as a lasting design by [0010](../decisions/0010-every-game-has-hidden-information.md): since every game is treated as having hidden information, no game would get patches. It can only serve as a temporary state, before patches exist.

**B. A patch filter written by the game.** Next to `filterStateForPlayer`, the game provides a second function that drops or rewrites the patches a player mustn't see.

- Works for any game.
- The game maintains two filters that must agree. A mistake in the patch filter leaks information, and nothing checks the two against each other.

**C. Visibility declared by the game.** Instead of filter code, the game declares which parts of its state each player may see, by path. For example, for a card game:

```ts
visibility: {
  "deck": "nobody",
  "hands/:player": "owner", // only the player whose ID is in the path
  // everything else: everyone
}
```

The library applies the same declaration to both whole states and patches. For a whole state, it removes the hidden paths. For each patch, it finds the rule for the patch's path, and drops the patch for players who can't see it. When a patch replaces a larger part that contains hidden paths, the library filters its value by the same rules. That's filtering, not diffing.

- One declaration for both formats, so views and patches can't disagree.
- Only whole paths can be shown or hidden. Anything derived, such as how many cards an opponent holds, must be kept by the rules as a visible value of its own. A transformation like the tic-tac-toe example's, which shows the opponent's ID as `"opponent"`, can't be expressed.
- **Visibility can change without the hidden data changing.** In rock-paper-scissors, both choices become visible when the round ends, but the action that ends it doesn't touch the choices, so there's no patch to pass on. Rules would need to depend on the state (for example, "visible to everyone once there's a winner"), and the library would need to check, after each action, which paths have become visible or hidden for each player. It would then send the newly visible values as additions, and removals for newly hidden ones.

**D. Patches recorded on each player's view.** The game writes its filter as an Immer producer: instead of returning a new view, it updates a draft of the player's previous view. Immer then records patches of the view directly.

- Exact patches for each player, from any filter logic.
- Every game with hidden information writes its filter in this style, and must change only what differs, or Immer records large replacements. It costs one producer run per player per update.

**E. Diffing views.** For each player, the patches are the difference between their previous and new view, computed by a diff library.

- Safe by construction, since the diff only sees views, and reveals appear in the diff naturally.
- `filterStateForPlayer` stays an ordinary function, free to compute and present data.
- Costs a diff per player per update, and patches aren't always minimal.

### 3. How does a client catch up after missing updates?

While connected, a client receives everything over the socket. The GET endpoints ([0009](../decisions/0009-separate-state-and-update-endpoints.md)) are only needed to close a gap: after reconnecting, a client fetches the updates it missed, or the whole state if the gap is too large.

The current direction is to treat a client's first connection like a reconnect: the client connects the socket, then fetches the whole state with `GET …/state`, and keeps whichever is newer by `sequence`. That gives one mechanism for every gap, and keeps the socket for live updates only. It may not suit every game, so it stays open for revision as more example games are built.

- **A. Fetch the latest state,** as today. Simple, but intermediate states are lost; a client can't animate the moves it missed.
- **B. Fetch everything since a cursor.** `GET …/updates?since=<sequence>&format=…` returns every update after that sequence ([0009](../decisions/0009-separate-state-and-update-endpoints.md)). A client whose gap is too large fetches `GET …/state` instead. This needs the recorded patches stored with each state.
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

- Do some games need the socket to send the current state when a client connects, instead of the client fetching it? If so, should a game be able to choose?
- When a client asks for a patch format the game doesn't offer, should the server reject the request, or fall back to whole states? [0008](../decisions/0008-format-query-parameter.md) currently has it rejected.
- How does `GET …/updates` answer when `since` is older than the stored patches reach, or when the game offers no patches: an error that points to `GET …/state`, or the whole state in its place?
- When are minimal patches worth more than standard output: should `microdiff` replace `rfc6902` for games with board-like arrays?
- Should `GET …/updates` answer step by step, one diff per missed step, or in one jump, a single diff from the view at `since` to the current view, or offer both?
- What do clients need for rendering: to know which data changed, or what happened in game terms? Is keeping unchanged parts as the same objects on the client enough, or must the server send the change?
- How large are the states of the games this is meant for, and how often do they change? This decides whether sending changes is worth the complexity.
- Do clients need intermediate states, for example to animate each move, or only the latest one?
- Should a player joining late see the game's earlier history?
- Which state libraries must the middleware support first? See [Client package](client-package.md).
