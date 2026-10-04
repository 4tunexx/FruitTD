# Online match service

Arena, Ranked and online Co-op use the same persistent Node service. The website
and account APIs can remain on Vercel. Ably delivers snapshots; the Node service
runs the matches and grants rewards. Ably keys alone do not host that service.

## Persistent host

Deploy this repository's Dockerfile, or run `npm ci --include=dev` followed by
`npm run server` on a Node 22 host. Run one service instance: it manages the
matchmaking queue and the simulation loops. Set these environment variables:

- `MONGODB_URI` and `MONGODB_DB`: the same database as the Vercel account APIs.
- `SESSION_SECRET`: exactly the same value as Vercel, so existing accounts work.
- `ABLY_API_KEY`: the Root key, kept on the server.
- `ADMIN_STEAM_ID`: the same admin account as Vercel.
- `CORS_ORIGINS`: `https://fruit-td.vercel.app` and any additional approved website origins.
- `NODE_ENV`: `production`.
- `PORT`: the port assigned by your host.

## Vercel website

Set `VITE_PVP_API_URL` to `https://YOUR-MATCH-HOST/api/pvp` and redeploy the website.
Online Co-op derives `https://YOUR-MATCH-HOST/api/coop` from that address.
Keep Ably keys out of every `VITE_` variable. Browsers obtain short-lived,
match-specific subscribe tokens from the authenticated service. The standalone
Subscribe key is not required by this token flow.

## Deployment acceptance

Use two separate signed-in accounts on two devices. Verify public matchmaking,
private Co-op room creation/join/leave, Arena friend challenges, map vetoes,
live blade trails, identical match state, a full match result, and reconnect
within 45 seconds. Check both wallets and the FR ladder after completion.
Admin bot playtests must leave FR points and rewards unchanged.

Automated tests use isolated accounts and storage. They do not replace this
deployed two-account check.
