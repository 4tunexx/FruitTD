# Turret controls and Creator editing

Tap an empty + pad to open the compatible turret choices. Tap a built turret or the center keep once to inspect its range, then again to open upgrades. Tap outside or slice to dismiss the selection. The hero is above the keep, with the tower and its guns below.

| Turret | Attack |
| --- | --- |
| Fire Blade | Spins while enemies are in range; cuts a nearby group, with fiery arcs. |
| Vortex Drain | Pulls enemies and loose juice in solo; slows targets online, with inward particles. |
| Lemon Laser | Aims a bright, piercing beam through enemies in a straight line. Uses yellow juice in solo. |
| Berry Cannon | Aims a heavy piercing shot that pushes enemies back. Uses pink juice in solo. |
| Frost Sprinkler | Fires frost at enemies, slows them and makes them brittle in solo; splashes and slows online. Uses orange juice in solo. |
| Spike Trap | Hits enemies in close range with a spike burst; can be opened/closed in solo. |

Online damage, range and cooldown remain server controlled through the existing match balance settings. Solo upgrades increase damage/range, change the mechanism and level markers, and use distinct level artwork when supplied.

## Admin → Creator Hub

- Select `tower-<kind>` for the base artwork/settings, or `tower-<kind>-level-<1…10>` for a specific level, including `tower-main`.
- Upload PNG/WebP/JPEG artwork. New images without clips automatically become a one-frame idle sprite. For an animated sheet, set its grid and clips after upload.
- Missing level artwork falls back to the base turret, then its built-in mechanism.
- Turret settings control solo damage, radius and cooldown multipliers, plus shot color and size. Online balance uses match settings.
- **Turret fires** and **Turret hits enemy** hooks select sound-bank slots and optional impact effects/shake. Empty level hooks inherit the base turret hook; absent fire hooks use the built-in turret sound.
- Upload WAV/MP3/OGG sounds up to 1 MB in Sound Bank. Sounds are stored through authenticated Admin media uploads. **Publish pack** shares artwork, level settings, hooks and sounds with players; saving a draft alone does not publish them.

Effects are cosmetic and bounded; online rendering cannot deal damage or spend currency. Server tests cover piercing/splash/cutter shapes, frost slow, cannon knockback, upgrades and refund limits. Presentation tests cover visible portrait picking, target-facing mechanisms, range dismissal, effect cleanup and published media normalization. A real mobile WebGL playthrough is still required for visual and performance acceptance.
