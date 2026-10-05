# FruitTD Arena

Arena is one destination with Normal and Ranked queues. Both use the same three-minute tower siege, FruitTD fruit enemies, turret rigs, equipped hero art, and equipped wall skin. There is no slicing in PvP; Campaign, Casual, Horde, and Co-op retain their own rules.

## Fair combat

Both players start with the same wall HP, Fruts, income, main tower, and six turret choices. Account hero levels, perks, mastery, shop coins, and cosmetic stat bonuses do not enter combat. Every hero has Rally: +25% turret and main-tower damage for eight seconds, a 35-second cooldown, and a 15-second opening delay. Equipped appearances are read from the account's cloud save when the match is created.

Build on your blue hexes, select a placed turret to upgrade (maximum level three), or sell it for 60% of the resources spent. Routes cannot be blocked. Rapid turrets handle light attackers; Vortex slows; Laser and Railgun pierce armor; Sprinkler and Blender splash nearby packs. Sending attacks spends the same Fruts used for defence. Identical neutral waves arrive every 15 seconds and grow in number, health, and variety. Attack travel time is normalized across route lengths.

Destroy the opposing wall to win. At three minutes, the healthier wall wins; equal walls draw. Kills are shown as activity score but never break a tie. Surrender or exceeding reconnect grace loses the match. Simultaneous wall destruction draws. Drafts can be cancelled without FR changes and expire after two minutes. Match rules are snapshotted so administrative balance changes apply to new games.

## Rating and matchmaking

The profile and header show server Ranked Arena FR and its tier color, rather than solo high scores. Normal records are separate and do not change FR. Ranked results use an expected-result rating calculation: equal-rating wins grant 50 FR, losses remove 50, and draws change zero. Beating a stronger opponent gives more; losing to a stronger opponent costs less. Slicing cannot award rating bonuses.

Both public queues use Ranked FR to pair similar opponents. The initial rating window is 100 FR and expands by 50 every 15 seconds, capped at 300 in Ranked and 500 in Normal. The narrower of both players' windows applies. Initially, opponents must share a tier. Adjacent tiers become eligible only after both players wait 30 seconds. Larger tier gaps never become eligible: Bronze cannot face Diamond. Queues never mix; friend challenges are intentionally unranked and can cross tiers.

The server owns commands, costs, targeting, damage, result settlement, and ratings. Sequence numbers and optimistic revisions reject duplicate/stale actions; a unique active-player index prevents concurrent matches. Waiting players are reconsidered during status polling as search windows expand. Players are never silently replaced with bots; the existing bot facility is an admin playtest with no ratings or rewards.

## Validation and remaining limits

Automated checks cover both queue UI flows, profile rank source/color, legal hex picking on all seven maps from both sides in a phone-sized camera, command ownership/resources/replay, upgrades/refunds, slicing rejection, Rally fairness/cooldown, armor/slow/splash counters, equal waves, rating calculations, matchmaking bounds, and match results. Production TypeScript, browser bundles, and Vercel API bundles are built together.

These checks establish rules and interaction correctness, not a measured metagame. Live two-player sessions and real-device Safari rendering still require playtesting; win rates, turret usage, queue times, and match duration should guide subsequent tuning.
