# FruitTD — Full Project Audit, Outstanding Work & Handoff

**Date:** 2026-09-23  
**Repository:** https://github.com/4tunexx/FruitTD  
**Audited starting point:** `main` at `28bcf93ad8b7abacf4f1e187133376274d15d189`  
**Actual game checkout:** `/app/FruitTD`  
**Status:** Work in progress. **NOT cleared for merge into main.**

> This is a project-wide handoff, not a claim that every line, screen, device or permission has been exhaustively tested. It distinguishes reproduced defects, inspected implementations, user-reported problems, implemented changes and unverified work. There are many outstanding tasks; the number of tasks below is not a claim that that many independent bugs were reproduced.

## 1. Read this first

1. The original **TypeScript + Three.js + Vite + Tailwind / Express + MongoDB** game was preserved. It was not ported to React or FastAPI.
2. The original **241 tests passed**, and the original complete build passed in this environment.
3. A combat-polish pass has been implemented. The updated suite has **246 passing tests**, including five new focused combat tests. This does **not** mean the combat journey is verified.
4. **Release blocker:** automated desktop and true-touch gestures did not establish successful hits in the live preview. The page enters PLAY and targets spawn, but the attempted gestures did not produce the expected score/combo/trail results. Whether this is an application/input blocker, overlay/coordinate issue or automation problem must be resolved before signing off the pass. The root cause is not yet established.
5. **Server authority is not implemented.** Save balances, XP, ownership and scores remain client-trusted within partial caps. Do not advertise the current build as cheat-proof.
6. **Admin publishing → another player's Shop → purchase → Inventory → equip has not been verified end-to-end.** Parts exist; that is not proof the journey is complete.
7. **Nothing was pushed to GitHub from this work. No review branch or PR was created here.** GitHub connection/settings were not verified. The remote main branch was not changed by this agent.
8. The full **28-rule masterplan was not supplied**. Only the requirements in the conversation and current source were assessed. No invented 28-rule compliance claim is made.
9. The user requested working sequentially: finish combat, then the remaining navigation, economy, admin/catalogue and inventory work—not jumping between unrelated features.

## 2. Status legend

- **VERIFIED BASELINE:** directly exercised before changes.
- **IMPLEMENTED / MODULE-VERIFIED:** code changed and relevant isolated checks pass; live journey may still be pending.
- **CONFIRMED DEFECT:** reproduced, or clearly established by inspected code with the evidence stated.
- **USER-REPORTED / NEEDS REPRO:** reported by the user, but the exact failure has not yet been independently reproduced.
- **EXISTS / UNVERIFIED:** source or UI is present, but the real journey has not been signed off.
- **NOT IMPLEMENTED / FUTURE:** required or proposed work not completed here.

## 3. What was actually done

### Audit and setup

- Cloned the real repository's main branch into `/app/FruitTD` and recorded its commit.
- Retained the original game engine, source layout, Express routes, Mongo models, assets, tests and build scripts.
- Ran the original test suite: **241 passed, zero failures/skips**.
- Ran the complete original build: TypeScript checking, Vite frontend build and API bundling passed.
- Started the original Vite/Express game against local Mongo, using an external preview. Health endpoint returned `status:ok`, `mongo:true`.
- Captured desktop title and mobile main-menu screenshots.
- Ran six API characterization tests that demonstrate current trust boundaries, including defects. Those tests deliberately assert observed behavior, not the desired secure behavior.
- Reproduced the splitter pooled-object mutation bug with the actual FruitField module.
- Wrote the detailed baseline audit: `PHASE_0_AUDIT.md`.

### Combat work implemented

