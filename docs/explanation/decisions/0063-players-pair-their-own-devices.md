# 0063. Players can pair their own devices

Status: Accepted
Date: 2026-10-21

## Context

A player can have several tokens, one per device ([0019](0019-several-tokens-per-player.md)), and a lost token or a second device is handled by the host admitting the same identity again ([0020](0020-hosts-admit-players-through-codes.md)). That needs the person to reach the host on the new device: to log in there, which a guest without a password can't, or for every app to build its own way of handing a device over.

The common case is a player at a game on one device who wants to follow it on another, such as a phone beside a laptop, as the same player. They're already admitted; the host has already decided they may play. What's missing is a way to carry that over to a device that has nothing yet, often by pointing its camera at a QR code.

[0020](0020-hosts-admit-players-through-codes.md) keeps codes out of URLs. A QR code can only carry a link, so a code for pairing has to travel in one.

## Decision

- **A player can ask for a code for themselves:** `POST /api/games/:gameId/codes`, with their token, answers with a single-use admission code for the same identity, with the same lifetime as `admit`'s. Redeemed at `POST /api/tokens`, it gives the other device a new token for the same player; the game's join hook doesn't run, since the player exists.
- **Hosts turn it on,** with the `devicePairing` option, off by default. Who may add devices is the host's policy ([0016](0016-authentication-in-library-authorization-by-implementer.md)); a host that turns it on lets every player of its games pair devices.
- **A pairing code may travel in a link's fragment,** the part after `#`, which browsers don't send to servers or in `Referer`. This relaxes 0020 for pairing codes only: they're single-use, expire within a minute, and only ever stand for a player who already exists.
- **The client offers `pairingCode()`;** the device that gets the code redeems it with `redeemCode`, as it would any code.

## Alternatives considered

- **Each app pairs devices itself,** by logging the person in on the new device and admitting them again. Every app with players on phones would build the same thing, and apps with guests would need their own way to carry a guest over.
- **A pairing code that's a token for a while,** used directly instead of redeemed. One request fewer, but tokens would be in links, and couldn't be told from those of devices the player kept.
- **Keeping codes out of URLs,** and having the new device show a short code to type into the old one. Works without a camera, but needs the new device to reach the game before it's admitted, which nothing allows today.

## Consequences

- A player can bring a phone into a game in a few seconds, without the app's login, also as a guest.
- Anyone who sees the QR code, or the link, within the minute can redeem it once, and play as the player. Apps should show it only to the player, and briefly.
- A paired device's token is like any other: it stays valid until token revocation exists ([0018](0018-no-token-expiration-or-revocation.md)).
- Whether a paired device may act or only watch is the app's for now; the library treats every token of a player alike.
