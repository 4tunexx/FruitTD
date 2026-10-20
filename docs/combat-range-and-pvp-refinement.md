# Combat range, health and PvP refinement

## Player-visible changes

- Ordinary enemy HP stays hidden until actual damage. Bosses in solo/local play retain their one HUD meter.
- Remove the standalone solo Build button and the PvP Build toolbar action. Tap an empty pad to choose a turret; tap a placed turret or main tower for properties. Online Co-op now also opens its turret picker from a pad rather than keeping all turret cards on screen or immediately spending on the previously selected turret.
- Arena/Ranked use two long, straight, mirrored Casual-style halves. Shipped short arenas upgrade to 24 rows per half. All ten build pads belong to the rear half of each player's own lane; the authoritative server also rejects forward cells from older snapshots. Enemy territory is never pickable.
- Mobile PvP opens focused on your defence. Pan/pinch, the overview toggle and collapsed zoom controls reveal the full arena. The permanent left action sidebar is replaced by a small bottom resource/action strip. Capture, Rally and main-tower shortcuts are behind a controls toggle; hero powers sit on the screen edge. Player details and action drawers collapse independently.
- Team color appears on names, avatar outlines, unit allegiance and HP frames. The chosen wall/tower art keeps its own colors and skin.
- Solo/local, PvP and online Co-op use the same segmented ground HP rail, contrasting inset, warning colors and delayed damage trail. Tower hits display rounded damage numbers. XP rails have a lightweight charging glint, respecting reduced-motion settings.

## Actual combat rules

Offensive hero powers, Super Juice and Ki's tap pulse cannot damage enemies outside the main tower's current combat radius. Within the radius, damage is multiplied by `1 - 0.65 × (distance / radius)^2`: full strength at the origin, 35% at the edge. Target selection, splash and piercing all receive the same range restriction. Online commands enforce it server-side, including interpolated attacker positions and exclusion of units still on the opponent's approach.

All 30 hero powers use base cooldowns of 18/22/26/30/35/42 seconds. Each purchased rank adds 20% of base damage and reduces base cooldown by 5%, to at most 20% reduction at rank five. Slow duration and guard healing also retain rank scaling. Tower upgrades expand reach; power ranks do not silently grant unlimited reach. Hero screens and recharge sweeps use the same statistics as combat. Empty offensive casts and full-health guards with no targets do not spend resources or start cooldowns.

Super Juice kill charge is reduced to 1.6 plus a small Flow bonus. Ordinary slices add a small amount; repeat cuts add less. Power kills and their cascades do not refill juice. Ki's pulse now shares the range restriction, has a short tap cooldown, and keeps the correct power-kill source so it cannot refill itself.

Bladebound ordinary enemies and campaign bosses already existed with pink markings and Creator art slots. Their slice-only immunity remains enforced in solo/local play. Online Co-op now also spawns slice-only fruit after wave seven and marks every second boss slice-only. Turrets and powers skip these units; direct player blades damage them. PvP has no player slicing, so it does not spawn an enemy that would be impossible to kill there.

Tower XP remains temporary for the current run. Arena/Ranked keep their separate Fruts-based level 1–3 main-tower upgrade rules; online Co-op's run XP improves its main damage and power radius. Career/lifetime tower statistics do not restore a previous run's tower level. Permanent wallet claims and rewards continue through their existing server-owned paths.

## Admin consistency

Arena/Ranked Admin previews use the actual battlefield, long straight road and shared HP rail. The pad painter rejects the forward half, offers a defensive-pad reset, and publishes through the same map normalization used by matches. Route editing now restores a straight road instead of offering a route that contradicts the requested straight-map presentation. PvP level preview is bounded to its actual three turret levels. The power reference lists actual rank-one/rank-five damage and cooldown values and explains range/falloff. Existing main-tower range/damage, turret, enemy and Co-op balance editors remain wired to the shared combat configuration; Creator retains Bladebound art support.

## Verification and limits

Full regression suite and TypeScript/Vite/API builds are run on the exact source intended for publication, including the repository's committed image assets. An unrelated pre-existing local wall-image edit is preserved outside this commit.

New tests cover all 30 power envelopes, full/edge/out-of-range damage, rank damage/cooldown progression, defensive placement across every map and both sides/queues, stale-map forward-placement rejection without spending, tower-upgrade range expansion, online slice-only immunity, bounded juice charging, empty guards and HP-trail animation. Existing tests exercise fourteen full PvP map/match simulations, mobile/desktop picking, build/upgrade/sell/capture/release/results, campaign waves/progression, local/online Co-op, Admin round trips, wallet authority and permanent reward history.

Additional authoritative Co-op simulations completed twenty waves with two players (524 kills, 49 slice-only units encountered) and four players (1,046 kills, 97 slice-only units encountered), including both boss waves and run-XP range growth. Simulated blade input is intentionally accurate; these are progression/engine checks, not evidence that the difficulty is balanced for real players.

The available browser cannot create a WebGL context. Physical iPhone heat, touch feel, rendered combat screenshots, live multi-account latency and long-session subjective balance still require device/network playtesting. This release does not claim every mode or line of code is flawless.
