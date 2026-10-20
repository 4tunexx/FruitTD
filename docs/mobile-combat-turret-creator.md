# Mobile combat and Turret Creator — 20 October 2026

This change addresses the reported phone workload, missing health rails, juice feedback, damage text, status controls, turret placement and Creator authoring.

## Changes

- Main combat renders at 30 Hz on coarse-pointer devices and at most 60 Hz on desktop. The fixed 60 Hz combat simulation is retained. Hidden pages skip both simulation and drawing. The online battlefield also caps mobile drawing, disables mobile antialiasing, requests low-power graphics and limits pixel ratio to 1.
- Creator runtime data is cached until publication or explicit draft/storage invalidation. Combat no longer reads the entire saved Creator pack every 200 ms.
- Ordinary enemy HP is visible from spawn. Bosses retain their single dedicated HUD meter. Arena and shared online Co-op now both create visible enemy HP rails.
- Turret damage popups round the displayed remaining HP, eliminating floating-point tails. Combat retains fractional damage internally.
- Super and hero-power kills do not refill either the super meter or colored turret-fuel banks. This exclusion follows chain reactions caused by those kills. Normal blade and turret kills continue charging normally.
- Bladebound enemies have a pink shield and accept direct blade damage only. Turrets skip them as primary targets. Turret damage, environmental damage, chain splash and hero powers cannot kill them. Generated waves introduce them from wave 7; every fifth generated campaign boss uses this archetype. Authored waves can select it explicitly in Creator.
- The three combat status panels can collapse together. Juice updates without a width transition. Build is anchored to the viewport edge above the health rail.
- Default wall-side pads move 0.35 world units toward the tower's rear, and ground pads move 0.5 units closer to the wall. Authored maps retain their exact saved geometry.
- Special-enemy instructions show once per enemy kind per run, while bosses still announce their rule. Wave announcements show enemy count and HP scaling; repeated tips are suppressed.

## Turret Creator

Open Admin → Creator / Media Studio → **Turret Creator**. Existing turret base assets and their level assets remain in the asset list.

1. Enter a new name, choose the new turret chassis and press **Create turret**.
2. Set base damage, damage per level, base range, range per level, reload time and build cost. A turret inherits one of six real attack mechanics: piercing laser, guided rocket, arcing bomb, flame cone, radial mist or rotor blades.
3. Adjust shot color/size and enemy death effect/strength. Attack and Impact event hooks remain available for additional sound and effects.
4. Open the live gameplay model. A target takes damage, dies, plays the selected death effect and respawns. The level slider previews levels 1–10, with damage, reload, range and target HP shown numerically.
5. Upload base art if desired. Missing level artwork uses the base art; levels and stats grow automatically. Specific level assets can override artwork and tuning multipliers.
6. **Publish asset pack** to persist through the existing authorized Admin configuration API. Published custom turrets appear in solo/local build menus after reload.

Arena, Ranked and online Co-op keep their separate authoritative match balance and three-level turret upgrade rules. This change does not inject custom Creator turrets or blade-only enemies into those server modes; Arena and Ranked do not permit blade slicing. Their rendering and health-rail fixes do apply.

## Existing difficulty progression

Campaign already increases wave HP, enemy count/spawn pressure, available enemy archetypes and waves per stage. Bosses enrage at half HP; brood bosses release runners. Explosive/boss leak damage scales by wave, capped at +75%. Individual enemy rule multipliers remain editable through Admin. This is not a system that upgrades every individual enemy ability at every campaign level.

## Verification and limits

- 592 automated tests pass across 12 suites. Coverage includes all four solo/local modes, campaign progression, Arena/Ranked commands and online Co-op server sessions.
- New regressions exercise Bladebound ordinary enemies/bosses, turret target exclusion, custom turret normalization/building/level growth/attack shape, and mobile draw-rate/background behavior.
- The authorized Admin API save/reload integration test now preserves custom chassis, base stats, growth and death effects, using an isolated in-memory collection rather than production MongoDB.
- TypeScript, Vite production build and bundled Vercel API build pass.
- No browser GPU screenshots or physical-phone temperature measurements were obtained. Chromium installation failed because the download returned an invalid archive. Production MongoDB credentials are absent locally, so live authenticated editing and persistence were not certified.
- Saved authored map geometry is not repositioned by the default-pad change. If a published custom map has widely spaced pads, adjust those pads in Map Creator.
