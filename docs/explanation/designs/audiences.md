# Audiences

Status: Open

## Problem

Every connection gets a view of the state filtered for one player ([0010](../decisions/0010-every-game-has-hidden-information.md)), and every action computes and stores a diff for each player's view ([0012](../decisions/0012-store-player-diffs.md)). That fits players, who each see something different. It fits badly for:

- **Spectators.** In poker, the players each see their own hole cards, but all spectators see the same thing. Filtering, diffing and storing one view per spectator repeats the same work, and a hundred spectators store a hundred identical diffs per action. A spectator also isn't a player: they have no seat, but may still act, for example in a chat that's part of the game's state.
- **Games without hidden information.** In chess, every player gets the same view, yet it's computed, diffed and stored once per player.
- **Shared views among players,** such as a team that sees its own cards, or a coach who sees one team's.

## Constraints

- **Hidden information stays hidden.** Which view a connection gets is decided by the server, from the game's state, never chosen by the client.
- **The game decides.** Who sees what is a rule of the game ([0016](../decisions/0016-authentication-in-library-authorization-by-implementer.md), [0022](../decisions/0022-roles-belong-to-game-state.md)).
- **One state per game** ([Known limitations](../limitations.md)). Audiences are views of that one state.
- **Nothing changes for clients** beyond which view they're given: the same formats, catch-up and events ([0009](../decisions/0009-separate-state-and-update-endpoints.md), [0014](../decisions/0014-immer-patches-only-external-format.md)).

## The idea

An **audience** is a group of participants who all see the same view. The game filters the state for an audience instead of for a player, and says which audience each participant belongs to:

| Game | Audiences |
|---|---|
| Chess | `everyone` |
| Poker | one per seated player, and `spectators` |
| A team game | one per team, and `spectators` |

For every action, the library computes one view and one diff per audience, not per participant, and stores the diffs by audience. Each connection receives its audience's updates. A hundred spectators cost the same as one, and games without hidden information cost one view per action.

This generalizes [0010](../decisions/0010-every-game-has-hidden-information.md): "every player receives the same information" becomes a game with a single audience, rather than a special case that happens to repeat the same work.

It also separates two things the library has so far treated as one: taking part in a game, and seeing it. Anyone admitted to a game ([0020](../decisions/0020-hosts-admit-players-through-codes.md)) is a *participant*, with tokens; whether they hold a seat, may chat, or only watch is the game's business, in its state and rules. Spectators need no concept of their own in the library.

## Questions to decide

### 1. How does the game describe audiences?

- **A. Two functions:** one gives a participant's audience from the state, for example `audienceOf(state, participantId) → string`; one filters the state for an audience, for example `viewFor(state, audience)`. The library also needs to know every audience for which to store diffs, which it could collect from all participants.
- **B. One function returning all views at once,** for example `views(state) → { [audience]: view }`, plus the membership function. The game controls the full set of audiences, including ones with no participant yet.

### 2. Does a participant belong to exactly one audience?

One audience per participant keeps a view a single state, as clients expect. A coach who sees their team *and* the public table would then need an audience of their own, whose view combines both.

### 3. What happens when a participant changes audience?

For example, a player who is knocked out and keeps watching as a spectator. Their socket moves to the new audience's updates. Their `since` sequence refers to the old audience's views, so catching up needs a whole state first ([0009](../decisions/0009-separate-state-and-update-endpoints.md)). When membership is checked matters too: on every action, or only when the game says so.

### 4. How are audiences stored?

Diffs are stored by audience instead of by player, which supersedes part of [0012](../decisions/0012-store-player-diffs.md). A participant's history is then the history of the audiences they belonged to. Open: whether the library also records who was in which audience when, which [0012](../decisions/0012-store-player-diffs.md) gave for free as "what each player was sent".

### 5. Default audiences

A game that describes no audiences could get one audience per participant, which is today's behavior, or a single `everyone`, which fits games without hidden information and is cheapest.

## Open questions

- What the game's join hook ([Authorization](authorization.md)) returns for a new participant, and whether that's where their audience is first set.
- Whether audience names are ever shown to clients, or stay internal.
