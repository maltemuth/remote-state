# Hide information from players

Use `filterStateForAudience` when players must not see all of the state: hands of cards, fog of war, secret choices.

## Write the filter

Each player is an audience of their own, named by their player ID, so the audience is usually the player:

```ts
filterStateForAudience: (state, playerId) => ({
  pot: state.pot,
  myHand: state.hands[playerId] ?? [],
  handSizes: Object.fromEntries(
    Object.entries(state.hands).map(([id, cards]) => [id, cards.length]),
  ),
}),
```

Give the view its own type, the third type parameter of `GamePlugin`, so the compiler catches a field leaking through.

## Group players who see the same thing

Put spectators, for example, in a shared audience, whose view is computed once. Return `withAudiences` from `onJoin` or `executeAction`, and handle the audience in the filter:

```ts
onJoin: (state, { playerId, details }) =>
  details.spectator ? withAudiences(state, { [playerId]: "spectators" }) : seat(state, playerId),

filterStateForAudience: (state, audience) => ({
  pot: state.pot,
  myHand: audience === "spectators" ? [] : (state.hands[audience] ?? []),
}),
```

`null` moves a player back to their own audience. Players who change audience get patches from their old view to the new one.

## Get it right

- **Build the view up from nothing.** Starting from `{ ...state }` and deleting secrets leaks every secret added later.
- **Handle every audience:** every player who joined, seated or not, and every name you set. Reveal nothing private to anyone else.
- **Keep it pure.** Past views are rebuilt from stored states, so the view may depend only on the state and the audience.
- **Mind the messages.** `validateAction` reasons and `GameRefusal` messages reach the client unfiltered.
- **Test what a player can't see:** `assert.doesNotMatch(JSON.stringify(view), /rock/)` ([Test a game plugin](test-a-game-plugin.md)).

The filter controls what clients receive, not what's stored: the database holds every full state ([Architecture](../explanation/architecture.md#hidden-information)).
