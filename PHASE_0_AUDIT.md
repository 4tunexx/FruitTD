# FruitTD — Phase 0 audit and baseline

Date: 2026-09-23  
Source: `https://github.com/4tunexx/FruitTD`, `main` at `28bcf93ad8b7abacf4f1e187133376274d15d189`  
Workspace: `/app/FruitTD`

## Scope and verdict

This is an audit of the existing game, **not a rewrite or an implementation phase**. No existing tracked game source, manifests, lockfiles, assets, configuration, or tests were modified. This report is the only addition inside the FruitTD checkout. Diagnostic scripts, logs, screenshots, and working notes live outside that checkout.

**241 existing tests pass; the complete build passes. The requested end-to-end journey is NOT yet verified, and the economy is NOT server-authoritative.** Specific failures were reproduced despite the green unit suite.

The supplied description understates parts of current `main`: a central reward pipeline, splitter children, separate Shop/Inventory, equip/sell code, a newer game menu, screen routing, and server-side admin checks already exist. Preserve and repair these implementations rather than rebuilding them.

The user selected “I’ll provide the complete 28 rules now,” but the actual rules have not been supplied. The matrix below assesses only the explicitly supplied requirements. **28-rule compliance remains unassessed; these rows are not a reconstructed masterplan.**

## Reproducible baseline and qualifications

| Check | Observed result | Evidence / qualification |
|---|---|---|
| Source version | Exact `main` commit pinned above | `git rev-parse HEAD`; original tracked diff empty |
| Runtime | Original Vite frontend + Express backend start successfully | Supervisor: `fruittd_frontend`, `fruittd_backend` |
| Mongo connectivity | External `GET /api/health`: HTTP 200, `status:ok`, `mongo:true` | Local Mongo only; no production/Atlas data accessed |
| Preview | External frontend HTTP 200; title and mobile main-menu screenshots render | URL obtained from `/app/frontend/.env` |
| Existing tests | **241 passed, 0 failed, 0 skipped**; 220 top-level tests, 6 suites | `/app/test_reports/fruittd-phase0/unit-tests.log` |
| Typecheck + frontend + API build | **Passed** using the existing complete `build` script | `/app/test_reports/fruittd-phase0/build.log` |
| Main frontend bundle | 917.70 kB minified / 248.71 kB gzip | Vite warns about chunks above 500 kB; not a build failure |
| API characterization | 6 tests passed, recording current behavior including defects | `/app/tests/test_fruittd_phase0_api.py`; `/app/test_reports/pytest/pytest_results.xml` |
| Splitter diagnostic | 2 characterization tests passed, reproducing wrong behavior | `/app/tests/fruittd_phase0_splitter_lifecycle_diagnostic.test.ts`; `/app/test_reports/iteration_2.json` |
| Full desktop/mobile core journey | **Incomplete / not signed off** | Browser run timed out; partial report preserved at `/app/test_reports/iteration_1.json` |

### Dependency/environment qualification

Installed with `yarn install --ignore-scripts --no-lockfile --non-interactive`; executed the existing `test` and `build` scripts through Yarn. No package manifest or lockfile was rewritten. The environment is Node **20.20.2** on Linux ARM64, whereas repository CI specifies Node **22** and `npm ci`. This verifies the source with the installed compatible dependency tree, **not a byte-for-byte reproduction of the locked CI environment**.

A comparison of 139 installed package paths against the repository's npm lock found 12 version/path mismatches, including esbuild 0.25.9→0.25.12, rollup 4.63.2→4.63.4, tsx 4.23.13→4.23.15, @types/node 22.20.2→22.20.4, @webgpu/types 0.1.72→0.1.74, bson 7.3.2→7.3.3, enhanced-resolve 5.25.0→5.25.1, proxy-addr 2.0.7→2.0.8, native esbuild/rollup variants, and a content-type hoisting/version difference. Exact locked Node 22 reproduction remains a baseline follow-up, not a claimed pass.

Build ran in a clean archive at `/root/fruittd-build-baseline` with the installed dependencies linked in. This prevents the API bundling step from changing the checkout's tracked `api/[...path].js`.

