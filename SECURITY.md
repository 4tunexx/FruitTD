# Security

## Required deployment settings

Set these values in the deployment environment and never commit them:

- `ADMIN_STEAM_ID`: the Steam ID allowed to administer the game
- `MONGODB_URI`: the production database connection string
- `CORS_ORIGINS`: comma-separated trusted browser origins
- `STEAM_API_KEY`, `RESEND_API_KEY`, and session-related settings as applicable

Admin actions, leaderboard writes, and cloud-save writes require an authenticated
session. The browser Steam ID and client-supplied user IDs are not authorization.

Report vulnerabilities privately to the repository owner rather than opening a
public issue with exploit details.
