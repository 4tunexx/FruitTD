# In-game follow-up verification — 20 October 2026

## Verified failures and fixes

### Saved maps placed artillery too far from the tower

Read-only inspection of the FruitTD Atlas cluster found five published sample maps. The four solo/local maps still contain the original revision-one pad signature: wall pads at normalized Y=0.5 and ground pads at Y=0.47954545454545455 on a 66-unit field. The main tower is much farther downfield. Updating new-map defaults did not repair those saved documents.

Map normalization now recognizes the complete eight-pad signature, sample ID, depth and revision and moves those controls to the current wall-side positions. All four solo/local modes share the same normalization path with Map Creator. A changed pad, different revision or custom map ID prevents this migration; normalization is idempotent. Production map documents were not overwritten.

### Online Co-op only admitted two players

Rooms now support up to four distinct accounts. The host can start a two- or three-player party; a four-player party starts a three-second countdown automatically. Lobby controls show the roster, room capacity and host-only Start action. Guests can leave a waiting room without closing it or retaining an active-room reservation.

Wave population and boss health scale with party size. All three remote teammates have independent bounded blade trails. Local keyboard-and-mouse Co-op remains a separate two-person mode.

Server tests exercise four joins, capacity enforcement, host authorization, command replay rejection, guest departure/rejoin, shared purchases and existing idempotent reward settlement. Full-session simulations exercise both two- and four-player parties through wave and boss cycles.

### Co-op HP bars did not know scaled maximum HP

The authoritative server now includes each fruit's maximum HP when spawning. Wave-scaled enemies and bosses retain that maximum after taking damage. Existing persisted snapshots missing the field recover it on simulation. The existing battlefield consumes this value for its health fraction.

### Graphics failures left a dead title or an unfair running match

The production cloud-browser check reproduced a startup failure: this environment has WebGL disabled, and the game dismissed its boot loader before renderer initialization failed. The title artwork remained without usable controls.

Startup now dismisses the loader only after the engine signals successful initialization. Failure retains a readable explanation and Reload action, including a specific WebGL message when appropriate. Later ordinary errors do not reopen the startup overlay.

During solo/local play, graphics-context loss pauses the match and disables Resume/Restart until restoration. Restoration does not automatically resume combat. Online matches cannot be paused by one client: their battlefield reports that the live match continues, keeps its connection active and resumes rendering when graphics return.

## Production content inspection

Read-only MongoDB queries confirmed:

- 100 campaign bosses, with 100 distinct names.
- 20 story chapters, numbered consecutively 1–20.
- 50 main missions and 5 daily missions.
- 51 achievements and 21 badges, including the existing additional Co-op content.
- No authored wave-level overrides or published Creator asset entries in the inspected configuration. Runtime-generated campaign waves and shipped fallback art therefore remain relevant.

The authorized Admin save/reload integration test passes with an isolated collection. No live player saves, balances, rooms or published configuration were changed as part of these checks.

## Validation

- 601 tests pass across 12 suites.
- Full Arena/Ranked simulations cover both queues on all seven maps.
- Real FruitField/WallBase simulations cover Casual, Horde, Campaign and local Co-op.
- Two- and four-player online Co-op simulations cover commands, wave progression, boss phases, settlement bounds and clean termination.
- Focused tests cover the host lobby UI, saved-map migration, HP retention, simultaneous teammate trails, graphics-loss lifecycle and actual inline startup recovery script.
- TypeScript, Vite and the bundled Vercel API production build pass.

## Remaining limits

The cloud browser cannot create a WebGL context, so it cannot certify actual combat rendering, physical-phone heat, sustained GPU frame rate, touch accuracy or multi-device online latency. Automated simulations and DOM tests are not substitutes for those checks. Custom Creator turrets still target solo/local build menus; Arena, Ranked and online Co-op retain separate authoritative turret balance. Live authenticated Admin uploads/publishing were not performed.
