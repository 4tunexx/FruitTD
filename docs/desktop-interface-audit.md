# Desktop interface audit — 19 October 2026

## Implemented in this pass

The Arena screenshot showed a 760px matchmaking card centred inside a much wider PC panel. The shared shell was responsive, but several embedded pages still had their own mobile constraints. The desktop rules now lay out the actual page content, rather than only widening its outer frame.

| Surface | Change / evidence |
| --- | --- |
| Arena and Ranked | Full-width launch panel, visible Normal/Ranked queue controls, three battle-plan columns, separate challenge/rules areas, selected defender and useful links in Panel 2. Matchmaking remains server-owned. |
| Community | Restore two desktop columns for friends and player profile. |
| Messages | Friend list beside conversation; larger thread area. |
| Notifications | Daily reward handler is wired to the real daily modal; Co-op invitations reach the room join handler. Social module failures now offer recovery. |
| Settings | Three desktop cards; controls sit at the bottom of each card. Two columns on narrower desktops. |
| News | Full-width briefing and three action cards. |
| Co-op | Full-width action grid; lobby import errors show recovery. Battlefield startup failures show Retry/Reload and Leave instead of an endless loading indicator. |
| Missions, Achievements, Badges | Responsive desktop card grids with shared spacing and charcoal/gold surfaces. Existing claim handlers remain in place. |
| Profile | Restore mode filter visibility; compact action rows and mastery blocks. |
| Shop and Inventory | Columns follow available panel width with a 240px minimum card size. |
| Heroes | Preserve the balanced roster/detail layout and artwork implemented previously. |
| Campaign | Remove embedded page width constraints; preserve five-stage map and boss detail placement. |
| Leaderboard | Preserve full-width desktop table layout from the preceding fix. |
| All 18 hub destinations | Shared scroll/padding rules; both panels render in a DOM smoke test for a fresh account. Mobile stacking remains outside the desktop media queries. |

## Functional checks

- 571 tests, 12 suites, all passed. Production TypeScript/Vite/API build passed.
- New test invokes the actual Notifications adapter, renders a daily notification, clicks its reward action, and verifies the daily callback fires.
- New test renders Arena and Ranked contextual panels with real selected-hero art, then clicks each contextual destination and checks the resulting navigation state.
- New smoke test executes all 18 hub adapters, waits for lazy content, checks both panels and rejects blank content, error panels, or leftover loaders.
- Existing Arena/Ranked integration tests exercise build, upgrade, sell, send attackers, main-tower upgrade, Rally, capture/release, surrender, completion and return to queue.
- Existing routing tests cover shared-host visibility, hidden legacy controls, Back/Home, desktop chrome and page switching.
- Static destination scan: 24 navigation states, 68 literal navigation references, zero unknown targets. This is a source check, not proof every possible user interaction succeeds.
- Main JS: 557.95 kB / 179.97 kB gzip. Vite still reports its existing >500 kB chunk warning.

## Verification limits

This pass used code inspection, DOM tests, gameplay/server tests and production build checks. It did not perform GPU browser gameplay, live two-account online matches, or authenticated Admin upload/save actions. Title/auth, pause/results, Admin and Creator retain their prior implementations and existing test coverage; they were not newly certified visually in this pass. The smoke test uses a fresh account; it does not claim every populated account, map, asset override or network failure is bug-free.
