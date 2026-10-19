# Environment verification — 19 October 2026

## Results

- `npm test`: 588 passed, zero failures/skips.
- `npm run build`: TypeScript, Vite and API bundling passed. Existing main chunk size warning remains (561.84 kB, gzip 181.14 kB).
- Arena/Ranked: 14 complete authoritative simulations across seven maps; 25,200 ticks and 1,372 validated commands. Completed snapshots remain immutable. Full opposing lanes no longer crash bot planning or spend resources.
- Online Co-op: ten simulated minutes, 23 cleared waves including bosses, 2,400 ticks and 3,284 commands. Terminal snapshots and reward bounds checked.
- Casual, Horde, Campaign and local Co-op: actual FruitField, WallBase, juice, wave planning, builds, damage and defeat/reset exercised by an automated blade agent. Sessions reached 6–9 waves before breach. These are behavioral checks, not a balance guarantee or a human playthrough.
- Admin HTTP: isolated storage exercises authorized config save/public reload/client merge/runtime balance, PNG and WAV upload/readback, five mode maps save/reload, stale revision rejection and unauthorized rejection. Production authorization defaults remain unchanged; tests do not write production data.
- Asset verification: all 406 original public image/SVG URLs returned correct HTTP types, but local decoding found seven corrupt WebPs. Removed those sample files and reused valid game artwork in Creator sample imports. Remaining 399 images/SVGs decode/parse; raster completeness is now regression-tested.
- Audio: all 205 source WAV containers decode; all 203 externally bundled WAV URLs returned successful HTTP responses (two small sounds are inlined).
- Production runtime query before changes: one Node `url.parse()` deprecation-warning group; no application crash in that result. Public config returned success without offline fallback.

## Fixes from this verification

1. Bot planning checks opponent capacity before selecting captured releases or packs.
2. Map Creator imports valid runtime terrain and cropped runtime atlas portraits instead of corrupted samples.
3. Published enemy balance now reaches enemy runtime rules. Fruit balance now persists on the server and reaches subsequent spawns instead of remaining device-local. Known numeric fields are bounded; deleting overrides restores defaults. Admin editors show current values. Online modes retain their dedicated authoritative balance settings.
4. Added isolated route factories and regression coverage for successful Admin operations, without introducing HTTP test-auth bypasses.

## Limits

GPU rendering and real pointer/touch playthroughs were not available in this environment. This does not verify frame rate, visual quality, audio playback/mixing, multiplayer latency, Steam packaging, or production Admin writes. It does not establish that every feature is complete or the game is bug-free. Existing two-player online Co-op is tested; four-player Co-op is not implemented by this change.
