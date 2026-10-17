# 0057. Patches come from a diff of our own, comparing arrays by position

Status: Accepted
Date: 2026-10-17

## Context

Patches were computed with `rfc6902` and converted to Immer's format ([0011](0011-patches-are-diffs-of-views.md), [0014](0014-immer-patches-only-external-format.md)). `rfc6902` builds a JSON Pointer string for every operation, which the library parsed back into a path, resolving each index against a copy of the old view that every operation was applied to. It compares arrays as lists, looking for the cheapest edit, which costs the product of their lengths, and on sparse boards describes a move as inserting and removing rows.

With views and patches computed only when sent ([0056](0056-views-and-patches-computed-when-sent.md)), the load test in the `immer` format spent 39% of its time in `rfc6902`, about half of it on pointer strings, and handled 193 actions per second against 283 with whole views ([measurements](../../reference/performance.md)).

## Decision

The library diffs views with about fifty lines of its own, producing Immer's patches directly:

- **Objects** by key: removed keys, added keys, and the values of the others compared in turn. A key holding `undefined` counts as absent, as in JSON.
- **Arrays by position:** each shared index compared in turn, then items added at the end or removed from the end.
- **Anything else** that differs is replaced. Parts that are the same object in both views are skipped without looking inside.

`rfc6902` is no longer a dependency.

## Alternatives considered

- **`microdiff`,** set aside in 0011: it compares arrays by position too, but its output would still need converting.
- **Keeping `rfc6902` and caching pointer conversions.** Saves part of the overhead, and keeps the list comparison.

## Consequences

- In the `immer` format, the load test handled about 325 actions per second instead of 193, more than with whole views, and diffing no longer shows in the profile.
- A move on a board is always the squares that changed.
- Inserting into the middle of a list gives a patch for every item after it, instead of one insert. Patches are still correct, and game views rarely do that.
- Diffs of views that share unchanged parts with the previous view, as games that keep states in memory would, cost only the parts that changed.
