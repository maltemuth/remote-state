# Audiences

Status: Open; mostly decided in [0024](../decisions/0024-views-per-audience.md) [0025](../decisions/0025-default-audiences.md) and [0027](../decisions/0027-audiences-set-by-join-hook-and-actions.md)

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

| Game        | Audiences                               |
| ----------- | --------------------------------------- |
| Chess       | `everyone`                              |
| Poker       | one per seated player, and `spectators` |
| A team game | one per team, and `spectators`          |

For every action, the library computes one view and one diff per audience, not per participant, and stores the diffs by audience. Each connection receives its audience's updates. A hundred spectators cost the same as one, and games without hidden information cost one view per action.

This generalizes [0010](../decisions/0010-every-game-has-hidden-information.md): "every player receives the same information" becomes a game with a single audience, rather than a special case that happens to repeat the same work.

It also separates two things the library has so far treated as one: taking part in a game, and seeing it. Anyone admitted to a game ([0020](../decisions/0020-hosts-admit-players-through-codes.md)) is a _participant_, with tokens; whether they hold a seat, may chat, or only watch is the game's business, in its state and rules. Spectators need no concept of their own in the library.

## Questions to decide

Decided in [0024](../decisions/0024-views-per-audience.md):

1. **How membership is known:** each player's audience is stored on the player, rather than computed from the state.
2. **Membership:** exactly one audience per player.
3. **Changing audience:** the player starts from a whole state; refined by [0035](../decisions/0035-updates-across-audiences.md), which computes a diff across audiences instead.
4. **Storage:** diffs are stored per audience, and membership is recorded after each action.

5. **Default audiences:** a single audience for everyone when the game has no view filter, one per player when it has one ([0025](../decisions/0025-default-audiences.md)).

6. **Setting audiences:** by the join hook and by actions ([0027](../decisions/0027-audiences-set-by-join-hook-and-actions.md)).

## Open questions

- Whether audience names are ever shown to clients, or stay internal.