| Change | Files | Verification status |
|---|---|---|
| Blade vertices now use shared dynamic GPU buffers rather than updating copied arrays | `src/game/trail.ts` | New module test passes; live gesture visibility still blocked |
| Narrow, tapered ribbon using recent pointer samples; small bounded spark pool; reset clears effects | `src/game/trail.ts` | Geometry/reset checks pass; visual sign-off pending |
| Circular hit flashes replaced with short directional tapered geometry | `src/game/slashfx.ts`, `src/main.ts` | Geometry/orientation/lifetime module test passes; actual contact visuals pending |
| One compact chain/kill/bonus rail instead of stacked center-screen hit/multi-kill/reslice banners | `src/ui/combos.ts`, `src/ui/gameFeel.css` | Rail exists and old banner nodes absent in live checks; busy-combat legibility pending |
| Score ticks limited to four small pooled nodes, nearby numeric ticks coalesced, no oversized scaling | `src/ui/floatingScore.ts`, `src/ui/gameFeel.css` | Four-node bound observed; high-action screenshot comparison pending |
| Full-screen combo blur/vignette removed; combo shake restrained | `src/ui/combos.ts`, `src/ui/gameFeel.css`, `src/main.ts` | Implemented; actual high-combo experience pending |
| Gesture contact ownership retained across frame chunks; pooled generation IDs distinguish new targets | `src/game/strokeContacts.ts`, `src/input/blade.ts`, `src/main.ts` | Contact/generation unit test passes; true-input path pending |
| A swipe cannot immediately reslice debris it just created | `src/game/strokeContacts.ts`, `src/game/slicer.ts`, `src/main.ts` | Eligibility module check passes; live reslicing pending |
| Splitter parents quarantined until synchronous kill consumers finish; children queued when pool is full | `src/game/fruits.ts` | Pool-pressure child-spawn test passes; complete kill/reward integration pending |
| Original wave kills counted separately from split children; leaks invalidate perfect waves | `src/game/state.ts`, `src/main.ts` | Accounting module test passes; played wave journey pending |
| Removed phantom initial +1 combo for non-Jiju heroes; parry/milestone text reads calculated rewards | `src/main.ts` | Implemented; not independently proven in a live hit sequence |
| Cleared-wave events report the completed wave rather than the incremented next wave | `src/main.ts` | Implemented; event integration regression still needed |
| Reward saves grouped at frame boundary; Shop/Skills no longer remounted on each combat reward | `src/main.ts` | Implemented; network ordering/authority still unresolved |
| Added combat test IDs and read-only development diagnostics | `index.html`, `src/ui/screens/mainMenu.ts`, `src/game/combatDiagnostics.ts`, `src/main.ts` | Login → actual Play button → PLAY → targets observed |
| Added five intended-behavior combat regressions | `src/game/combatPolish.test.ts` | Updated suite 246/246 passed; a test-only TypeScript narrowing correction was subsequently applied |

**Do not read the table as “all fixed.” The live input/hit blocker prevents certification of the overall combat pass.**

## 4. Testing evidence and limitations

| Evidence | Result |
|---|---|
| `../test_reports/fruittd-phase0/unit-tests.log` | Original 241/241 passed |
| `../test_reports/fruittd-phase0/build.log` | Original complete build passed |
| `../test_reports/fruittd-combat-unit-precheck.log` | Original 241 still passed after combat edits |
| `../test_reports/fruittd-combat-unit-retest.log` | Updated 246/246 passed, including five new combat tests |
| `../test_reports/fruittd-combat-build.log` | Combat implementation build passed before the testing agent added its new test file |
| `../test_reports/iteration_1.json` | Partial baseline browser/API report; first browser workflow timed out |
| `../test_reports/iteration_2.json` | Reproduced original splitter mutation and accounting risk |
| `../test_reports/iteration_3.json` | Module checks passed; live desktop/touch hit confirmation unresolved |
| `../test_reports/iteration_4.json` | Final bounded module/build recheck, if present; not a replacement for live combat verification |

### Environment qualification

This environment uses Node **20.20.2**, Linux ARM64 and a Yarn compatible dependency install without changing package manifests/lockfiles. Repository CI uses Node **22** and its npm lock. Twelve installed package-path/version differences were identified versus that lock. **Exact locked CI reproduction remains pending.** Preserve the repository's existing package versions; do not silently downgrade.

The original main frontend bundle was approximately **917.70 kB minified / 248.71 kB gzip**. The combat build was approximately **918.49 kB / 249.14 kB gzip**. Vite's large-chunk warning remains. These are bundle sizes, not a measured mobile performance score.

### What the browser checks actually establish

- Title renders; a disposable existing user can log in; the active new Play button launches PLAY.
- The scene renders and game state advances; real targets eventually appear.
- The compact feedback rail exists; legacy banner nodes are absent; score pool is bounded to four nodes.
- They **do not yet establish** successful pointer/touch hits, directional contact effects during a real kill, combo accuracy in live play, completed wave rewards, or gameplay earnings surviving reload.
- In a slow headless run, targets appeared roughly 32 seconds after launch. This is an observation of that run, not a proven production spawn-time regression. Inspect elapsed game time/frame timings before changing wave timings.
- No physical iOS/Android device matrix, long-running memory soak, or production admin/Steam session was tested.

### Test-fixture caveats

