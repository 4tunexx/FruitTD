# Fruit TD

Fruit-slicing tower defense with daily bonuses, quests, monthly ranked tiers, and a live admin control center. MongoDB Atlas backs scores, missions, and config.

## Local

```bash
npm install
```

Copy `.env.example` to `.env` and set `MONGODB_URI` and `STEAM_API_KEY`.

```bash
npm run server
npm run dev
```

Game: http://localhost:5173 · API: http://localhost:3001

## Vercel

1. Import [4tunexx/FruitTD](https://github.com/4tunexx/FruitTD) in Vercel (Framework Preset: **Vite**).
2. Add environment variables:
   - `MONGODB_URI` — Atlas connection string
   - `STEAM_API_KEY` — Steam Web API key
3. In Atlas → Network Access, allow `0.0.0.0/0` so Vercel can reach the cluster.
4. Deploy. `/api` is served from the same project as the game.
