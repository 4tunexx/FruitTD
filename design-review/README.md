# Orchard outpost redesign

The requested direction is yellow/orange industrial game UI on dark grey: charcoal panels, thick ink edges, warm metal buttons, clear blue/red combat teams, and an original illustrated menu stage. Mobile puts the character and Battle button first; desktop keeps a loadout sidebar and gives Arena a side command panel.

## Implemented behaviour

- Arena fills the viewport. Mobile Build focuses the blue defence; Attack shows both lanes. Whole-arena framing includes both bases on all seven maps.
- PvP no longer injects automatic neutral waves. Squads arrive through an opponent's validated send or release command. Income, tower upgrades, armoured counters, capture, Rally and ranked settlement remain authoritative.
- The initial tower tray exposes rapid fire, splash and pierce. Advanced towers remain accessible.
- Successful actions show feedback. Base hits emit particles; a destroyed base emits a larger burst. Match results stay over the battlefield until acknowledged.
- Campaign boss kills play the existing effects with extra bursts and shake, followed by a Continue dialog. A breached/live boss cannot trigger completion.
- Slicer preview canvases are bounded and animate on desktop. Mode history includes recent score diagrams and swipe accuracy. Category boards include ranked, game modes, friends and currencies.
- Arrow keys and standard gamepad controls move menu focus; gamepad A activates and B goes back or opens Arena's leave confirmation. This does not add gamepad aiming to slicing combat.

## Artwork

`src/assets/orchard-siege-menu.png` was generated with the built-in ImageGen tool and copied into the project. Original image: 1536 × 1024.

Final prompt brief: Create original premium comic/cel-shaded key art for a fruit-apocalypse tower-defence game. A masked orange fruit defender with improvised armour and a glowing cyan blade stands beside an orange defensive turret on the right. Corrupted fruit charge through a ruined orchard and scrapyard beneath an orange sunset. Use thick dark ink contours, dramatic yellow/orange light, charcoal shadows and rich game-art detail. Keep the left side dark and uncluttered for menu text. Landscape composition; no text, UI, logos or watermarks.

## Review

The screenshots in this directory show the production components at desktop and 390 × 844 phone sizes. `preview-outpost.html` is a development-only local harness with a simulated practice opponent and sample wallet. `design-review/social-preview.html` shows the production Community screen with local-only sample data so its panels can be reviewed without signing into an account. `design-review/admin-preview.html` keeps admin saves in preview memory. These previews do not connect simulated content to real players or grant real rewards.

Production build and 416 regression tests are checked. Browser review covers menu layout, blue-tile building, send feedback, mobile defence/attack switching, leave confirmation and result acknowledgement. Physical gamepad hardware, deployed Ably connectivity and full networked multiplayer still require verification in the deployed environment. The files are local changes; no deployment was performed.