- Email API checks used the repo's existing development `previewCode` fallback, **not actual email delivery or mailbox ownership proof**.
- Some disposable test accounts used synthetic invalid avatar bytes. Their blank avatar is not evidence that real avatars fail.
- Node combat tests use a **MOCKED localStorage harness only** and no-op scene mounting where appropriate. Actual FruitField/Three.js modules run; no new application API was mocked.
- The old characterization script outside the repository intentionally asserts the *old broken splitter behavior*. Keep it as baseline evidence; do not mistake it for a regression that the new implementation should continue satisfying.

## 5. Architecture: preserve what already works

| Area | Current source |
|---|---|
| Rendering / timing | `src/engine/renderer.ts`, `src/engine/loop.ts` |
| Input / slicing | `src/input/blade.ts`, `src/game/slicer.ts`, `trail.ts`, `slashfx.ts` |
| Enemies / waves / tower | `src/game/fruits.ts`, `enemies.ts`, `waves.ts`, `wall.ts`, `turrets.ts`, `state.ts` |
| Rewards / progression | `src/game/progression/*`, `heroProgression.ts`, `towerProgression.ts`, milestone modules |
| Persistence | `src/game/save.ts`, tower store, legacy perk migration |
| API client / auth / live config | `src/services/*` |
| UI / routing | `src/ui/hud.ts`, `src/ui/screens/*`, `src/game/navigation.ts`, `index.html` |
| Theme / layouts / reusable DOM UI | `src/ui/theme/*`, `src/ui/components/*`, `src/ui/design/*` |
| Backend | `server/app.ts`, `auth.ts`, `db.ts`, `routes/*`, `catalog.ts` |
| API bundle / CI | `scripts/bundle-api.mjs`, `api/[...path].js`, `.github/workflows/quality.yml` |

The source already has a central **client-side** reward pipeline, hero L1–100, tower L1–10, splitter children, separate Shop/Inventory screens, equip/sell handlers, a newer main menu and a screen registry. Do not rebuild these from scratch based on an outdated README checklist.

There is still substantial orchestration in `main.ts` and `hud.ts`, with old/new UI coexisting. Improve boundaries incrementally. **No module has been proven unsalvageable; no rewrite is approved.**

## 6. Highest-priority findings

### BLOCKER C-01 — live input/hit confirmation

**Status:** unresolved verification blocker.  
**Evidence:** `iteration_3.json`, actual PLAY/target snapshots, failed automated mouse/true-touch attempts.

Next investigation, in this order:

1. At the fresh projected target position, inspect `document.elementFromPoint(x,y)` / `elementsFromPoint` and the canvas bounding rectangle. Identify overlays intercepting gestures before changing damage math.
2. Record actual canvas pointerdown/move/up/cancel arrival, active pointer ID and `buttons`/pointer type.
3. Inspect pending segment counts, world-space projections, last accepted slash speed and stroke ID. Do not infer rejection from a trail snapshot captured after the trail has already expired.
4. Verify canvas coordinates remain correct after resize, mobile orientation and camera pan/zoom.
5. Compare real mouse and CDP touch input. Only then decide whether the bug is routing, capture, projection, thresholding or the test harness.
6. Re-run actual kills, multi-target strokes, reslice, combo expiry, tower damage, wave completion, pause/restart and reload persistence.

**Acceptance:** testing agent reports actual nonzero hit/score/XP changes from genuine gestures on desktop and touch, with screenshots showing the intended slash and compact feedback. No state mutation or fake kill hook may substitute for gameplay.

### P0 A-01 — new email registration is unreachable from title

Both title actions invoke login mode in `src/ui/hud.ts`; registration logic exists but has no reachable mode switch. API registration is not sufficient.

**Needed:** an explicit login/register switch, correct error/loading/back behavior, email verification and profile completion through UI. Test a genuinely new account, not only an existing fixture.

### P0 A-02 — email confirmation can fall back to exposing codes

`server/auth.ts` logs codes and returns `previewCode` when delivery is missing/fails. The fallback is not safely confined to a non-production setting. Session resolution does not consistently enforce verified-email/profile requirements on progression writes.

**Needed:** verified delivery integration, production-safe failure behavior, no code/token logging, resend/attempt limits and verified-user gating. Provider choice/setup is still pending; no credentials were collected for real delivery.

### P0 E-01 — economic cloud saves are client truth

**Reproduced:** authenticated sync accepted arbitrary in-cap coins/gems/XP, nonexistent ownership, and a lower save revision overwriting a higher one. Values above the coin cap are rejected, but caps do not establish legitimate earnings.

**Needed:** authoritative balances/entitlements, strict input schemas, server-owned revisions, atomic updates and migration policy. The client must never become authoritative merely by naming its payload an “event.”

### P0 E-02 — leaderboard scores lack trusted run evidence

