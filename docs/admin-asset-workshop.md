# Admin asset workflow

## Menu and mode icons

Open **Icons**, choose the role (for example **Mode: Casual**), then choose an icon and apply it. The large **Live in game** preview shows the actual saved assignment; the dashed preview is the pending replacement. Changing roles clears the pending choice.

Mode-specific assignments take priority over inherited shared roles. Casual inherits Shield when it has no explicit assignment. Restoring a mode's default removes only that mode's override and reveals the inherited icon again. Existing assignments are preserved.

## Heroes, enemies, towers and powers

**Creator → FruitTD Asset Workshop** lists current game assets with thumbnails and categories, including all heroes, 30 hero ability icons, bosses and tower upgrade levels. Built-in art appears without uploading a custom pack. The separate live preview shows published artwork; the editor can contain an unpublished draft.

- Search or select a category and choose an asset.
- Replace its image, or define an animation grid and clips for a sheet. Single image uploads get an idle frame automatically.
- Inspect the live artwork beside the draft. Export Frame can export the built-in artwork too.
- Save Draft while editing. Publish Asset Pack shares the artwork, clips, attack/impact effects, turret tuning and sounds with players.
- Load Published Pack replaces the local editor draft with the shared version.

The older quick upload cards now display the built-in game image by default. Uploading through these cards publishes the image immediately through Admin media storage and configuration. Restore Built-in Artwork publishes a reset marker so an old browser upload cannot reappear. A quick upload changes that asset without replacing unrelated assets or sound settings.

## Verification

Regression tests cover inherited Casual icons, role switching, built-in hero/turret artwork, published artwork precedence, reset persistence, draft merging and the upload → shared config → preview flow. The production config endpoint was reachable and online during implementation. Signed-in browser editing and visual verification still require a browser session; tests use a DOM harness and mocked upload/config responses.
