# Combat presentation

## Implemented

- Casual, campaign, horde, and local co-op use a 44-unit field. PvP retains 132 units.
- Older published maps are normalized into the selected mode depth; north gates and the physical tower/leak anchors remain aligned.
- Replaced undecodable sample backgrounds with original SVG terrain. Old sample background URLs migrate during normalization. Custom uploaded assets remain supported.
- Camera starts reset for each match; the full wall and HP rail sit within the bottom viewport edge.
- Original FruitTD tower and turret visuals are preserved, including Creator textures.
- Upgraded towers begin with full maximum HP; the rail fills its full track width.
- Compact angular combat controls and a slim gold juice rail sit beneath the profile.
- Live gameplay labels do not enter the general number count animation. Persistent number animations retain their active entry when the same target is written again.
- Power cooldowns and their charge sweep are driven by the same absolute deadline.
- Artillery hits display exact damage numbers using a bounded reusable display pool.
- Waves continue automatically. The between-wave module draft has been removed; original build and turret upgrades remain.


## Verification

- Browser checks: 320x640 and 390x844 portrait, 844x390 landscape; original tower, full starting HP, build menu, power activation/cooldown, and automatic wave continuation.
- PvP stays 132 units; other shared modes use 44 units.
- Browser checks use the local combat preview. Physical-device touch gestures and authenticated online PvP were not exercised.

- Final production build passes; all 492 automated tests pass.
