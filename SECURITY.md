# Security

## Required deployment settings

Set these values in the deployment environment and never commit them:

- `ADMIN_STEAM_ID`: the SteamID64 allowed to administer the game. This is an
	identifier, not a secret; set it in Vercel Project Settings > Environment
	Variables for Production, then redeploy and sign in through Steam with that
	exact account. A successful session will receive `isAdmin: true` and show
	the Admin menu automatically.
- `MONGODB_URI`: the production database connection string
- `CORS_ORIGINS`: comma-separated trusted browser origins
- `STEAM_API_KEY`, `RESEND_API_KEY`, and session-related settings as applicable

Admin actions, leaderboard writes, and cloud-save writes require an authenticated
session. The browser Steam ID and client-supplied user IDs are not authorization.

Report vulnerabilities privately to the repository owner rather than opening a
public issue with exploit details.
