# Hide information from members

Use `view` when members must not see all of the state: hands of cards, sealed bids, secret choices.

## Write the view

Each member is an audience of their own, named by their member ID, so the audience is usually the member:

```ts
view: (state, memberId) => ({
  pot: state.pot,
  myHand: state.hands[memberId] ?? [],
  handSizes: Object.fromEntries(
    Object.entries(state.hands).map(([id, cards]) => [id, cards.length]),
  ),
}),
```

Give the view its own type, the third type parameter of `Rules`, so the compiler catches a field leaking through.

## Group members who see the same thing

Put spectators, for example, in a shared audience, whose view is computed once. Return `withAudiences` from `onJoin` or `executeAction`, and handle the audience in `view`:

```ts
onJoin: (state, { memberId, details }) =>
  details.spectator ? withAudiences(state, { [memberId]: "spectators" }) : seat(state, memberId),

view: (state, audience) => ({
  pot: state.pot,
  myHand: audience === "spectators" ? [] : (state.hands[audience] ?? []),
}),
```

`null` moves a member back to their own audience. Members who change audience get patches from their old view to the new one.

## Get it right

- **Build the view up from nothing.** Starting from `{ ...state }` and deleting secrets leaks every secret added later.
- **Handle every audience:** every member who joined, seated or not, and every name you set. Reveal nothing private to anyone else.
- **Keep it pure.** Past views are rebuilt from stored states, so the view may depend only on the state and the audience.
- **Mind the messages.** `validateAction` reasons and `Refusal` messages reach the client unfiltered.
- **Test what a member can't see:** `assert.doesNotMatch(JSON.stringify(view), /rock/)` ([Test your rules](test-your-rules.md)).

`view` controls what clients receive, not what's stored: the database holds every full state ([Architecture](../explanation/architecture.md#hidden-information)).
