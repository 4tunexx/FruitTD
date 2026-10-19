# Arsenal and combat controls

Tap an empty + pad to choose its turret. Tap a built turret or the keep to inspect its firing range, then again for upgrades. Clicking outside or slicing dismisses selection. The hero stands above the central keep.

| Weapon | Attack and counter | Solo level 1 range | Resource |
| --- | --- | ---: | --- |
| Rotor Saw | Spins while enemies enter its close defence ring; cuts all targets inside. | 1.6 | No fuel |
| Flamethrower | Aims a 60-degree flame cone; cannot hit enemies beside or behind its nozzle. | 3.8 | No fuel |
| Lemon Laser | Long piercing beam; rewards lining targets up. | 7.2 | 1 yellow juice |
| Rocket Launcher | Travels toward a tracked target, then explodes in a 1.4-unit blast. | 8.0 | 6 pink juice |
| Fertiliser Sprinkler | Rotating green mist slows and weakens enemies inside the ring. | 3.6 | 1 orange juice |
| Bomb Thrower | Lobs at a fixed landing zone with a 1.8-unit blast; moving runners can escape. | 6.0 | No fuel |

Upgrades increase damage and firing reach, reduce reload time and enlarge explosive blast radii. New art can be assigned to every level. Bombs replace the retired instant-kill spike trap. Rockets replace the old piercing cannon; the laser retains piercing. Only fertiliser slows targets: the flamethrower no longer applies an invisible passive slow.

Solo projectiles apply damage at impact. Online modes use the shared cone, blast, beam and radial target rules with server-owned match balance. They do not run local damage simulation. Circular online firing ranges now use the same Euclidean distance as the square map grid and selection ring.

## Admin compatibility

Existing save, audio and Creator IDs are retained: `guillotine` = saw, `vortex` = flames, `laser` = laser, `railgun` = rockets, `sprinkler` = fertiliser, `blender` = bombs. This preserves already-published uploads and equipped save data. The editor and sound-bank labels show weapon names.

Select `tower-<id>` or `tower-<id>-level-<1…10>` in Asset Workshop for PNG/WebP/JPEG/sprite artwork, damage/range/reload multipliers, effect color/size, attack/impact hooks and sound replacements. Missing level artwork inherits the base. Publish shares the pack; a draft is local. Online balance is edited in Arena / Ranked workshop. All weapon icons, including Rocket and Sprout, remain assignable in the icon library.

## PC and mobile

At 1100px wide and 600px tall, solo combat uses a bounded stage with a persistent command panel on the left and expanded ability controls on the right. The canvas rectangle, pointer projection and damage-number projection share the same screen bounds. Smaller screens retain the full viewport and collapsible build controls. Heroes uses balanced desktop panels and a single-column detail card with larger artwork. Hover changes the control border, not the artwork brightness or outline. The daily countdown is excluded from numeric tweening.

## Verification limits

Automated tests cover cone direction, blast timing and escape, fuel consumption, hit-once behavior, upgrades, range geometry, online combat counters, opening affordability, timer exclusions and PC camera bounds. A real GPU desktop/mobile playthrough is still needed to approve visual quality, sound mix and sustained frame rate. Deployment/build success is not Steam release certification.