**Reproduced:** an authenticated disposable account submitted score 54,321/wave 19 without playing that match.

**Needed:** server-owned run/session binding, admitted action sequence, computed outcomes, replay protection and trusted leaderboard publication. Authentication is necessary but insufficient.

### P1 E-03 — claim success is separate from durable wallet credit

**Reproduced:** daily claim returned a reward and rejected a second sequential claim, but server cloud-save wallet data did not change. Client code applies the reward then syncs later.

**Needed:** one atomic claim + wallet/entitlement transaction or equivalent idempotent ledger. Test a crash between response and client save, parallel requests and retries. Apply the same design to missions and achievements.

### P1 C-02 — original splitter lifecycle/count bugs

Original fatal kill marked the pooled parent inactive and immediately reused its object for a child before the caller calculated parent rewards. Child kills also inflated original-wave counts.

**Current change:** retirement quarantine, spawn generations, pending children under pool pressure, original-member accounting and leak checks. Module tests pass; live rewards/wave regression is still required under C-01.

### P1 D-01 — atlas semantic mismatch

The bomb mapping `[6,2]/[7,2]` visually uses fruit rind/seeded flesh, not bomb art. Existing bounds tests do not check semantic correctness.

**Needed:** labelled crop sheet, approved mappings, in-game intact/cut views, dedicated bomb art and transparent/no-bleed validation. Automated image analysis misidentified some tiles; its suggested remaps were not applied. Most other coordinates look broadly plausible but are not fully visually signed off.

### P1 P-01 — saves/network/UI work on the reward path

Original reward handling remounted Shop/Skills and started a snapshot sync per reward. Current pass batches local reward persistence at frame boundary and avoids those hidden-menu remounts. However, cloud requests can still overlap and the server accepts stale versions.

**Needed:** serialized/coalesced authoritative sync, correct acknowledgement/version handling, failure/retry UI, and measured frame/network profiles. Do not claim the small batching change solves cloud conflicts.

## 7. Duplicate screens, menus and navigation

**Status:** user-reported problems + inspected coexistence; full route matrix not completed.

The active new main menu is rendered under `#screen-main-menu` using `.ftd-playcard__cta` and `.ftd-navtile`. Old `#btn-start` and `#menu-leftnav` elements remain in a deliberately hidden legacy lobby. Early automation incorrectly targeted the legacy controls. A zero rectangle on an intentionally hidden element is not proof that the visible control is broken.

This does **not** rule out genuine duplicate rendering, click interception, stale overlays, duplicate handlers or dead-end navigation. Those need direct reproduction.

### Navigation checklist

- [ ] N-01 Inventory every main screen and overlay; identify the single active implementation and its owner.
- [ ] N-02 Reproduce user-reported duplicate screens; record state, visible layers, hit-test target and exact entry/back sequence.
- [ ] N-03 Route Play, title login/load, Heroes, Shop, Inventory, Profile, Missions, Achievements, Settings, News, Daily, VIP, Ranked, Co-op and Admin consistently.
- [ ] N-04 Back returns one level; Home returns main menu; close buttons work on mouse/touch/keyboard.
- [ ] N-05 One deliberate confirmation when leaving a live match. Current source has a quit confirmation and a navigation guard; investigate possible double prompts.
- [ ] N-06 Paused/game-over/menu layers cannot intercept resumed gameplay after closing.
- [ ] N-07 No duplicate click/listener installation after repeated opening, render refresh or hot reload.
- [ ] N-08 Registration, verification and profile setup have clear reachable exits and continuation.
- [ ] N-09 Remove obsolete legacy markup/handlers only after mapping remaining dependencies and preserving working features.
- [ ] N-10 Consistent safe areas, modal focus/escape behavior, scroll containment and touch targets.
- [ ] N-11 Add stable test IDs to active controls and critical displayed state; do not rely on obsolete IDs.
- [ ] N-12 Route coverage tests on desktop and mobile, including opening/closing each surface repeatedly.

## 8. Admin slicer editor → publish → every player's Shop

### What exists

- Slicer editor and add-slicer functions in `src/ui/adminCatalog.ts`.
- Creator draft editing and local preview in `src/ui/creatorSlicerVfx.ts`.
- `publishToLive()` merges creator slicer packs and calls `saveAdminConfig()`.
- Client sends authenticated `POST /api/admin/config`; server checks the authenticated user's Steam ID against `ADMIN_STEAM_ID` before saving configuration.
- Public `GET /api/admin/config` can expose published configuration to player clients.
- `loadLiveConfig()` retrieves config; slicers map into catalogue items through `src/game/catalog.ts`.

