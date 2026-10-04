# Arena and Ranked hosting

The website can stay on Vercel. Real-time matches need the persistent Node service started by `npm run server`; Vercel's serverless function cannot keep the match simulation alive between requests.

## Persistent Node service

Deploy this repository to a persistent Node host and start it with `npm ci --include=dev` followed by `npm run server`. Configure these server-only environment variables on that host:

- `MONGODB_URI` for the same MongoDB cluster used by the website. The game currently stores its data in the `FruitTD` database.
- `SESSION_SECRET` matching the account API deployment, so existing sign-in sessions authenticate against this server.
- `ABLY_API_KEY` with the full server publishing key.
- `ABLY_SUBSCRIBE_KEY` with the restricted subscribe-only key from the same Ably app.
- `CORS_ORIGINS` with the Vercel site origin and any custom site origin, comma-separated.
- `APP_URL` with the public site URL where required by existing account/email flows.

Set `PORT` to the port supplied by the host. Keep both Ably keys server-only; never use a `VITE_` prefix for them.

## Vercel website

Set `VITE_PVP_API_URL` to the persistent service's public API base ending in `/api/pvp`, for example `https://your-game-server.example.com/api/pvp`, then redeploy the website. Leave it unset for local development, where Vite proxies `/api` to `http://localhost:3001`.

The Ably keys belong on the persistent Node service. Do not add them to browser-exposed Vercel variables. If the API routes are ever deliberately hosted on a server runtime that both publishes and issues Ably tokens, configure them there instead. The browser receives only a short-lived token limited to subscribing to its own match channel.

## Key replacement

When replacing temporary keys, create a new publisher key and a new subscribe-only key in the same Ably app. Update both server variables together, restart the Node service, verify a two-client match, and then revoke the old keys in Ably.