Audit-only runtime adapter: `/root/fruittd-runtime/start.cjs`, with ports and paths from `runtime.env`. It maps the existing protected `MONGO_URL` to the game's required `MONGODB_URI`, and derives APP_URL/CORS from the existing external preview URL. Original protected `.env` values are untouched. Vite's additional allowed host is supplied through an environment variable for the preview tunnel, not a source edit. Express listens on the environment's API port; external `/api` requests reach it directly rather than the original Vite localhost proxy.

`server/db.ts:103` hardcodes database name `FruitTD`; `.env.example`'s `MONGODB_DB` is not used. That local database had no collections before this audit. Disposable audit accounts were used; no production mutations occurred. Original starter-template services were stopped, not converted into the game.

## Existing layer map

| Layer | Existing implementation | Boundary assessment |
|---|---|---|
| Render/timing | `src/engine/renderer.ts`, `loop.ts` | Three.js renderer, orthographic camera, effect composer, frame loop; keep intact |
| Combat/input/world | `src/input/blade.ts`; `src/game/fruits.ts`, `slicer.ts`, `waves.ts`, `wall.ts`, `turrets.ts`, `state.ts`, `world.ts` | Existing domain modules and object pools; lifecycle defect described below |
| Reward/progression | `src/game/progression/{rewards,index,modifiers,combo,heroMilestones,heroStatus,heroEconomy}.ts`; tower progression/milestones | Pure reward calculation and an apply step exist; execution remains browser-side |
| Persistence | `src/game/save.ts`, `towerProgression.ts`, legacy perk migration | Main save and tower store are separate; client revision/time merge for balances, max/union for progression/ownership |
| Client services | `src/services/{api,auth,progress,missions,achievements,badges,liveConfig,steam,admin}.ts` | API requests, auth state, event-to-progress translation; client still computes reported progress |
| UI/navigation | `src/ui/hud.ts`, `src/ui/screens/*`, `src/game/navigation.ts`, `index.html` | Modern screen host coexists with hidden legacy lobby/controls; do not automate the wrong host |
| Theme/layout | `src/ui/theme/*`, `src/ui/components/*`, `src/ui/design/*`, screen CSS | Typed theme, CSS variables, DOM primitives and preview/editor already exist; keep current glass/lime direction |
| Backend | `server/app.ts`, `auth.ts`, `db.ts`, `routes/*`, `catalog.ts` | Express routers, Mongo sessions, catalogue and admin authorization; no authoritative match/economy service |
| Production entry/build | `scripts/bundle-api.mjs`, `api/[...path].js`, `vercel.json` | Existing API adapter/build retained; no deployment readiness claim or production changes |

Important coupling: `src/main.ts` still coordinates rendering, rewards, persistence and UI (1,470 lines); `hud.ts` has 2,059 lines. The theme documentation describes the intended separation, not complete isolation. Incremental boundaries are preferable to a wholesale rewrite.

## Exists versus broken / unverified