### Concrete gaps / risks

1. **Publish failure is not global publish.** `creatorSlicerVfx.ts:405–421` also applies local overrides when the server write fails and reports “Published locally.” This can make the creator see a slicer that other players never receive.
2. **Existing clients do not automatically refresh forever.** `loadLiveConfig()` caches a single promise. A real-time/periodic version refresh or a documented next-load policy is needed; do not promise immediate visibility to already-open sessions.
3. Creator VFX draft/preset storage is local. Verify that published data includes everything a second browser needs, not only numeric slicer overrides.
4. Server config write accepts several nested arrays without complete per-item schema validation/versioned conflict checks.
5. There is no completed server-authoritative purchase/ownership transaction connecting that public catalogue item to a player's wallet.
6. A real privileged Steam admin session and a separate non-admin player session were **not tested** here.

### Required acceptance journey

```text
ADMIN authenticates with server-verified permission
→ CREATE unique slicer ID/name/rarity/price/currency/allowed stats
→ preview real trail and slice effects
→ SAVE DRAFT without public visibility
→ PUBLISH successfully to server
→ persisted catalogue revision changes
→ independent NON-ADMIN browser receives published item
→ correct Shop category/card/price/preview
→ server-authorized PURCHASE exactly once
→ coins/gems debited atomically
→ OWNERSHIP persisted
→ item appears in owned INVENTORY
→ EQUIP correct slot
→ actual in-game trail/effect reflects item
→ reload / second device preserves entitlement and equipped selection
```

### Admin/catalogue checklist

- [ ] AD-01 Test allow/deny matrix: anonymous, unverified user, verified player, admin, revoked/expired session.
- [ ] AD-02 Validate every mutation server-side; UI visibility is not authorization.
- [ ] AD-03 Versioned draft/published/disabled lifecycle; clear success/failure states, no local-only state masquerading as global publish.
- [ ] AD-04 Validate IDs, unique names/IDs, finite prices/stats, enums, maximum lengths and URLs/media sizes.
- [ ] AD-05 Separate public catalogue fields from private admin/account/audit fields.
- [ ] AD-06 Independent-browser catalogue freshness policy and revision handling.
- [ ] AD-07 Complete user search/profile/economy/progression management with reasoned, audited adjustments.
- [ ] AD-08 Mission/achievement/badge/rank editor schema validation and disabled-content behavior.
- [ ] AD-09 Leaderboard moderation, cheat flags, bans/unbans, server enforcement and audit trail.
- [ ] AD-10 Feature-toggle/config authorization, safe defaults, rollout and rollback history.
- [ ] AD-11 Protect against lost concurrent admin edits and duplicate publish submissions.
- [ ] AD-12 Persist creator packs/media/VFX needed by players across browsers; validate image/audio provenance and serving paths.
- [ ] AD-13 Confirm whether slicer numeric bonuses are intentional gameplay items or should be cosmetic-only; preserve explicit design, do not silently rebalance.

## 9. Shop, Inventory and equipping

**Exists:** separate Shop/Inventory screens, catalogue item mapping, owned filtering, local affordability/ownership guards, equip/sell handling and previews. **Missing:** trusted end-to-end entitlement/economy flow and complete active-screen polish/validation.

- [ ] I-01 Shop displays purchasable items; Inventory displays owned items only; consistent categories/search/filter/empty state.
- [ ] I-02 Server computes price and currency from published catalogue, never client payload.
- [ ] I-03 Atomic purchase debit + entitlement; double click/retry/multiple devices cannot double-charge or create free ownership.
- [ ] I-04 Handle insufficient funds, disabled/deleted items, price changes and stale catalogue revisions.
- [ ] I-05 Inventory has an understandable active loadout with blade/wall/effect slots and equipped indicators.
- [ ] I-06 Equip/unequip is reachable from the active new inventory. Legacy unequip logic exists, but newer screen callbacks expose buy/equip/sell without the equivalent complete unequip wiring.
- [ ] I-07 Reject unowned/incompatible/disabled item equip server-side. Do not rely only on sanitized local save.
- [ ] I-08 Define selling rules: starters, equipped items, fallback slot, refunds, resale limits and audit entries.
- [ ] I-09 Selling removes durable entitlement and credits wallet atomically; prevents duplicate sale/retry farming.
- [ ] I-10 Actual cosmetic preview matches in-game blade, wall and authored VFX, not an unrelated sample animation.
- [ ] I-11 Publish/edit/unpublish behavior for already-owned items is explicit; never silently destroy purchases.
- [ ] I-12 Purchase/equip/sell survives local reload, fresh login and second device; no max/union merge resurrects sold items.
- [ ] I-13 Nice mobile equipping screen: readable item/name/stats, complete artwork, compact actions, reliable Back/Home and no nested blocking overlays.
- [ ] I-14 VIP remains in-game currency only; server validates tier, price, benefits and one-time grants. No real-money checkout in current scope.

