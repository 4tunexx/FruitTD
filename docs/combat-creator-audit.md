# Combat and Creator audit — 19 October 2026

## Defects repaired

- Gold `+` controls used normal depth testing and could disappear behind an opaque wall skin. Solo, Arena, Ranked and online Co-op now share a gold ring/plus with a charcoal backing, explicit render order and no depth occlusion. Occupied controls hide; selling restores them.
- Solo picking used static ground positions, even when the visible control projected elsewhere. Picking now checks the visible empty control first, ahead of overlapping cosmetic keep art.
- Map Creator saved `turret-slot` entities, but solo/local gameplay ignored them. Wall construction, picking, build compatibility, moving and HUD now use the authored slots, including additions/removals (up to 32). The main tower retains its stable slot index.
- Starting a run could outrun the map fetch; the callback discarded the published map once `state.running` became true. New runs now wait for the authored map before the first wave, with bounded fetch time, a preparation indicator and stale-navigation checks.
- A custom main-tower image could become the fallback hero image. Missing hero replacements now use the actual hero portrait.
- Chain-burst Creator art was routed to `enemy-normal`; it now has its own runtime key and Creator entry.
- Creator's wall thumbnail referenced an unrelated keep image. It now references the starter wall texture. Creator wall replacements apply to the starter skin consistently across solo and online modes; equipped alternate skins retain their own art.
- Online Co-op now passes the equipped wall skin to its battlefield snapshot.
- Online turret positions now refresh from their current map cell when the editor moves a pad.

## Creator changes

- Map Editor offers **Show live gameplay preview**, using the real `Field`, `WallBase`, `TurretRig`, skin system and a camera-framing function shared with live gameplay.
- Preview a build by selecting its gold `+`; repeat selection to preview an upgrade. These actions do not start a run, spend currency, award rewards, or send match commands.
- Creator offers **Show live combat model** for towers, heroes and enemies. Turret mechanisms, level appearance, animation and signature traces use the gameplay classes.
- Online workshop previews include the equipped defender, sample enemies, sample turrets, levels 1–10, and Arena/Ranked or shared-wall online Co-op view.
- The old image-map PvP draft was not the authoritative online map editor. Its controls now direct to the actual online workshop, rather than suggesting an unrelated save changes online maps.
- Solo/local tower anchors remain fixed at the bottom. Removed misleading relocation tools that normalization discarded.
- Editor sample backgrounds now resolve to the same runtime artwork; stale image loads cannot repaint a newly selected map.
- Preview refresh is debounced while dragging. New preview renderers stop animation when hidden, and expose cleanup for geometry, materials and listeners.

## Verification

- 576 tests across 12 suites passed; TypeScript/Vite/API production build passed.
- Added tests for skin-independent marker rendering, authored pads across Casual/Horde/Campaign/local Co-op, real camera projection and picking on phone/PC, build/sell visibility, pad limits/removal and correct Creator wall/chain-burst targets.
- Existing tests exercise all six turret signatures, damage shapes, fuel, delayed explosions, bounds and effect cleanup.
- Existing power tests iterate every hero ability in authoritative Arena and online Co-op, including costs, cooldowns, targets and turret-only bomb immunity.
- Existing Arena/Ranked UI tests exercise building, upgrading, selling, attacking, capture/release, surrender, completion and return to queue.
- Existing Co-op server tests exercise two authenticated clients, commands, waves and idempotent rewards. Existing campaign tests cover 100 levels, wave milestones, bosses, unlocks, completion/breach and twenty story checkpoints.

These are automated/geometry/server checks, not a certification of every GPU/device or every live multiplayer session. This environment did not run a visual GPU playthrough or authenticated Admin publish/upload session. Online Co-op retains its existing two-player shared-wall rules and fixed map; the solo/local image-map editor does not change that server map. The online preview exposes that distinction explicitly. The build retains the existing >500 kB chunk warning.
