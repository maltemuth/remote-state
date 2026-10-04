# Hide information from players

Use `filterStateForAudience` whenever players must not see all of the state, such as hands of cards, fog of war, or secret choices.

## Write the filter

The filter turns the full state into what one audience may see. By default, each player is an audience of their own, named by their player ID, so for most games the audience is the player:

```ts
filterStateForAudience: (state, playerId) => ({
  pot: state.pot,
  myHand: state.hands[playerId] ?? [],
  // Other players: only how many cards they hold
  handSizes: Object.fromEntries(
    Object.entries(state.hands).map(([id, cards]) => [id, cards.length]),
  ),
}),
```

Give the result its own type (the third type parameter of `GamePlugin`). That way the compiler catches a field that leaks through a spread like `{ ...state }`.

## Group players who see the same thing

When many players see the same view, such as spectators, put them in a shared audience. The view is then computed once for all of them. Return `withAudiences` from `onJoin` or `executeAction`:

```ts
import { withAudiences } from "@malte.muth/remote-state";

onJoin: (state, { playerId, details }) => {
  if (details.spectator) {
    return withAudiences(state, { [playerId]: "spectators" });
  }
  // … seat the player
},
```

The filter then receives `"spectators"` as the audience, and must handle it:

```ts
filterStateForAudience: (state, audience) => ({
  pot: state.pot,
  myHand: audience === "spectators" ? [] : (state.hands[audience] ?? []),
  // …
}),
```

To move a player back to their own audience, set it to `null`. Players who change audience receive patches from their old view to their new one. See [GamePlugin](../reference/game-plugin.md#withaudiences).

## Things to get right

- **Build up from nothing rather than removing fields.** A filter that starts from `{ ...state }` and deletes secrets will leak any secret field added to the state later.
- **Handle every audience the game can have.** That's the ID of every player who joined, including any your game didn't seat, and every audience name you set with `withAudiences`. For anyone else, return a view that reveals nothing private.
- **Keep the filter pure.** Views of past states are rebuilt from stored states, for example when a client catches up. The view must depend only on the state and the audience.
- **Don't rely on the client.** Anything in the view can be seen in the browser's dev tools, even if the UI never shows it.
- **Consider what the rules reveal.** `validateAction` messages and `GameRefusal` reasons go to the client. A message like `"Bob already has the ace of spades"` leaks information that the filter hides.

## Test it

Assert on what a player _can't_ see, not just on what they can. For example, with supertest (see [Test a game plugin](test-a-game-plugin.md)):

```ts
const bobView = await request(server.app)
  .get(`/api/games/${gameId}/state`)
  .set("Authorization", `Bearer ${bob.token}`)
  .expect(200);

expect(JSON.stringify(bobView.body)).not.toContain("rock");
```

## Limits

The filter controls what clients receive, not what's stored. The database holds the full state, every action, and a diff of the full state for each transition. See [Architecture](../explanation/architecture.md#hidden-information).