## 10. Progression, rewards, missions and mastery

**Exists:** hero L1–100, tower L1–10, milestone/perk structures, reward events/calculator/apply step, hero unlock rules, missions/achievements/daily routes and client reporting.

**Important correction:** `createState()` uses a Proxy getter to derive `heroLevel` from `heroXp`. An early audit suspicion based only on assignments was wrong. Do not add a redundant level calculator or call that a fixed bug.

- [ ] R-01 Complete the real kill → combo → wave → XP/coins → level-up → save → reload journey.
- [ ] R-02 Verify every reward path: normal/special/boss/turret/super/guest/bomb parry/reslice/combo/perfect wave/game-over.
- [ ] R-03 One kill identity/one reward; retain correct parent metadata and source through effects, events and persistence.
- [ ] R-04 Agree clear meanings for HIT, KILL, RESLICE and CHAIN; only actual kills feed kill notices, no phantom initial combo increment.
- [ ] R-05 Verify all hero unlock thresholds and purchase-only heroes; unavailable heroes cannot be equipped through any path.
- [ ] R-06 Complete actual milestone/mastery entitlements, not only descriptive toasts. Persist badges/titles/cosmetics once.
- [ ] R-07 Hero perk spend/refund/upgrade UI, affordability and combat effect match saved ranks.
- [ ] R-08 Tower milestone bonuses apply at documented boundaries; test perfect-wave/last-stand/juice/fire-rate bonuses without double multipliers.
- [ ] R-09 End-of-run summary separates run score, earned coins, hero XP, tower XP, unlocks and saved/pending/error status.
- [ ] R-10 Missions/achievements/badges consume server-validated events, not arbitrary progressDelta/setProgress from client.
- [ ] R-11 Daily/weekly/monthly period boundaries, UTC/calendar policy, streak gaps and claim-once behavior.
- [ ] R-12 Atomic claims, retries, concurrent claims, reconnects and crash-before-save scenarios.
- [ ] R-13 Guest/co-op-labelled local helper rewards cannot masquerade as validated ranked/co-op outcomes.
- [ ] R-14 Boss phases, telegraphs, weak points and unique behaviors remain content work, not completed foundations.

## 11. Server authority, saves and account integrity

### Target ownership model

The server owns spendable balances, XP, unlocked/purchased entitlements, claims, scores and run results. The client owns presentation/input and may cache acknowledged data. A signature on an unvalidated client “kill” claim does not make it authoritative.

- [ ] S-01 Strict schemas for every economy/progression/config request; reject malformed objects, non-finite values, negatives, unknown IDs and invalid enum combinations.
- [ ] S-02 Server-owned run state, action sequencing, valid timing/cooldowns, supported hero/loadout and deterministic reward rules.
- [ ] S-03 Unique action/transaction IDs and reward ledger; duplicate/reordered submissions return the same result without new rewards.
- [ ] S-04 Atomic wallet/entitlement/claim updates with a documented Mongo transaction or equivalent consistency strategy.
- [ ] S-05 Server-issued save revisions; reject stale updates instead of raw last-write overwrite.
- [ ] S-06 Never accept forged coins/gems/XP/ownership just because they fall below a cap.
- [ ] S-07 Account-bound caches/local saves; signing into another user must not import the previous user's economic state.
- [ ] S-08 Legacy/corrupt-save migration: version, validation, backup, explicit trust policy and safe fallback. Do not grant arbitrary historic client balances as authoritative by default.
- [ ] S-09 Conflict tests for spend versus spend, equip versus sell, new device, offline play and delayed old writes.
- [ ] S-10 Retry queue/acknowledgement UI; durable claims survive app close after server success.
- [ ] S-11 Read/query projection and serialization discipline; avoid accidental private-field exposure in public config/profile responses.
- [ ] S-12 Enforce verified account/session/ban status consistently across protected endpoints.
- [ ] S-13 Rate-limit writes, claims, login, verification and resend; handle malformed sessions without service errors.
- [ ] S-14 Session expiry/logout/revocation, Steam linking collision and one-time Steam benefit handling.
- [ ] S-15 Production database configuration: `server/db.ts` hardcodes `FruitTD`, ignoring example MONGODB_DB. Correct deliberately, with migration safety—not by accidentally pointing tests at production.
- [ ] S-16 Operational checks: trusted origin/callback config, secret handling, database failure behavior, backups and restore test. No operational readiness certification was performed.