| Supplied requirement | What exists | Gap / evidence |
|---|---|---|
| Email-confirmed login | Register/login/verify/profile/logout endpoints; scrypt password hashes and hashed Mongo sessions | API fallback flow works, but registration is unreachable through title UI; real email delivery not verified |
| Steam secondary/link | OpenID/Steam routes and session-derived identity | No real Steam login, profile linking, or privileged admin session exercised |
| Hero L1–100 / tower L1–10 | Data, milestone math, XP application, unlock and purchase-only hero rules | Existing tests pass; live hero combat level refresh and mastery ownership need attention |
| Gameplay XP/coins | `award()`→`calculateReward()`→`applyRewards()`→`persist()`; kills, bosses, bomb parry, reslice, combo, waves and game-over paths | Not absent; splitter lifecycle corrupts kill metadata; all rewards remain client-computed |
| Special enemies/splitters | Definitions, volatile-once flag, swift dodge, armor, two split children, bounded fruit pool | Parent pool reuse confirmed; split-child wave accounting is wrong; boss phases not complete |
| Combo rewards | Multi-segment slicing and milestone crossings wired to reward pipeline | Current reward text can diverge from actual bundle; actual touch/combo journey unverified |
| Fruit atlas | 8×4 atlas, coordinate checks/cache, fixed-coordinate tests | Bounds checks do not establish semantic art correctness; bomb tiles show fruit, not a bomb |
| Reload persistence | Local save/migration and authenticated cloud read/write; client merge logic | Cloud accepts stale/forged snapshots; full gameplay→reload proof incomplete |
| Server-authoritative economy | Session-bound user selection and some caps | Client balance, ownership, XP and score accepted; no trusted match simulation/event admission or economy ledger |
| Shop/Inventory | Separate screens/catalogue, owned filtering, local purchase/equip/sell guards and previews | No backend purchase/equip/sell authority; full purchase→reload browser flow unverified; newer inventory lacks unequip callback wiring |
| Missions/achievements/daily | Endpoints, configured requirements and client event reporting | Client-generated deltas; claim endpoints don't atomically credit server wallet; concurrent reward-once guarantee absent |
| Game menu/theme | New `renderMainMenu`, screen registry and current futuristic theme already in main | Do not redo menu blindly; title registration dead end and legacy/new host ambiguity need targeted fixes |
| Back/Home/mobile | Screen routing/guards, back/home infrastructure, touch action handling, mobile layout/DPR caps | Only partial mobile screenshots; true touch slicing, safe-area/device matrix and complete route reachability not signed off |
| Admin | Session Steam-ID allowlist checks; config, daily reset, leaderboard moderation | Anonymous mutation rejection verified; real privileged session, user economy/progression tools, bans/audit trail/permission matrix unverified or absent from inspected routes |
| Performance/assets | 64-fruit pool, pooled floating scores, conditional bloom, DPR limits | Reward-time save/network/UI churn; full memory/listener soak and asset licensing audit not completed |
| Co-op/ranked | UI and leaderboard foundations | Real-time shared tower/matchmaking remain deliberately deferred; no claim of working multiplayer |

## Confirmed and source-traced defects

### P0 — AUTH-01: new email users cannot reach registration

`src/ui/hud.ts:410–412`: both Start Game and Load Save open `openAuthModal('login')`. Registration handling exists at `1888–1891`, but no reachable mode-switch action calls it. The browser observed a login-only modal. **Impact:** a new email user cannot begin the requested journey, despite the register API passing.

Related trust issue (`server/auth.ts:107–143`): verification codes are logged unconditionally; missing/failed mail delivery returns `previewCode` to the caller without a production-only guard. The API test used this existing development fallback, **not proof of mailbox ownership or real delivery**. Protected progression routes resolve a session without consistently requiring verified email/profile completion. Preserve the working auth foundation, then close these gates deliberately.

### P0 — COMBAT-01: splitter parent object recycled before reward consumption

**Reproduced with the actual `FruitField` module.**

1. Spawn `watermelon`, enemy kind `splitter`.
2. Fatal `hurt()` calls `kill()` (`fruits.ts:253–272`).
3. `kill()` marks the parent inactive, then calls `spawnSplitChildren()`.
4. `spawn()` finds the first inactive pool object (`203`), which can be that same parent.
5. The caller still holds the original reference, now an alive `strawberry`, `normal`, `splitChild:true`.
6. `main.ts:895` calls `killFruit(fruit)` and reward classification at `542–548` sees child metadata, not the killed parent.

**Impact:** parent score/XP multiplier, labels, debris and event identity can be wrong. Fix the lifecycle boundary: retain immutable kill context and/or defer object reuse until reward/event consumption is complete. A narrow lifecycle fix is sufficient; no engine/module replacement justified.

### P0 — ECON-01: cloud snapshot and score are still client truth

**Reproduced on disposable local accounts:**

- `/api/profile/sync` accepted client coins/gems/XP and a nonexistent `sentinel-test-skin` ownership entry.
- Revision 5 was overwritten by revision 1 with older `savedAt` and higher balances.
- A coin value above 1,000,000 was rejected: the cap works, but it is not proof of legitimate earnings.
- `/api/leaderboard` accepted score 54,321 / wave 19 without any played match proof.

