# Hide information from players

Use `filterStateForPlayer` whenever players must not see all of the state, such as hands of cards, fog of war, secret choices, or other players' IDs.

## Write the filter

Return a new object containing only what `playerId` may see:

```ts
filterStateForPlayer: async (state, playerId) => ({
  pot: state.pot,
  myHand: state.hands[playerId] ?? [],
  // Other players: only how many cards they hold
  handSizes: Object.fromEntries(
    Object.entries(state.hands).map(([id, cards]) => [id, cards.length])
  ),
}),
```

Give the result its own type (the third type parameter of `GamePlugin`). That way the compiler catches a field that leaks through a spread like `{ ...state }`.

## Things to get right

- **Build up from nothing rather than removing fields.** A filter that starts from `{ ...state }` and deletes secrets will leak any secret field added to the state later.
- **Keep secrets out of the action's response too.** The acting player's own response passes through the filter, so there's nothing extra to do there.
- **Don't rely on the client.** Anything in the filtered state can be seen in the browser's dev tools, even if the UI never shows it.
- **Handle every `playerId` the server can pass.** That includes players who registered but never claimed a seat in your game. For them, return a view that reveals nothing private.
- **Consider what the rules reveal.** `validateAction` messages go to the client. A message like `"Bob already has the ace of spades"` leaks information that the filter hides.

## Test it

Assert on what a player *can't* see, not just on what they can. For example, with supertest (see [Test a game plugin](test-a-game-plugin.md)):

```ts
const bobView = await request(server.app)
  .get(`/api/games/${gameId}/state/current`)
  .set("Authorization", `Bearer ${bob.token}`)
  .expect(200);

expect(JSON.stringify(bobView.body)).not.toContain("rock");
```

## Limits

The filter controls what clients receive, not what's stored. The database holds the full state and every action. See [Architecture](../explanation/architecture.md#hidden-information).
