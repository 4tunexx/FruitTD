# PvP continuous movement and Casual controls

The rebuilt (rules v2) arena uses continuous world coordinates. Zombies keep their lateral position on open ground, steer around solid scenery and placed turrets, and seek opposing zombies within 3.5 world units with a clear approach. Navigation uses an independent square mesh only for obstacle detours, with visible waypoint skipping. Hexes determine turret placement only. Layout routes are cached until solids or turret positions change.

Combat and movement resolve from shared position snapshots in steps of at most 50 ms. Opposing swarms stop in melee range, exchange simultaneous damage, and survivors resume advancing. Turrets and the main tower retain their authoritative firing rules. Existing match income and kill bounties remain match Fruts. New turrets cannot appear inside a live zombie or close either team's route.

The default opening remains 20 seconds of catching. Each caught zombie releases once for free. The capture deadline rejects late commands, and the full configured siege duration starts after capture. Free releases now sit directly on the action rail beside purchased attacks; secondary powers remain in the controls popup.

The arena keeps the shared Casual battlefield texture, with a full viewport playfield, floating glass HUD, round commands, and collapsible loadout sheets across desktop and mobile. Grid lines are limited to build cells at 3.5% opacity; own placement rings use 7%, rival rings 2.5%. Selection and range indicators remain visible on interaction.

Validation:
- 38 focused tests pass across rules, UI interactions and battlefield picking. These include arbitrary lateral positions, off-axis engagement, simultaneous damage, long server ticks, capture-to-release UI, all seven obstacle routes and modern hex picking at 390×844 and 1440×900 from both sides.
- TypeScript, Vite and API bundle builds pass.
- Full suite before the final two UI/picking regressions: 668/670 pass. The two Co-op team-vote failures reproduce on unchanged commit 7cb8228 in an isolated checkout.
- Browser visual QA remains unverified: no Chromium is installed and Playwright's browser download failed. No live two-account multiplayer or physical-device claim is made.