Root: `server/routes/profile.ts:49–84` applies a few upper bounds and then stores the supplied `saveData` verbatim. `leaderboard.ts` checks session and reasonableness, not a server-owned run. A signed session alone does not make client-reported combat true. Phase 2 needs server-owned run state, event admission/ordering, trusted reward computation and atomic transactions/idempotency—not just a new endpoint accepting client “kill” events.

### P1 — COMBAT-02: split-child kills contaminate perfect-wave accounting

`main.ts:566` increments `waveKilled` for every kill. `splitChild` comments promise exclusion, but that flag is not checked there. `isPerfectWave()` uses `waveKilled >= waveTotal`. The diagnostic demonstrates that child counts can satisfy that threshold while not all original wave members were killed. This is a **source-backed accounting demonstration**, not a full browser wave replay. Count spawned wave members and leaks explicitly. Also inspect splitter leakage: `fruits.ts:321` calls `kill()` before `onLeak`, allowing the same metadata mutation on leak processing.

### P1 — REWARD-01: claim acknowledgement and wallet credit are separate

**Reproduced:** first daily claim succeeds, second sequential claim returns HTTP 400, but cloud `saveData` is unchanged before/after the first claim. The client credits coins/SP/gems in `hud.ts:1848–1859` and later syncs. A close/crash between claim and sync can lose the reward. Daily/mission/achievement claim implementations use read-then-write logic rather than an atomic reward ledger and conditional wallet update; concurrency guarantees remain unproven. Sequential duplicate rejection is not concurrent reward-once safety.

### PROG-01 — corrected finding: hero level is already derived from XP

Follow-up during combat work found `createState()` returns a Proxy (`state.ts:78–82`) whose `heroLevel` getter derives the value from `heroXp`. The earlier assignment-only trace was incomplete. **No stale-level bug is established and no redundant level writer should be added.** Keep the existing derivation; verify it in progression regressions. This correction supersedes mentions of live-level lag elsewhere in the initial matrix/next-work list.

### P1 — SAVE/PERF-01: each award saves, sends and remounts UI

`award():484` calls `persist()`. `persist():263–267` writes local storage, launches an unawaited cloud sync, and mounts Shop/Skills for each reward, even during combat. Multiple rewards per frame create unnecessary writes/remounts and unordered cloud requests. The server has no revision precondition, so late older writes may win. Pure calculation/apply modules already exist; batch presentation/local save and serialize authoritative sync at the correct boundary.

### P1 — CONTENT-01: atlas bounds are not semantic validation

The original 1024×1024 image is partitioned into 128×256 cells and stretched to square tile textures. Direct artwork inspection confirms the bomb pair `[6,2]/[7,2]` depicts a dark fruit rind and yellow seeded flesh, **not a bomb**. Do not rename it “kiwi”: automated image analysis misidentified this content, so its proposed remaps were not accepted. Strawberry `[6,1]` is red exterior; the white seeded dragon-fruit interior is `[7,1]`, contrary to that tool's first suggestion. Other listed pairs look broadly consistent but require crop-based in-game validation; do not blindly rewrite mappings based on coordinate tests or model guesses.

### P2 — smaller source-traced gaps

- `main.ts:1236,1252` increments `state.wave` before emitting `wave_clear`, so the reported cleared wave is the next number; compare mission semantics before correcting.
- Bomb parry text is fixed `+55` (`851`) although base bomb score is 24; combo text uses `tier.combo * 10` (`943`) rather than the calculated bundle. Display the returned reward result.
- Milestone structures and notifications exist, but `applyRewards()` grants XP, skill points and hero unlocks—not a complete persisted mastery-cosmetic entitlement system.
- New screen callbacks expose buy/equip/sell, but not unequip (`main.ts:1401–1442`), while a legacy unequip handler exists (`319–345`). Verify and complete the active screen, not the hidden legacy inventory.
- Audio provenance remains unverified. `Sound/*.wav` is loaded through `sfx.ts`; repository MIT licensing alone does not establish rights to every media file. No audio was replaced during audit.
- Initial unauthenticated load makes protected API calls that return expected 401s; gate these requests rather than treating the console noise as server outage.