## 12. Mobile, effects, accessibility and performance

- [ ] M-01 Confirm genuine touch slicing at narrow portrait and landscape widths, including first gesture after login/resume.
- [ ] M-02 Inspect pointer capture/cancel, multi-touch pan, browser back/scroll, lost focus and orientation changes.
- [ ] M-03 No critical target/tower occlusion from hit/combo/toast/achievement/boss UI; actual combat screenshots, not static menus only.
- [ ] M-04 Safe areas/notches/home indicator; no overflow or text clipping; mobile build sidebar closes and releases input.
- [ ] M-05 Effects obey reduced-motion settings; remove camera/blur excess without removing essential danger cues.
- [ ] M-06 Score/counter DOM and particle/effect pools remain bounded during long high-action runs.
- [ ] M-07 Pause/restart/quit clean up visible trails, pending gestures, timers and overlays.
- [ ] M-08 Profile CPU/GPU/network/GC separately; measure low-end device frame time, not only desktop FPS.
- [ ] M-09 Audit dynamic buffer ownership elsewhere, object pooling, material/geometry disposal and texture cache growth.
- [ ] M-10 Audit repeated event listeners, intervals/timeouts, screen observers and creator preview animation teardown.
- [ ] M-11 Inspect HUD DOM remounts/innerHTML churn; combat batching implemented is only one part.
- [ ] M-12 Preserve existing DPR/bloom low-power behavior; verify resize/context loss/restoration and retina readability.
- [ ] M-13 Keyboard focus, accessible labels, modal focus return, text contrast and reduced-motion regressions.
- [ ] M-14 Asset manifest: source/author/license/usage for every texture, icon, font, music and sound. Repository MIT license is not proof of third-party audio rights.
- [ ] M-15 Replace uncertain-provenance audio with licensed/original alternatives; no audio replacements completed here.
- [ ] M-16 Bundle/code-splitting/loading strategy: separate admin/creator-only payload where safe; measure before changing engine loading.

## 13. Co-op, ranked and future additions

These are deliberately later, not a distraction from broken core loops.

- [ ] F-01 Real-time shared-tower co-op networking, lobby lifecycle, player disconnect/reconnect and authoritative shared state.
- [ ] F-02 Team contribution/rewards/combos, role/ability coordination and anti-farming validation.
- [ ] F-03 Ranked matchmaking, divisions/tiers, server-validated results and seasonal leaderboards.
- [ ] F-04 Seasonal resets/rewards with replay-safe grants and tie/late-submission policies.
- [ ] F-05 Expanded heroes/enemies/bosses/content, events and challenges after core correctness.
- [ ] F-06 Optional useful enhancement: a small player-controlled combat-feedback intensity setting, after a clean default and verified input. Not implemented.
- [ ] F-07 Real-money IAP/payments only in a separately agreed later scope; gems are in-game currency now.

## 14. Ordered work plan and exit gates

### Stage 1 — close combat, do not jump away mid-fix

1. Resolve C-01 through pointer/overlay/projection evidence.
2. Verify actual directional effects and readable bounded feedback on desktop and touch.
3. Verify contact/kill/reslice/wave counts, splitter parent rewards and no reward loss on game-over.
4. Verify earned progression persists after return/reload.
5. Require a testing-agent report explicitly passing the reported combat issues and a green full test/typecheck/build.

### Stage 2 — navigation and new-user access

1. Reachable registration/verification/profile journey.
2. Active-screen ownership and overlay/back/home matrix.
3. Reproduce and repair actual duplicate/dead-end cases before removing old screen code.
4. Re-run the core combat journey from a new account.

### Stage 3 — trusted progression and saves

1. Server-owned run/economy/ownership design, schemas and migrations.
2. Atomic reward/claim/purchase ledger and revision control.
3. Score validation, retry/concurrency/offline/account-switch tests.
4. No “server-authoritative” label until forgery/replay/stale-write tests fail safely.

### Stage 4 — admin publishing and player equipment journey

1. Isolated verified admin account plus independent regular player account.
2. Create/draft/publish/failure/freshness tests.
3. Server purchase → owned Inventory → equip/unequip/sell → actual gameplay → second-device persistence.
4. Complete mastery/end-run views and permissions/audit tools.

### Stage 5 — device, performance, provenance and online expansion

1. Physical mobile matrix, performance/leak soak and source/licensing manifest.
2. Resolve measured issues; lock regression screenshots and journeys.
3. Only then real-time co-op and ranked systems.

