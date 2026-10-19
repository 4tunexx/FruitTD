# FruitTD battlefield art, version 1

Original illustrations generated with the built-in image generation tool and
encoded as WebP for the game. These are runtime assets, not interface mockups.
No artwork from another game is shipped.

- `portraits-v1.webp`: sixteen circular portraits, sampled with the UV coordinates
  in `src/game/characterPortraits.ts` (eight enemies, five heroes, two bosses, keep).
- `pineapple-v1.webp`: separate ninth enemy portrait.
- `orchard-outpost-v1.webp`: overhead charcoal causeway and ruined orchard edges.

Creator sheets and admin uploads take precedence. The old fruit skin atlas is
retained for sliced flesh and debris. Portraits face the camera, while movement,
damage and picking remain in world coordinates. Default routes stay in the clear center of the illustrated road; decorative
orchard borders do not add collision obstacles.
Custom map uploads retain their original dimensions and mapping.

The interface uses pale gold `#ffe394`, graphite `#202125` and amber `#f48120`.
Kingdom Rush's official Ironhide screenshots and Plants vs. Zombies 2 gameplay
screenshots were reviewed for visual hierarchy: readable characters, visible
resources, low-contrast ground and decoration concentrated outside action areas.

## Generation prompts

### Portrait atlas

Production 2D game character portrait atlas for FruitTD, apocalyptic zombie fruit
tower defense. One regular four-column, four-row atlas; sixteen equal cells, no
labels. One large centered round medallion per cell, charcoal background,
pale-gold rim, strong black ink contours, clean cel shading, amber rim light and
readable expressive faces at mobile sizes. Rows: orange, lemon, strawberry,
armored watermelon; banana, apple, kiwi, bomb; blue ninja Jiju, gold monk Topfu,
green pear ranger Lagen, magenta dragon-fruit duelist Tripos; violet/gold mystic
Ki, crowned watermelon boss, steel-jawed orange boss, graphite fortress with
amber reactor and twin barrels. Original coherent tactical zombie-fruit style.

### Battlefield

Actual top-down production battlefield texture, tall 1:2 composition. Ruined
orchard outpost with bold black ink contours, graphite and charcoal asphalt,
muted moss-green vegetation, amber lamps and pale-gold metal highlights.
Orthographic overhead view, no horizon, characters, towers, UI or text. Broad
open cracked causeway, subtle dashed amber center markings and faint lane
seams. Decorate the outer edges with dead orchard trees, rocks, harvest crates,
irrigation pipes, scrap fences, burnt grass and contaminated puddles. Keep the
road quiet and obstacle-free. Bottom eighteen percent: dark concrete deployment
apron with caution paint. No tan sand or bright green lawn.

### Pineapple

One centered circular game portrait medallion on graphite, pale-gold outline.
Fierce mutant pineapple zombie with jagged green leaf mohawk, cracked golden
diamond rind, glowing orange eyes, crooked teeth, scrap collar and riveted jaw
patch. Bold ink contours, clean cel shading, amber rim light and an expressive
face readable at 48 pixels. No text or surrounding objects; match the atlas.
