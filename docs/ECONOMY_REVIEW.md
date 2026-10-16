# FruitTD economy review — 16 October 2026

## Rules players should be able to understand

| Resource | Earned from | Spent on | Scope |
| --- | --- | --- | --- |
| Fruts | Solo kills, wave clears and rare drops; PvP/online Co-op time and enemy kills | Match towers, upgrades, powers and attacks | One run or match; always starts at zero |
| Coins | Solo wave/boss/end rewards, drops, claims and online match settlement | Shop equipment and purchase-only heroes | Account |
| Gems | Bosses, rare drops, claims and ranked season rewards | VIP tiers | Account |
| Hero XP | Combat and match rewards | Hero levels/unlocks; skill points from level milestones | Account |
| Tower XP | Solo combat, online Co-op waves; PvP combat gives a career statistic at settlement | Solo/Co-op run level and its combat bonuses | Run level resets; lifetime total is a statistic only |

Competitive Arena/Ranked PvP deliberately uses match Fruts to upgrade the main tower to level three; the account's hero and tower levels must not enter competitive damage calculations. PvP still awards hero XP and lifetime tower XP after a scored match. Solo Ranked is a separate score-run mode, so its rank is not the same as Arena PvP rating.

## Opening and progression checks

- Solo default wave 1 has seven sliceable fruit; wave 2 has nine. Both opening waves are free of turret-only bombs, including when an admin authors the wave. The first possible turret-only bomb is wave 3.
- With zero starting Fruts, 60% of fruit killed in each of those waves, no perfect-wave bonuses, and the ordinary eighth-kill drop, the Fruts total after wave 2 is Casual 62, Solo Ranked 52, local Co-op 60, solo Arena 54, Horde 58, Campaign 58. The cheapest turret costs 50. This is an affordability check, not a claim that leaking 40% of fruit is survivable in every mode.
- Clearing a wave with zero kills gives no wave reward. A player cannot earn repeat Fruts and account coins merely by letting every enemy leak.
- Online Co-op starts with zero shared Fruts, accrues six Fruts per second in the default balance, and adds kill bounties. Its shared tower earns 25 XP per cleared wave, reaching level two after wave 4. A new room starts at zero XP and level one.
- Arena PvP starts both players with zero Fruts and the same six Fruts per second default income. A basic attack costs 35 Fruts; the cheapest defensive turret costs 80. Its main tower begins at level one and already attacks. Main tower levels two and three cost 220 and 340 Fruts.
- Permanent shop gear costs Coins, with starter blades/walls free. Gems buy VIP. Fruts cannot purchase account gear; Coins/Gems cannot buy match towers.

## Comparison used for the design

Ironhide's [Kingdom Rush Frontiers](https://kingdomrush.com/kingdom-rush-frontiers) emphasizes choosing towers and specialized upgrades. Its [Genesis balance notes](https://www.ironhidegames.com/News/Details/534) describe giving Casual more gold and improving hero levelling when the opening economy creates friction. Its [Kingdom Rush Battles guide](https://support.ironhidegames.com/support/solutions/articles/4000223620-kingdom-rush-battles-beginners-guide) distinguishes battle tactics from longer-term rewards. We use those as principles for a reachable first build, visible in-run choices and separate account rewards. The numerical values above are FruitTD's own tuning, not copied from those games.

## Verified in code and tests

The opening test plans all six solo modes and checks both hazard timing and an affordable first turret. Other tests cover independent currencies, rare-drop cadence, campaign first-sector purchasing, PvP commands and resets, online Co-op spending and room-scoped tower XP, cloud reward caps and atomic claims. `npm test` and `npm run build` remain release gates.

## Remaining release risks

1. Solo combat and run rewards are calculated by the browser. A one-use run token and server score/time/reward caps limit abuse but do not prove each kill, wave or reward. Fully trusted competitive solo scoring requires a server-authoritative simulation or server-verifiable combat event log. Do not describe the present solo leaderboard as cheat proof.
2. The opening arithmetic checks the default/content-backed wave plans, not every possible admin-authored campaign boss, future enemy ability, phone gesture or live network failure. Real-device runs are needed to measure survival, first-turret timing, match length and touch hit rates.
3. The current balance is a starting curve, not a measured player economy. Collect per-mode death wave, first tower time, Fruts left at end, tower use, hero level gain, Coins/Gems earned per run and shop purchase rates before adjusting prices further.
4. PvP Fruts upgrades and solo XP levels are distinct systems. If one identical levelling mechanic across all modes is required, competitive balance and the Arena UI need a separate design and simulation pass before changing ranked combat.