## 15. GitHub / continuation safety

- The user wants a review branch, inspecting changes before merging main. Preserve that separation.
- No manual push/commit/PR was performed here. Do not assume a review branch already exists.
- GitHub connection, branch-field settings and automatic repository-root mapping were not independently verified. Earlier support text should not be treated as confirmation of those settings.
- **Workspace-root warning:** the actual repository is `/app/FruitTD`. `/app/frontend` and `/app/backend` are unrelated starter templates, not the game. Do not accidentally replace the GitHub repository with those folders or upload the game as an embedded submodule/nested wrapper. A valid FruitTD branch retains `src/`, `server/`, `api/`, `index.html`, `package.json`, lockfile and original assets at repository root.
- Review the actual saved branch/diff before merging. The presence of this audit does not make the code merge-ready.
- Never put `.env`, Steam credentials, passwords, verification codes, Mongo URLs, session tokens or disposable credential artifacts in the review branch.
- Some original files use CRLF; patch tools introduced line-ending noise. Review with whitespace-at-EOL ignored to distinguish logical changes from formatting, and normalize deliberately if desired.

### Commands / evidence for the next developer

```text
Repository root: /app/FruitTD
Baseline commit: 28bcf93ad8b7abacf4f1e187133376274d15d189

Existing scripts:
  test      → node scripts/test-runner.mjs
  dev       → vite
  server    → tsx server/index.ts
  build     → tsc --noEmit && vite build && node scripts/bundle-api.mjs

Current environment checks:
  yarn test
  yarn exec tsc --noEmit
  yarn build

Repository CI reference:
  Node 22, npm ci, npm test, npm run build
  Exact locked CI reproduction has not been completed here.
```

`yarn build` regenerates the tracked API bundle. During this work builds ran in a clean copy under `/root` to avoid unrelated generated-file changes in the game checkout.

### Runtime notes for this workspace only

- Original game runs as Supervisor `fruittd_frontend` and `fruittd_backend`.
- `/root/fruittd-runtime/start.cjs` and `runtime.env` adapt paths/ports/preview host; they are not intended production game code.
- Protected original environment values were not changed.
- Only local Mongo was used; `FruitTD` database was empty before audit and now contains disposable audit data. Do not promote it as production data.
- Credential fixture path used by automation: `/app/test_reports/fruittd-phase0/ui_seed_account.json`. **Private test artifact; exclude from source handoff.** This document contains no credential values.
- `?combatDebug=1` in the Vite development build provides `window.__fruitTdCombatSnapshot()` with read-only gameplay/target snapshots. It is not installed in production. Do not turn it into a production state-mutation backdoor.

## 16. Files changed / new source files

Modified game files:

```text
index.html
src/game/fruits.ts
src/game/slashfx.ts
src/game/slicer.ts
src/game/state.ts
src/game/trail.ts
src/input/blade.ts
src/main.ts
src/ui/combos.ts
src/ui/floatingScore.ts
src/ui/gameFeel.css
src/ui/screens/mainMenu.ts
```

New source/test files:

```text
src/game/strokeContacts.ts
src/game/combatDiagnostics.ts
src/game/combatPolish.test.ts
```

Documents:

```text
PHASE_0_AUDIT.md             detailed initial baseline with subsequent correction
AUDIT_AND_HANDOFF.md        this current project-wide continuation checklist
```

Additional workspace memory/evidence is outside the repository under `/app/memory`, `/app/tests` and `/app/test_reports`. Do not blindly upload all test artifacts: some are local fixture credentials or diagnostics asserting old broken behavior.

## 17. Questions still requiring the owner

1. Supply the actual 28-rule masterplan so requirements can be mapped exactly.
2. Provide redacted screenshots/recordings of specific duplicate-menu/admin/profile issues when available; do not share Steam passwords, Steam Guard codes, cookies or tokens.
3. For privileged hands-on checks, use a separate test identity and non-production data. A login on the owner's device does not automatically transfer to the automation browser.
4. Confirm intended catalogue refresh policy and selling/disabled-owned-item rules.
5. Confirm shared-tower co-op before competitive ranked if different from current assumption.
6. Confirm email provider/integration when starting real confirmation delivery. No real email delivery was configured in this pass.

---

## Final handoff verdict

**Work exists and is preserved. Original engine retained. 246 tests currently pass. Combat module improvements are implemented, but real hit/effect/reward verification remains unresolved. Server authority, complete navigation and the admin-to-player catalogue/equipment journey are still outstanding. Do not merge solely on the green unit count.**

Use the ordered exit gates above to continue without restarting or replacing the game.