## Core journey evidence and limits

| Step | Status |
|---|---|
| Title render → login modal | Observed |
| New user → register through UI | **Blocked: no reachable registration action** |
| Register → preview-code verify → profile → login/logout via API | Passed; existing preview-code fallback only; test avatar was a synthetic string, not valid artwork |
| Existing disposable account → main menu | Observed desktop/mobile |
| Actual game launch | Reached once in browser run; not a completed combat journey |
| Real pointer/touch slicing → combo → survive wave → validated rewards | **Unverified**; attempted swipes did not establish successful hits |
| Gameplay earnings → return → reload/cloud consistency | **Unverified** |
| Shop purchase → inventory → equip → game → reload | **Unverified** |
| Real Steam/profile/admin session | **Not exercised** |
| Nonblank/changing gameplay canvas pixels; physical mobile/safe areas | **Not completed**; title/menu screenshots alone do not satisfy this |

### Corrections to the preliminary browser report

`iteration_1.json` is raw diagnostic output, not the final verdict. Its percentages are not a measured acceptance metric. The first browser workflow timed out after writing partial evidence.

- `#btn-start` and `#menu-leftnav` belong to the hidden legacy lobby. `src/ui/screens/mainMenu.ts` renders the active `.ftd-playcard__cta` and `.ftd-navtile` controls under `#screen-main-menu`; `main.ts:1455–1465` deliberately makes legacy and current menus mutually exclusive. Zero rectangles for old IDs do **not** prove visible controls are broken. Re-test active controls before any navigation rewrite.
- Registration is a genuine source-confirmed gap, not merely a selector failure.
- A blank test avatar is not evidence that real user avatars fail; the API fixture supplied invalid image bytes.
- Unequip exists in legacy logic; active-screen wiring is the narrower question.
- API characterization tests intentionally assert current insecure behavior. Their green status records reproducibility, **not anti-cheat acceptance**. Replace/invert those assertions into intended-behavior regressions during Phase 2.
- Splitter diagnostics use a **MOCKED localStorage Node shim only**, plus a no-op scene mount; actual game behavior modules are not mocked. No new application API or gameplay flow was mocked.

## Sequenced next work — no changes applied yet

1. **Complete baseline references:** obtain the actual 28 rules; reproduce locked Node 22 CI; retain this commit and evidence as the reference.
2. **Unblock journey / Phase 1:** restore reachable registration; fix splitter kill-context ownership and original-wave accounting; repair live hero level propagation; verify atlas crops and reward labels. Extend existing tests around the actual call chain rather than adding parallel calculators.
3. **Close Phase 1 with real journeys:** active-screen selectors, desktop pointer and real touch input, kill/combo/wave/reward/return/reload; then buy/equip/return. Explicitly distinguish local behavior from server validation.
4. **Phase 2 trust boundary:** server-owned runs and deterministic outcome validation; idempotent reward ledger and atomic wallet/ownership changes; cloud versions/conflicts/migration; verified-user gates; atomic daily/mission/achievement credit; trusted score submissions. Do not certify a pure “client sends kills” API as authoritative.
5. **Phase 3–4:** active inventory unequip/sell/mastery, end-run reward breakdown, Back/Home/safe-area/device QA using the existing theme and screen system.
6. **Phase 5–6:** isolated privileged admin session and permission matrix, user management/audit/ban tools, config schema validation, performance soak and asset provenance replacements.
7. **Future only:** shared-tower co-op first unless user changes direction, then ranked networking/seasons.

No module is proven unsalvageable. **No rewrite is proposed.**

## Admin-session handoff

The user offered to log in through their Steam account. Do not request passwords, Steam Guard codes, browser cookies or session tokens. A login on their device does not transfer into the automation browser. Redacted screenshots/recordings can establish actual admin/profile surfaces; hands-on follow-up should use a separate test identity and non-production data. Any privileged checks remain read-only unless the user explicitly authorizes specific changes. Real admin capabilities and production profile data have not been inspected in this audit.