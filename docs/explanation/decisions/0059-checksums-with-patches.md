# 0059. Patches can carry a checksum of the view they lead to

Status: Accepted
Date: 2026-10-18

## Context

The library has to guarantee that every client's view is the server's. Patches are only correct relative to the view they're applied to: a wrong patch, a client bug, or a mistake in catching up would leave a client with a view that silently differs, and every later patch would build on it. Diffs are tested against a reference ([0058](0058-rfc6902-kept-as-reference-and-option.md)), but a client couldn't tell that its view had gone wrong.

## Decision

- **With the `checksums` option, every `patches` event and every `GET …/updates` answer carries `checksum`,** the checksum of the view the patches lead to. It's off by default.
- **The checksum is cyrb53 over the view's canonical JSON:** object keys sorted, `undefined` left out as `JSON.stringify` leaves it out, values with `toJSON` converted first. A client applies patches with Immer, which may put keys in another order than the server's view, so the order mustn't count. The result is a safe integer, and the algorithm is documented so clients in other languages can compute it.
- **The client package checks every checksum it gets.** When a view doesn't match, it reports a `ChecksumError` to `onError` and fetches the whole view.
- **Whole views carry no checksum;** there's nothing a client could have built wrong.

## Alternatives considered

- **A cryptographic hash, such as SHA-256.** Guards against tampering, which the transport and the token already do, costs more, and is asynchronous in browsers.
- **Hashing the JSON as sent.** Cheaper, but key order would differ between the server's view and the one a client builds.
- **Checksums always on.** Costs every server a canonical serialization per audience and transition, about 4% of the CPU per action in the load test.

## Consequences

- A client finds out when its view differs, and repairs it by itself.
- Each update with patches gets about 25 bytes longer, and each audience's view is serialized once more per transition.
- cyrb53 has 53 bits: two different views have the same checksum with a chance of about 1 in 10^16, enough to catch mistakes, not to prove correctness.
