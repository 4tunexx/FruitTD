# PvP motion review

Found two visible-motion problems: extrapolation stopped after 500 ms although fallback polling runs every 900 ms, and re-rendering the same snapshot restarted its prediction clock. Each arriving snapshot also replaced predicted positions immediately.

Added per-unit visual motion reconciliation. Duplicate revisions keep their original clock; prediction spans 1.2 seconds to cover polling and jitter, then stops during connection loss. Snapshot corrections decay over 160 ms rather than teleporting units. Combat stops and knockbacks still follow authoritative positions. This does not alter server damage, placement, movement or rewards.

The shared Co-op renderer uses the same smoothing and now receives the configured normal/boss speed multipliers instead of hardcoded defaults. Animated main towers and shared turret rigs no longer mark unchanged texture bindings for material updates every frame; turret rigs are used by solo and online modes.

Verification:
- Full suite: 641 passing tests, zero failures/skips, including new polling, duplicate-revision, disconnect, combat-stop and knockback regressions.
- TypeScript, Vite and API bundle build passed.
- Chromium at 390×844: actual PvP renderer with production simulation and bot command logic, driven at 900 ms snapshot intervals. In a 5.5-second sample, 217 frames were observed, with 60 moving frames in the 600–850 ms portion that previously froze. Five polls completed and the bot built a tower. No page JavaScript errors.
- Browser run uses a local fixture; it is not a measurement of production network latency or a physical-phone frame rate. Longer live bot matches, separate-account multiplayer, complete campaign playthroughs and real-device performance still need verification.
