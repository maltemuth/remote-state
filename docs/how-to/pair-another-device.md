# Pair another device

A player can follow a game on a second device, such as a phone beside their laptop, as the same player. The device they're playing on gets a code, and the other one redeems it. No login is needed on the new device. For why it works this way, see [0063](../explanation/decisions/0063-players-pair-their-own-devices.md).

## Turn it on

Pairing is off by default. Turn it on with the server option `devicePairing`:

```ts
const remote = await createRemoteState(myGame, { devicePairing: true });
```

## Show a code on the device the player is using

Get a code from the player's client, and put it in a link to a page of your app, in the fragment, so it never reaches a server. Show the link as a QR code, only to the player, and only briefly: anyone who uses it within the minute plays as them.

```ts
const code = await client.pairingCode();
const link = `${location.origin}/games/${client.session.gameId}/pair#${code}`;
showQrCode(link); // with a QR code library of your choice
```

## Redeem it on the other device

On the page the link opens, take the code from the fragment, remove it from the address, and redeem it as any code:

```ts
import { createClient, redeemCode } from "@malte.muth/remote-state-client";

const code = location.hash.slice(1);
history.replaceState(null, "", location.pathname);
const session = await redeemCode(code, { baseUrl });
const client = createClient({ session, baseUrl });
```

The new device is the same player, with a token of its own, and gets the same view. Keep its session as you keep any other, so a reload doesn't need a new code. A code that's used, or older than a minute, is refused with `401 Invalid, used or expired code`: show a new one.
