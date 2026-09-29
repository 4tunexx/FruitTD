# FruitTD full codebase and feature audit

**Reviewed:** 2026-09-29  
**Repository:** `4tunexx/FruitTD`, branch `main`  
**Reviewed local source commit:** `37648f5994d32973dc49a80d9b2cf0206122aaa3` (`37648f5`)  
**Working tree at review start:** no modified or untracked files; local `main` reported `ahead 1` of its locally cached `origin/main` reference. This does not by itself prove the current GitHub branch is at this commit.  
**Test run:** `npm test` — 310 passed, 0 failed, 0 skipped.  
**Build:** `npm run build` — passed on this reviewed tree (TypeScript, Vite, Vercel API bundle).  
**Atlas observation:** read-only metadata and document counts checked 2026-09-29. No documents were written or deleted.

## How to read this audit

This is a repo-wide inventory of player-facing screens, server endpoints, game systems, data collections, and meaningful verification. It is not a claim that every line, runtime combination, mobile device, or production deployment has been manually exercised. Code existence, unit-test evidence, a successful local build, live Atlas metadata, deployed behavior, and real-phone behavior are different kinds of evidence and are labeled separately.

| Label | Meaning |
|---|---|
| **Implemented; tested** | Behavior exists in source and has a relevant automated test. This does not automatically imply live production/device verification. |
| **Implemented; partial** | A foundation, local-only version, constrained version, or UI/data model exists; the advertised complete experience is not present. |
| **Present; not verified end to end** | Source/UI exists, but the meaningful user journey has not been exercised in a real browser/device or against the live service. |
| **Missing / deferred** | The feature is not implemented as a working player feature. |
| **Observed** | Directly checked in the local source, this test run, or read-only Atlas metadata. |

## Executive status: what is real

FruitTD is a playable Three.js browser game with a vanilla TypeScript DOM interface, a four-panel hub, a local match loop, fruit-slicing combat, progression, a server/API layer, and MongoDB-backed account/cloud-save/economy foundations. The project is **not production-ready as a fully complete mobile tower-defense/social game** on the evidence collected here.

| Area | Actual status |
|---|---|
| Local game loop and slicing | **Implemented; tested** at unit/integration level. No current iPhone/Android gameplay soak test was run. |
| Menus, hub, shop, inventory, profile, settings | **Implemented; tested** at renderer/navigation unit level. No full browser route-matrix or live phone visual audit was run. |
| Account login/registration/email verification/Steam | **Implemented; tested in part.** Real production email delivery, Steam credentials/callback, and live account journeys were not tested in this audit. |
| Cloud save and player inventory ownership | **Server-authoritative foundation implemented; tested with mocks.** Client sync is revision-checked and server-owned fields are protected. Live competing-device use was not tested. |
| Wallet claims | **One-time wallet credit is atomic on the cloud-save document; concurrency tests pass with mocks.** Claim-progress rows and wallet are not one multi-document Mongo transaction. |
| Leaderboard | **Authenticated, bounded, token-gated submissions implemented; tested.** A valid token does not prove the submitted score reflects server-simulated play; ranked matchmaking is absent. |
| Campaign | **100-stage generated structure, map UI, unlock model, admin boss roster fields, and tests exist.** No complete 100-level in-browser play-through, persisted victory loop, or authored story campaign has been verified. |
| Horde | **Endless sectors/difficulty rules exist and have unit coverage.** No long-duration play/device test was run. |
| Co-op | **Local guest-assist rules only. Online friend co-op/shared match/lobby is missing.** |
| Social | Friends, public profiles, notifications, and accepted-friend messages have UI/API foundations and mocked route tests. Atlas collections are currently empty; no two-account production journey was tested. |
| Community forum | **Missing.** |
| Admin | Config/catalog/editor surfaces and API exist. Mobile usability, all live previews, all changes taking effect in a running game, and every asset upload/persist/reload path are **not** end-to-end verified. |
| Live MongoDB | Atlas database and all 13 source-used collection names exist. Counts and index key names were observed. Unique/TTL options, validators, all documents, production credentials, and complete app behavior were not independently verified. |
| Production/mobile stability | **Not established.** A green unit suite and build do not prove “100% bug free,” no stalls, performance, deployment health, or device compatibility. |

## Project architecture and build surface

- This is **not a React application**. `package.json` has no React dependency. The client uses TypeScript, direct DOM rendering, CSS, Three.js, and Lucide icons (`src/main.ts`, `src/ui/**`, `src/game/**`).
- The game renderer and simulation are in `src/engine/**` and `src/game/**`; UI screens and HUD are in `src/ui/**`; API code is Express in `server/**`; Vercel’s API entry points are `api/entry.ts` and `api/[...path].js`.
- Vite serves/builds the client. `npm run build` runs `tsc --noEmit`, `vite build`, and `scripts/bundle-api.mjs`.
- `npm test` runs Node’s test runner through `scripts/test-runner.mjs` and `tsx`. There is no Playwright/Puppeteer browser test script, lint script, or static security audit script in `package.json`.
- The legacy menu/dashboard markup remains in `index.html` alongside the modern screen hosts. Navigation code and tests hide/inert legacy areas, but the markup has not been removed.

## Every active screen, page, and major overlay

The navigation state definitions are in `src/game/navigation.ts`; DOM registration and host ownership are in `src/ui/screens/index.ts` and `src/ui/screens/registry.ts`. Most primary destinations render as tabs inside a single `#screen-hub`; they are not separate web pages.

| User-visible destination/surface | Owner / host | What is implemented | Evidence / limitation |
|---|---|---|---|
| Title / sign-in entry | `src/ui/screens/mainMenu.ts`, `src/ui/authModal.ts`; title markup in `index.html` | Start/continue, account state, login/register modal entry | `authModal.test.ts` verifies Create Account reaches registration and signed-in title labels. Live email not tested. |
| Main hub / Home / Play | `src/ui/screens/hub.ts`, `hubTabs.ts`; `#screen-hub` | Header identity/currency and primary Play/mode selection | Hub tests cover render and route. No phone screenshot review in this audit. |
| Heroes | `hubTabs.ts`, `src/ui/screens/heroes.ts` | Hero roster, level/status and select/buy actions | Unit-render and server purchase tests exist; live server reload not exercised. |
| Shop | `hubTabs.ts`, `src/ui/screens/shop.ts`, `itemCard.ts`, `catalog.ts` | Catalogue cards, categories, coin price, buy callback | Tests cover catalogue filtering and active renderer; physical blade art/preview quality on phone is unverified. |
| Inventory | `hubTabs.ts`, `src/ui/screens/inventory.ts`, `itemCard.ts` | Owned gear, equip, unequip, sell actions | Tests cover owned-only state, unequip action, and a mocked purchase/equip/cloud reload path. Live Atlas reload not run. |
| Profile | `hubTabs.ts`, `src/ui/screens/profile.ts` | Local career/profile stats and identity | Renderer tests; public profile via social API is a separate feature. |
| Co-op entry | `hubTabs.ts`; mode in `src/game/modes.ts` | Starts a local guest-assist match mode | It is not online co-op, lobby creation, friend invite, or a two-player shared session. |
| News / daily entry | `src/ui/screens/news.ts`, daily modal | News surface and entry to daily bonus | UI/API exists; no live daily claim test against Atlas. |
| Settings | `src/ui/screens/settings.ts` plus title modal | Current settings actions include sound/session options and theme/design controls in separate UI modules | This is not a comprehensive options menu; controls/device/audio accessibility not fully audited. |
| Campaign map | `src/ui/screens/campaign.ts`, `.css`; `src/game/campaign.ts` | Map/stage selection, boss intel, lock state, start callback | Tests cover unlocked/locked rendering and selecting a stage. Full match-to-victory-to-save-to-next-stage journey is not covered by a browser test. |
| Social / Friends | `src/ui/screens/social.ts`, `.css`; `src/services/social.ts`; `server/routes/social.ts` | Friends list/request/respond, profile lookup, messages, notifications | API tests use mocks; Atlas collections are empty. No real two-account/device test. |
| Missions | `src/ui/screens/legacyMenu.ts` plus legacy host `#hud-start` | Mission/quest page and progress/claim UI | Catalog and claim routes exist. Legacy host is still present; no full live claim journey. |
| Achievements | `legacyMenu.ts` / `#hud-start`; `src/services/achievements.ts` | Progress, unlock/claim UI and server route | Catalog and unit/API mock tests; live claim not verified. |
| Ranked | Legacy leaderboard/menu and home mode entry; leaderboard services/routes | Local match mode plus ranked score ladder/season-rank rewards | No matchmaking, lobby, opponent simulation, or real-time ranked match. Score is client-submitted after a token is consumed. |
| Arena | Game-mode configuration in `src/game/modes.ts` | Solo challenge rules/difficulty parameters | Not player-versus-player arena. No versus match service. |
| Horde | `src/game/modes.ts`, `waves.ts`, game loop | Endless five-wave sectors, no boss rounds, increasing pressure | Unit checks mode/rules; no long session/mobile soak. |
| Match: pause/game over | `index.html`, `src/main.ts`, `src/game/navigation.ts` | Pause/resume/retry/menu flow and game-over surface | Navigation/game logic tests exist; browser interaction and duplicate confirmation behavior not fully E2E verified. |
| Daily reward modal | `index.html`, daily service/routes | Claim UI and server wallet reward path | Concurrent claim tests use mock collection; no live Atlas claim verification. |
| Auth modal / email confirmation / profile setup | `index.html`, `src/ui/authModal.ts`; `server/routes/auth.ts` | Login, registration, verify/resend email, Steam email, username/avatar setup | Tests verify registration switch and production preview-code suppression. Actual production email, avatar upload, and Steam flow not verified. |
| Admin panel / creator tools | `index.html`, `src/ui/admin.ts`, `adminCatalog.ts`, `adminMediaStudio.ts`, `creatorWaveBoard.ts`, `creatorSlicerVfx.ts`, `server/routes/admin.ts` | Admin verification; menu/game config; rewards/content; slicer/enemy/waves/campaign boss fields; creator tools | API/mock tests and some preview logic tests. See Admin section: broad end-to-end coverage and phone layout absent. |
| Legacy dashboard/lobby | `index.html` `#hud-start`; `src/ui/screens/legacyMenu.ts` | Retained for legacy quest/leaderboard/skills surfaces | Tests assert hidden/inert/unwired legacy Play controls and active route behavior. Source markup remains, so dead/duplicate content cleanup is incomplete. |
| Quit confirmation | title quit modal and match navigation guards in `src/main.ts` | App-specific modal/guard code exists | Exactly-one-confirmation behavior was not exercised in an end-to-end browser run during this audit. |

**Overlay inventory:** pause, game-over, daily claim, auth, Steam, email verification, profile setup, admin, title settings, title quit, and campaign victory are markup-backed in `index.html`. The campaign map and news/settings/social/hub are screen-host backed. Some screen routes are tabs or legacy-host states rather than standalone pages. A test route matrix covers core navigation logic and primary hub controls, not every overlay/API/device combination.

### Navigation and blank-screen concern

The registry groups states that share `#screen-hub` and computes host visibility once, specifically to avoid tab-order visibility conflicts. Tests verify the registry and active shop/inventory renders. This is evidence against one known class of blank-host regression, **not proof the user-reported blank screen can never occur**: no live mobile browser, production deployment, browser console, or device screenshot was checked for this audit. Social renders asynchronously and has a fallback panel on import failure. Other network-dependent screens should still be verified with real API failure/slow-response handling.

## Gameplay systems and mechanics

| System | Current implementation | What has and has not been proven |
|---|---|---|
| Rendering | Three.js/WebGL scene, procedural field, wall/tower, fruit objects, juice/particles, trail/slash FX (`src/engine`, `src/game`, `src/main.ts`) | Local build passes; no Safari/WebGL device matrix or frame-time report. |
| Game loop | `src/engine/loop.ts`; capped elapsed step and limited catch-up steps | No automated long-running pause/background/resume or phone thermal/performance soak. A stuck session is not ruled out. |
| Input/slicing | Pointer blade input, projected fruit collision/stroke contact, slash trail (`src/input/blade.ts`, `src/game/slicer.ts`, `strokeContacts.ts`, `src/main.ts`) | Desktop synthetic and simulated touch integration tests each kill a fruit and grant score/XP. This is harness-level, not actual iOS Safari gesture validation. |
| Enemies/fruits | Fruit definitions, enemy archetypes, HP, status traits, split/explosive/boss behavior (`fruits.ts`, `enemies.ts`, `waves.ts`) | Unit coverage includes special enemy scaling, split/pool cases, boss completion; no full-stage browser balance verification. |
| Bombs | Bomb/explosive fruit has HP/score and can hurt the tower when sliced; explosive leak/hit damage scales with waves and has a cap | Relevant combat tests verify explosive hit damage grows in later waves and bomb/boss leak scaling. Bomb damage is not inferred from name alone: it is present in combat code/tests. Full progression balance and touch behavior remain unverified. |
| Tower/wall | Tower, build pads/turrets, juice-fueled defenses, selection range ring, HP fill at foot of wall (`wall.ts`, `turrets.ts`) | `wallPresentation.test.ts` verifies range only after selection and tower HP ground bar update. A screenshot/device check for exact placement, readability, non-duplication, and full-screen framing is not available here. |
| Phone juice bar | CSS media query at max 600px moves `#super-wrap` into a horizontal row beneath player identity (`src/style.css`) | Source rule exists; there is no screenshot or real-phone assertion in the suite. The provided screenshot showed a vertical bar in an earlier deployed state. Current production parity is unknown. |
| XP/reward feedback | Hero/tower XP, combo, score floats, juice meter and HUD (`hud.ts`, `floatingScore.ts`, progression files) | Calculation/progression tests pass. No visual/animation browser capture or production phone inspection. |
| Build/place/turrets | Build UI and tower defenses with costs, range, fuel, attack types (`wall.ts`, `turrets.ts`) | Logic exists; no complete play test of every turret at every tier. |
| Modes | `casual`, `ranked`, `coop`, `arena`, `horde`, `campaign` | Mode table is in source. `coop` means local guest assist; `ranked` does not matchmake; `arena` does not pair players. These labels currently overstate online capabilities if read as online modes. |
| Horde | Sectors and difficulty ramp; no boss rounds | Unit-tested mode foundation. Long run, score persistence, rewards progression, and exploit resistance have not been verified end to end. |
| Campaign | 100 deterministic boss entries, 5 waves for stages 1–9, then 10 at stage 10, 20 at stage 20, … up to 100 at stage 100; rewards/difficulty increase in generated data; unlock progress model | Unit tests cover wave milestones, distinct generated names, increasing threat/rewards, override bounds and locked/unlocked map display. Actual stage completion/claim/unlock persistence after reload, 100 distinct authored boss behaviors, final stage, and story scenes are not fully tested/implemented as a polished campaign. Generated labels/descriptions are templates, not 100 authored stories. |
| Campaign story | No authored 10-stage story arc with animated image scenes was found in the reviewed feature path | **Missing/deferred.** Admin boss reveal image field is not a story-scene system. |
| Friends co-op | No online room/session, matchmaking, authoritative shared game state, reconnect, invite acceptance, or two-player shared tower simulation found | **Missing/deferred.** User explicitly wants co-op treated as the multiplayer feature; there is no separate multiplayer mode. |
| Versus arena | No paired player-versus-player match service found | **Missing/deferred.** Current Arena is a solo difficulty mode. |

## Economy, progression, shop, and rewards

- Currencies in the save are coins, gems, and skill points; there are hero XP and tower XP progress tracks. Coins buy eligible blades/wall skins/heroes; gems are used for configured VIP tiers; skill points buy skill ranks. Daily, mission, achievement, badge/rank, campaign, boss, and match reward code can grant currencies or XP.
- Local save sanitization and client caps remain (`src/game/save.ts`), but cloud wallet/catalog ownership has server-side validation (`server/validation.ts`, `profile.ts`, `items.ts`). Save sync uses a server revision/ETag compare-and-swap. Buy/equip/unequip/sell/VIP/skill actions operate against the server cloud save and return updated save/revision.
- A focused API test covers buying a catalogue item, equipping, then reloading a cloud profile with owned/equipped state. It uses mocked collections; it is not a production Atlas browser session.
- Daily, mission, and achievement claims call `creditClaimReward`, which atomically updates wallet balances and a one-time `claimReceipts` marker on one `cloud_saves` document using conditional `findOneAndUpdate`. Parallel-claim mock tests prove one wallet credit. The related progress record in `daily_bonus`, `missions`, or `achievements` is a separate document and may be updated separately. Therefore this is not a cross-document Mongo transaction; a later progress-row failure can make the request/reporting state inconsistent even though the receipt prevents a second wallet credit.
- Leaderboard run issuance requires an authenticated user and stores a 15-minute token hash. Score submission requires and consumes an unexpired, matching-user/mode token once. The server bounds score/wave/counters/rewards and credits bounded reward estimates. The client still supplies score/counters/reward claims; there is no server-side replay/simulation of the match. A token is an anti-anonymous/replay foundation, **not proof a submitted score was earned**.
- `profile/sync` rejects missing/stale revision, invalid fields, and forged/unrecognized item ownership. It preserves server-owned save fields. Local validators/test coverage support this. No live race/concurrent-device test was conducted.
- Campaign rewards exist in generated data; admin customization has validation limits. There is no evidence here of full economic balance across 100 levels or long Horde sessions. No economy simulation report exists.

## Content inventory and completeness

| Content | Declared/default count | Evidence and caveats |
|---|---:|---|
| Missions | 50 | Test `production content ships 50 missions, 50 achievements and 20 badges`; count is in source defaults. It does not mean all are unique, balanced, displayed correctly, live-seeded into Atlas, or individually claim-tested. |
| Achievements | 50 | Same source/default test; full per-achievement play validation not done. |
| Badges | 20 | Same source/default test; Atlas `badges` count is player progress rows, not catalogue count. |
| Campaign stages/bosses | 100 generated fallback roster entries; admin allows up to 100 overrides | Generated names/difficulty/rewards and wave schedule unit-tested. Most are procedural templates, not 100 hand-authored sprite/behavior encounters. |
| Shop slicers | Default catalogue in `src/game/slicers.ts`, optionally admin-configured | Catalogue shape and filter tests exist. Exact production catalogue completeness and every blade preview image on physical phone not verified. |
| Enemies/waves | Default definitions plus admin configuration/creator tooling | The editor/config structures exist. Complete balance/asset coverage for every enemy-wave combination not verified. |
| Badges/ranks/social feed content | Ranks configurable; no forum content model | Forum threads/posts/reactions/moderation are absent. |

## Authentication, Steam, privacy, and account flow

- Email register/login uses scrypt password hashing and hashed random session tokens (`server/auth.ts`, `server/routes/auth.ts`). Sessions have expiry. Email verification codes are stored hashed; production response does not include a preview code, and production email failures do not log code content (tests present).
- Auth API routes: `GET /api/auth/me`; `POST /logout`, `/register`, `/login`, `/verify-email`, `/resend-verify`, `/set-email`, `/complete-profile`.
- Steam API routes: `GET /api/steam/login`, `/callback`, `/status`; `POST /link` is intentionally disabled for manual IDs and instructs the user to use OpenID. Real Steam OpenID and API secrets/redirect configuration were not tested.
- Auth helper accepts bearer header, body token, and query-string token. Query/body token support is a security/operational risk to review because URLs can be recorded in history/logs; user-facing clients should prefer Authorization headers. This audit did not trace every caller.
- Account privacy controls, account deletion/export, password reset, recovery, 2FA, block/report flows, and moderation workflows were not found in the enumerated routes and remain missing or unverified.
- Production CORS must set `CORS_ORIGINS`; absent configuration the code falls back to localhost origin. This is not evidence that Vercel environment values are correctly configured.

## Social and community features

| Feature | Current source behavior | State |
|---|---|---|
| Public profile lookup | `GET /api/social/profiles/:username`; public username/nickname/avatar/hero/scores/rank/wave/matches/badges; excludes email/userId | Implemented; mock route tests; no live usage verified. |
| Friend list/request/respond | `GET /friends`, `POST /friends/request`, `POST /friends/respond`; usernames identify users; accepted relationship records are bidirectional | Implemented; mock route tests. No block/mute/report or rate-limited per-user quotas were verified. |
| Direct messages | `GET/POST /messages/:username`; accepted friends only; 1,000-character message bound | Implemented; mock route tests; Atlas `messages` count is 0. No unread/read receipts, delivery guarantees, moderation, abuse tooling, or live two-account check. |
| Notifications | `GET /notifications`, `POST /notifications/read`; friend/message event notifications | Implemented; mock route tests; Atlas `notifications` count is 0. Push notification delivery is absent. |
| Community forum | Threads, replies, reactions, categories, search, moderation | **Missing.** |
| Online multiplayer/co-op | Lobby/session/matchmaking/shared simulation | **Missing.** Local Co-op label is guest assist only. |

## Admin and creator tooling

`index.html` contains a large admin/creator panel, wired through `src/ui/admin.ts`, `adminCatalog.ts`, `adminMediaStudio.ts`, `adminSprites.ts`, `creatorSlicerVfx.ts`, `creatorWaveBoard.ts`, live-config services, and `server/routes/admin.ts`.

**Configuration fields/routes present:** public `GET /api/admin/config`; `POST /verify`; protected `POST /config`; protected `POST /reset-daily`; protected `GET /leaderboard`; protected `POST /leaderboard/delete`. The config can include menu text/theme/background/logo/favicon, daily rewards, VIP tiers, gameplay knobs, missions, achievements, badges, ranks, slicers, enemies, waves, and up to 100 campaign boss override records/reveal art.

**Limitations and risks:**

- Admin authorization is based on the configured `ADMIN_STEAM_ID` matching a resolved signed-in Steam user. That credential/configuration was not inspected in Vercel, and an email-only account is not sufficient by itself.
- Boss reveal images are constrained to optimized WebP data URLs under 30 KB in the API validation shown. This is narrower than “upload any PNG and save it”; browser conversion/preview behavior needs a live test.
- The config GET catches database errors and returns HTTP 200 with `success: true, offline: true` and defaults. A UI that ignores `offline` can display defaults as if a save/read succeeded. This is misleading success semantics and should be corrected/handled.
- `getDb()` wraps every `createIndex` in one try/catch. If one index creation fails, subsequent declarations in that block are skipped, while server startup continues. Atlas key metadata currently shows all declared index keys, but unique/TTL options were not visible in the connector, so those guarantees were not verified on the live cluster.
- Admin catalog live preview code exists, but the requirement that every edit immediately previews exactly what players see after save/reload is **not end-to-end proven**. No physical mobile admin usability check was run. The panel is still a large modal/content surface rather than a separately verified admin application page.
- Admin controls exist only for fields wired into these schemas; this does not make every icon, button, story, art slot, text, sound, or future asset editable. There is no exhaustive control-to-runtime test matrix.

## MongoDB Atlas: source comparison

Read-only connection reached Atlas org `Airijus’s Org - 2026-05-27`, project `FruitTD`, cluster `Cluster0` (MongoDB 8.0.32, AWS EU_WEST_1, FREE tier; Atlas state reported `IDLE`). Database observed: `FruitTD`, approximately 1.34 MB. The database name matches `server/db.ts`, which hardcodes `client.db('FruitTD')`.

**Configuration mismatch:** `.env.example` documents `MONGODB_DB=fruit-td`, but `server/db.ts` ignores `MONGODB_DB` and hardcodes `FruitTD`. The live name happens to match the code; the example is misleading and should be aligned.

| Collection | Atlas document count | Code usage / declared indexes | Interpretation |
|---|---:|---|---|
| `leaderboards` | 1 | `leaderboard.ts`; `{mode:1,score:-1}`, `{userId:1,mode:1}` | One score row observed; no broad usage conclusion. |
| `notifications` | 0 | `social.ts`; `{userId:1,createdAt:-1}`, unique `{notificationId:1}` | Collection exists; new feature has no stored notification rows at observation. |
| `admin_config` | 1 | `admin.ts`; unique `{configKey:1}` | Config document exists; its values/secrets were not included in this report. |
| `achievements` | 32 | achievements route; unique `{userId:1,achievementId:1}` | Player progress docs, not number of achievement definitions. |
| `friends` | 0 | social route; unique `{userId:1,friendId:1}`, state/time indexes | Collection exists; no stored relationship docs observed. |
| `users` | 4 | auth/social/profile; unique `userId`, sparse unique `email`, `username`, `steamId` | Four user docs; no personally identifying values disclosed. |
| `sessions` | 7 | auth; unique `tokenHash`, TTL `expiresAt` | Seven docs observed; actual TTL option not verifiable from available index metadata. |
| `badges` | 7 | badges route; unique `{userId:1,badgeId:1}` | Player badge progress docs, not catalogue size. |
| `run_tokens` | 1 | leaderboard; unique `tokenHash`, TTL `expiresAt` | One token document observed; consumed/expiry status not reported. |
| `cloud_saves` | 4 | profile/items/claims; unique `userId` | Four cloud-save docs. No wallet balances or personal data disclosed. |
| `daily_bonus` | 2 | daily claims; unique `userId` | Two daily claim records. |
| `missions` | 50 | missions route; unique `{userId:1,missionId:1,dayKey:1}` | Progress documents, not proof all 50 default missions are configured/live. |
| `messages` | 0 | social route; `{conversationId:1,createdAt:1}`, unique `messageId` | Collection exists; no stored messages observed. |

All 13 collection names used by source were present in Atlas. Atlas reported the expected index **key names** for the declarations above. The connector did not show index option metadata; thus `unique`, `sparse`, and `expireAfterSeconds` are **code-declared but live-option-unverified**. No collection validators/schema validation rules were confirmed. Presence/counts do not prove successful writes, indexes enforcing constraints, indexes being optimal, or player flows working.

The local automated test environment had no `MONGODB_URI` set and announced mock/fallback mode. The Atlas metadata connection was separate/read-only; this audit did **not** verify that the local/Vercel runtime credentials point to that same cluster or run the API test suite against real Atlas.

## API surface inventory

All API routes are mounted in `server/app.ts`. Authentication requirements below summarize route behavior; some read endpoints intentionally allow anonymous access. Relevant tests are mostly mock-collection tests, not live Atlas integration tests.

| Route | Functions | Auth / current behavior | Coverage / caveat |
|---|---|---|---|
| `/api/health` | `GET` | Mongo ping | Not an availability/deployment monitor test here. |
| `/api/auth` | `GET /me`; `POST /logout`, `/register`, `/login`, `/verify-email`, `/resend-verify`, `/set-email`, `/complete-profile` | Session-based account operations | Auth tests cover registration UI and code leak guard; no full production email/Steam/account recovery path. |
| `/api/steam` | `GET /login`, `/callback`, `/status`; `POST /link` | OpenID; manual linking disabled | External Steam exchange not tested. |
| `/api/profile` | `GET /`; `POST /sync` | Signed-in cloud save read/sync; revision/schema/server-owned-field validation | API mocks prove stale/missing revision and forged ownership rejection. |
| `/api/items` | `POST /action` | Signed-in server-owned buy/equip/unequip/sell/VIP/skill mutation | Mock test covers purchase/equip/reload; not all action combinations against live database. |
| `/api/daily` | `GET /`; `POST /claim` | Authenticated daily status/claim; wallet receipt credit | Concurrent mocks pass; progress record + wallet are separate documents. |
| `/api/missions` | `GET /`; `POST /progress`; `POST /claim` | Authenticated mission progress and claim | Concurrent claim mocks pass; gameplay event trust/source and real DB flow not fully verified. |
| `/api/achievements` | `GET /`; `POST /progress`; `POST /claim` | Authenticated progress and claim | Concurrent claim mocks pass; client-reported progress should not be mistaken for authoritative simulation. |
| `/api/badges` | `GET /`; `POST /progress`; `POST /claim` | Authenticated progress/unlock/claim | No full badge-by-badge gameplay validation; claim behavior not covered with real Mongo. |
| `/api/leaderboard` | `POST /run`; `GET /monthly-rank`; `POST /monthly-rank/claim`; `GET /`; `POST /` | Run token for submission; score bounds; rank reward receipt | No-token rejection and token consumption are mocked/tested. Submitted match score still client-originated and not simulated server-side. |
| `/api/admin` | `GET /config`; `POST /verify`, `/config`, `/reset-daily`, `/leaderboard/delete`; `GET /leaderboard` | Config read public; mutations/admin data require configured Steam admin | Config read fallback returns success+offline on failure; admin functions not all live-tested. |
| `/api/social` | `GET /profiles/:username`, `/friends`, `/notifications`, `/messages/:username`; `POST /friends/request`, `/friends/respond`, `/notifications/read`, `/messages/:username` | Signed-in; message send/receive limited to accepted friends | Mock tests cover auth/privacy and friendship gating. No forum, push, abuse/report/moderation. |

Rate limits are applied in `server/app.ts` to auth, leaderboard, daily, items, admin, and social. Achievements, missions, badges, profile, and Steam do not use this route-level rate limiter in that file. This is an observed application-level distinction; any Vercel/WAF limits were not checked.

## Notifications, messages, and user-facing feedback

- In-game feedback includes score floats, combo/HUD effects, game pause/game-over surfaces, daily/auth modals, and shared UI notification/toast primitives (`src/ui/components/surface.ts`, `primitives.ts`).
- Social notifications and direct messages are database-backed API features, but Atlas row counts for these new collections were zero at audit time, so use in production was not demonstrated.
- Push/browser notifications, reliable offline inbox synchronization, read receipts, message moderation, user block/report, and community moderation tools were not found as working features.
- Browser-native warning/confirm replacements cannot be declared complete from this audit. The app has themed modal/toast infrastructure, but no exhaustive search/interaction proof for every alert/confirm path was done.

## Icons, visual design, scroll, and mobile claims

- Lucide is a dependency and active controls frequently use `data-lucide` plus `src/ui/lucideIcon.ts`. The repo still contains legacy markup, Unicode characters, illustrations, and text glyphs; a repository-wide guarantee that every visual symbol everywhere is Lucide was **not** established. “Lucide only across every page” is therefore not certified.
- Deep green/lime/amber styling, clipped/paneled game UI, shared surface/modal components, and custom scroll CSS exist. The presence of CSS does not establish that every scroll container behaves well in Safari or that there are no white/browser-native surfaces in all states.
- Mobile CSS explicitly repositions the juice meter horizontally below player identity at widths up to 600px. Tower HP is represented as a world-space rail attached at the wall foot. The tests validate calculations/visibility rules, not the exact screenshot layout requested by the user.
- No real iPhone screenshot capture, iOS Safari interaction test, Android Chrome test, landscape test, safe-area check, keyboard/screen reader audit, or touch-target measurement was run in this audit. Prior user screenshots document real issues in the deployed version at that time; they are not evidence that the current production deployment has changed.

## Test and build evidence

### Automated test run

Command: `npm test`  
Observed summary: **310 tests, 310 passed, 0 failed, 0 cancelled, 0 skipped**. Duration: about 2.0 seconds.

Relevant categories represented include API route/auth/economy/claim tests with mocks; save validation/revision; catalogue/items; social privacy/friend gating; campaign generation/map rendering; navigation/registry; combat/special enemies/rewards; input synthetic desktop/touch strokes; theme/UI primitives; creator tooling; and wall presentation.

During test startup, environment output stated `MONGODB_URI not found` and local/mock mode. One admin config route test intentionally triggered/logged the expected missing-URI exception path and still passed. This is not a live database integration test.

### Build

`npm run build`: passed; details and generated bundle sizes are recorded at the end of this file.

No browser E2E, live account flow, live Atlas write/claim flow, production Vercel smoke, mobile device test, long session stability test, or performance profile was run.

## Historical claims and stale evidence

- Earlier handoff/audit Markdown files include assertions that predate the current code. In particular, statements that client-truth economy, missing registration, missing pointer input, or absent social UI are still current must be re-checked against source and the evidence above; they are not automatically true today.
- `README.md` and phase/handoff documents should not be treated as a live audit. Some describe older economy/social/campaign status. This document is the dated snapshot for the reviewed commit and is not a substitute for checking the currently deployed commit.
- The Vercel log excerpts previously supplied by the user contained `level: "info"` records with HTTP 200/304 and dotenv informational messages. Those pasted lines were not error-level failures. No live Vercel log connection or new production log query was performed here.
- A commit existing locally or in a GitHub tool result does not prove Vercel deployed it, that the build succeeded there, or that the user is seeing the same commit. Deployment status was not queried in this audit.

## Confirmed problems / production blockers / open verification

| Priority | Issue | Why it matters / evidence | Status |
|---|---|---|---|
| P0 | No server-side match simulation | Run token is a short-lived single-use gate, but score/wave/rewards are supplied by the client within caps. A malicious signed-in client can still submit fabricated bounded performance. | Confirmed architectural limitation. |
| P0 | Online Co-op is not implemented | Current Co-op rule is local guest assist. No online lobby, invites, shared authoritative state, reconnection, or second player is implemented. | Confirmed missing feature. |
| P0 | Production readiness and “bug-free” claim unsupported | No live production smoke, actual phone test, full campaign play-through, or game stability soak was run. | Confirmed evidence gap. |
| P1 | Campaign is not a fully authored/verified 100-stage product | Generated fallback bosses use templated descriptions; tests check generated data/UI, not full win/unlock/reload/story journey. | Partial implementation. |
| P1 | Claim state spans documents | Wallet + receipt are atomic on `cloud_saves`; separate progress state is updated independently, not inside the same transaction. | Confirmed consistency risk. |
| P1 | Admin config GET masks DB failure as success | Catch path responds HTTP 200 and `success:true, offline:true`. Client handling must honor `offline`; logs can understate failures. | Confirmed code behavior. |
| P1 | Index creation is one catch-all sequence | One index error prevents all later index creation calls in that initialization attempt. Live key names exist, but option flags were not visible. | Confirmed reliability risk; no active failure proven. |
| P1 | Admin panel is not proven usable on phone | Large modal/editor surfaces; no device/responsive QA. Live preview requirement not comprehensively tested. | Unverified. |
| P1 | Blank menu screen report not closed by this audit | Unit tests cover the shared hub host and social import fallback, but no actual production/mobile reproduction was run. | Still needs browser/device verification. |
| P1 | `.env.example` Mongo DB variable mismatch | Example names `fruit-td`; server ignores it and uses `FruitTD`. | Confirmed documentation/config mismatch. |
| P1 | Auth accepts tokens in query/body | Non-header token paths can expose session tokens to history/logging or accidental payload capture. | Confirmed code path; usage impact not traced. |
| P2 | Ranked/Arena naming suggests more than exists | Ranked is ladder-only, Arena solo. | Confirmed product/UI clarity issue. |
| P2 | Forum/community posting absent | Social features are friends/profile/messages/notifications only. | Confirmed missing feature. |
| P2 | Notifications are in-app only | No push delivery proven. Atlas `notifications` empty. | Confirmed current limitation. |
| P2 | “Lucide only” is not globally proven | Library/use exists, but legacy decorations/text glyphs remain. | Audit gap and likely cleanup. |
| P2 | Menu legacy markup remains | Active routing tests make old controls inert/hidden; old dashboard markup is still in `index.html`. | Confirmed incomplete cleanup. |
| P2 | User-reported combat HUD layout needs device verification | CSS places phone juice horizontally and world wall HP below wall; prior screenshots show earlier deployed display issues. Current deployed version unknown. | Not certified fixed on real phone. |
| P2 | Automated suite is fast and mock-heavy | 310 green tests provide meaningful logic coverage, but no live DB, browser/device, performance, or full-feature E2E layer. | Confirmed verification scope. |

## Full source file inventory in review scope

There are **174 files** under `src/`, `server/`, and `api/` (including tests and the fruit atlas asset). The list below is the complete path inventory at the reviewed tree; each file is a source/build/test surface included in the audit scope, not a promise that every function has a dedicated test.

```text
api/[...path].js
api/entry.ts
server/admin.routes.test.ts
server/app.ts
server/auth.test.ts
server/auth.ts
server/catalog.ts
server/claimWallet.ts
server/claims.atomic.test.ts
server/db.ts
server/economy.actions.test.ts
server/economy.authority.test.ts
server/economy.settlement.test.ts
server/economy.test.ts
server/emailTemplates.ts
server/index.ts
server/items.test.ts
server/rateLimit.ts
server/routes/achievements.ts
server/routes/admin.ts
server/routes/auth.ts
server/routes/badges.ts
server/routes/daily.ts
server/routes/items.ts
server/routes/leaderboard.ts
server/routes/missions.ts
server/routes/profile.ts
server/routes/social.ts
server/routes/steam.ts
server/social.routes.test.ts
server/steam.ts
server/username.ts
server/validation.ts
src/assets/fruit-atlas.jpg
src/audio/sfx.ts
src/engine/loop.ts
src/engine/renderer.ts
src/game/adminTextureLoader.ts
src/game/atlas.ts
src/game/campaign.test.ts
src/game/campaign.ts
src/game/catalog.test.ts
src/game/catalog.ts
src/game/combatDiagnostics.ts
src/game/combatPhase3.test.ts
src/game/combatPolish.test.ts
src/game/creatorVfx.test.ts
src/game/creatorVfx.ts
src/game/creatorWaves.test.ts
src/game/creatorWaves.ts
src/game/enemies.ts
src/game/field.ts
src/game/fruits.ts
src/game/heroPerkSave.ts
src/game/heroProgression.ts
src/game/heroes.ts
src/game/juice.ts
src/game/modes.ts
src/game/navigation.test.ts
src/game/navigation.ts
src/game/progression.extra.test.ts
src/game/progression.test.ts
src/game/progression/combo.ts
src/game/progression/heroEconomy.ts
src/game/progression/heroMilestones.ts
src/game/progression/heroStatus.ts
src/game/progression/index.ts
src/game/progression/modifiers.ts
src/game/progression/progression.phase1.test.ts
src/game/progression/rewards.ts
src/game/requirements.catalog.test.ts
src/game/requirements.ts
src/game/save.test.ts
src/game/save.ts
src/game/save.validation.test.ts
src/game/skills.ts
src/game/slicer.ts
src/game/slicers.ts
src/game/slashfx.ts
src/game/state.ts
src/game/strokeContacts.ts
src/game/studioRuntime.test.ts
src/game/studioRuntime.ts
src/game/studioRuntimeSignals.test.ts
src/game/studioRuntimeSignals.ts
src/game/studioSoundBank.ts
src/game/towerMilestones.ts
src/game/towerProgression.ts
src/game/trail.ts
src/game/turrets.ts
src/game/vipBonuses.ts
src/game/wallPresentation.test.ts
src/game/wall.ts
src/game/waves.ts
src/game/world.ts
src/input/blade.integration.test.ts
src/input/blade.ts
src/main.ts
src/services/achievements.ts
src/services/admin.ts
src/services/api.ts
src/services/auth.ts
src/services/badges.ts
src/services/liveConfig.ts
src/services/missions.ts
src/services/progress.ts
src/services/social.ts
src/services/steam.ts
src/style.css
src/ui/README.md
src/ui/admin.ts
src/ui/adminCatalog.ts
src/ui/adminMediaStudio.test.ts
src/ui/adminMediaStudio.ts
src/ui/adminSprites.ts
src/ui/authModal.test.ts
src/ui/authModal.ts
src/ui/combos.ts
src/ui/components/dom.ts
src/ui/components/primitives.ts
src/ui/components/surface.ts
src/ui/components/ui.test.ts
src/ui/creatorSlicerVfx.ts
src/ui/creatorWaveBoard.ts
src/ui/design/designMode.ts
src/ui/design/screenPreviews.ts
src/ui/design/themeEditor.ts
src/ui/design/themePreview.ts
src/ui/domStub.test-helper.ts
src/ui/floatingScore.ts
src/ui/gameFeel.css
src/ui/hud.ts
src/ui/hudToggle.ts
src/ui/lucideIcon.ts
src/ui/menuParallax.ts
src/ui/screens/campaign.css
src/ui/screens/campaign.test.ts
src/ui/screens/campaign.ts
src/ui/screens/heroes.ts
src/ui/screens/hub.css
src/ui/screens/hub.test.ts
src/ui/screens/hub.ts
src/ui/screens/hubTabs.ts
src/ui/screens/index.ts
src/ui/screens/inventory.ts
src/ui/screens/itemCard.ts
src/ui/screens/legacyMenu.test.ts
src/ui/screens/legacyMenu.ts
src/ui/screens/mainMenu.ts
src/ui/screens/news.ts
src/ui/screens/profile.ts
src/ui/screens/registry.test.ts
src/ui/screens/registry.ts
src/ui/screens/render.test.ts
src/ui/screens/screens.css
src/ui/screens/settings.ts
src/ui/screens/shell.ts
src/ui/screens/shop.ts
src/ui/screens/social.css
src/ui/screens/social.ts
src/ui/slicerPreview.ts
src/ui/theme/cssVars.ts
src/ui/theme/defaultTheme.ts
src/ui/theme/index.ts
src/ui/theme/layout.ts
src/ui/theme/presets.ts
src/ui/theme/theme.css
src/ui/theme/theme.test.ts
src/ui/theme/themeAssets.ts
src/ui/theme/themeStore.ts
src/ui/theme/types.ts
src/ui/theme/validate.ts
src/ui/towerChip.ts
src/vite-env.d.ts
```

## Build result

`npm run build` passed: TypeScript `tsc --noEmit`, Vite production build (2,187 modules transformed), and API bundle (`api/[...path].js`, 155.4 kB). Main JavaScript bundle: 497.95 kB (147.50 kB gzip); Three.js vendor chunk: 498.53 kB (125.36 kB gzip); lazily loaded social JavaScript: 10.19 kB (3.44 kB gzip); CSS: 240.05 kB combined (47.10 kB gzip); built `index.html`: 103.55 kB (20.23 kB gzip). Build completed without a Vite chunk-size warning. A non-fatal npm environment warning reported unknown `http-proxy` configuration.

## Callable symbol index

Generated from the reviewed TypeScript source with the TypeScript parser: **1153 named callable/class symbols** across 128 non-test TypeScript files. Includes named function declarations, named function-valued declarations, class names and methods/accessors. Anonymous inline callbacks and HTML event handlers have no stable symbol name; they are inventoried under the route or UI module that owns them.

- `api/entry.ts`: normalizeApiUrl(), handler()
- `server/app.ts`: createApp()
- `server/auth.ts`: hashPassword(), verifyPassword(), makeVerifyCode(), hashToken(), makeSessionToken(), requestSessionToken(), createSession(), resolveSession(), resolveRequestUser(), destroySession(), publicUser(), isValidEmail(), deliverVerifyCode(), fallback()
- `server/catalog.ts`: invalidateCatalogCache(), loadQuestCatalog(), getMonthKey()
- `server/claimWallet.ts`: creditClaimReward(), cappedCredit()
- `server/db.ts`: getDb(), getCollection(), closeDb()
- `server/emailTemplates.ts`: verifyEmailHtml(), verifyEmailText()
- `server/index.ts`: start()
- `server/rateLimit.ts`: rateLimit()
- `server/routes/achievements.ts`: createAchievementsRouter()
- `server/routes/admin.ts`: normalizeDailyRewards(), normalizePrizeCatalog(), normalizeMenuConfig(), text(), asset(), normalizeGameplayConfig(), num(), isAuthorized()
- `server/routes/auth.ts`: bearer(), unlockSteamAchievement()
- `server/routes/daily.ts`: getActiveDailyRewards(), withVipDailyBonus(), getDayKey(), createDailyRouter()
- `server/routes/items.ts`: serverRevision(), isSlicer(), createItemsRouter()
- `server/routes/leaderboard.ts`: resolveMode(), createLeaderboardRouter(), upsertBest()
- `server/routes/missions.ts`: getDayKey(), getWeekKey(), periodKey(), createMissionsRouter()
- `server/routes/profile.ts`: etag(), serverRevision(), createProfileRouter()
- `server/routes/social.ts`: fail(), safeName(), pairKey(), byUsername(), notify(), createSocialRouter()
- `server/routes/steam.ts`: frontendOrigin(), apiCallbackOrigin(), verifySteamOpenId(), fail()
- `server/steam.ts`: resolveSteamId(), fetchSteamPlayerSummary()
- `server/username.ts`: sanitizeSteamUsername(), validateUsername()
- `server/validation.ts`: safeInput(), validId(), boundedInteger(), sameJsonValue(), serverOwnedSaveError(), saveValidationError(), validProgressUpdates()
- `src/audio/sfx.ts`: fileKey(), names(), class Sfx, ensure(), unlock(), loadStudioSoundBank(), decodeDataUrl(), preload(), decode(), pick(), play(), playBank(), playStudioSlot(), startLoop(), stopLoop(), stopAllLoops(), gameStart(), gameOver(), pause(), unpause(), swipe(), slice(), combo(), armorHit(), bossHit(), bombExplode(), bombParry(), enemyWarning(), bombFuse(), throwFruit(), throwBomb(), leak(), drip(), blitzStart(), blitzEnd(), freeze(), boost(), stopBoost(), fire(), place(), scrap(), select(), denied(), unlockItem(), cursorMove(), rotate(), toast(), wave(), extraLife(), bestScore(), dangerTick(), timeUp(), shopHover(), toggleMute()
- `src/engine/loop.ts`: class GameLoop, start(), impactFrame(), stop(), tick()
- `src/engine/renderer.ts`: arenaFrustum(), class GameRenderer, resize(), pan(), zoom(), pulseLight(), impulseShake(), update(), render()
- `src/game/adminTextureLoader.ts`: getAdminTexture(), clearAdminTextureCache(), refreshAdminTexture()
- `src/game/atlas.ts`: class FruitAtlas, load(), tile(), isValidTile(), getDimensions()
- `src/game/campaign.ts`: campaignWaves(), defaultCampaignBoss(), campaignBoss(), sanitizeCampaignProgress()
- `src/game/catalog.ts`: isStarterItem(), rarityRank(), hexFromNumber(), slicerStats(), slicerToItem(), wallToItem(), heroToItem(), dedupeCatalogItems(), allCatalogItems(), findCatalogItem(), ownsItem(), isEquipped(), shopItems(), inventoryItems(), categoriesWithItems(), canSellItem()
- `src/game/combatDiagnostics.ts`: installCombatDiagnostics()
- `src/game/creatorVfx.ts`: clamp(), asStr(), asNum(), defaultPresets(), emptyCreatorVfxStore(), normalizePreset(), normalizeHex(), normalizeBinds(), normalizeSlicerPack(), normalizeCreatorVfxStore(), loadCreatorVfxStore(), saveCreatorVfxStore(), ensureSlicerPack(), applySlicerPackOverrides(), mergeSlicerPacksIntoCatalog(), storeSignature(), refreshCache(), invalidateCreatorVfxCache(), setCreatorVfxCallbacks(), getCreatorVfxCallbacks(), findPreset(), resolveSlicerBind(), fireCreatorSlicerVfx(), previewVfxPayload(), newPresetId()
- `src/game/creatorWaves.ts`: setLiveWavesConfig(), getLiveWavesConfig(), asFruit(), asEnemy(), asNum(), defaultWavesCount(), emptySpawnRow(), emptyWave(), ensureAuthoredLevel(), normalizeSpawn(), normalizeWave(), normalizeCreatorWavesStore(), emptyCreatorWavesStore(), loadCreatorWavesStore(), saveCreatorWavesStore(), previewSummary(), expandSpawns(), resolveAuthoredLevel(), authoredWavesPerLevel(), proceduralGapHp(), authoredWaveToPlan(), tryAuthoredPlanWave(), tryAuthoredPlanBossWave(), storeToAdminWaves()
- `src/game/enemies.ts`: enemyRule(), specialEnemyForWave(), specialFruitKind(), enemyReward(), enemyXpReward(), dangerousLeakMultiplier()
- `src/game/field.ts`: class Field
- `src/game/fruits.ts`: fruitFamily(), layoutHp(), makeFruit(), paintStatic(), paint(), applyStudioTexture(), class FruitField, aliveCount [get], queueLength [get], waveBusy [get], reset(), beginWave(), spawn(), hurt(), kill(), spawnSplitChildren(), flushSplitChildren(), update(), dodgeSlash()
- `src/game/heroPerkSave.ts`: loadHeroPerks(), heroPerkRank(), heroCombatPerkMultiplier(), canUpgradeHeroPerk(), upgradeHeroPerk(), getAvailableHeroPerkPoints()
- `src/game/heroProgression.ts`: availableHeroPerks(), heroPerkRank(), setHeroPerkValue(), heroPerkMultiplier(), heroMasteryReward(), heroLevelReward()
- `src/game/heroes.ts`: heroDef(), heroXpForLevel(), heroXpToLevel(), xpForNext(), heroXpProgress(), heroUnlockLevel(), heroRequiresPurchase(), heroStatMultiplier(), heroEffectiveLevel(), heroSlashDamage(), heroHitRadius()
- `src/game/juice.ts`: classifyJuice(), juiceHueFromKind(), class JuiceBank, reset(), add(), take(), deposit(), class JuiceSystem, reset(), burst(), floorSplash(), suckToward(), update(), commit()
- `src/game/modes.ts`: modeRules()
- `src/game/navigation.ts`: class NavigationController, state [get], breadcrumb [get], depth [get], onChange(), addGuard(), allowed(), commit(), setState(), open(), close(), back(), fallbackFor(), home(), isOverlay(), canGoBack(), isPlaying(), isPaused(), isInGame(), canInteract(), isMenu(), reset(), installHistoryIntegration(), syncHistory(), onPopState()
- `src/game/progression/combo.ts`: comboMultiplier(), comboTierAt(), comboTiersBetween(), isComboResetReason()
- `src/game/progression/heroEconomy.ts`: heroPrice(), setHeroPrice()
- `src/game/progression/heroMilestones.ts`: heroMilestoneAt(), heroMilestonesUnlocked(), nextHeroMilestone(), heroMilestonesBetween(), heroesUnlockedByJijuLevel(), isHeroMastered(), heroMilestonePerkPoints()
- `src/game/progression/heroStatus.ts`: jijuLevel(), getHeroStatus(), getAllHeroStatuses(), canEquipHero(), purchaseHeroAtomic()
- `src/game/progression/index.ts`: emptyResult(), perkPointsFromLevel(), applyRewards(), getHeroXpState(), heroMilestoneUnlockLevel()
- `src/game/progression/modifiers.ts`: currentRewardModifiers()
- `src/game/progression/rewards.ts`: defaultModifiers(), clampNonNegative(), calculateReward(), addRewards(), isEmptyReward()
- `src/game/requirements.ts`: requirementById(), requirementsByCategory(), currentMonthKey(), monthlyLeaderboardMode(), rankFromScore(), rankThreshold(), mergeRewardDefaults(), req(), matchRequirement(), newCatalogId()
- `src/game/save.ts`: emptyXp(), emptyPerkRanks(), safeInt(), uniqueStrings(), defaultAvatar(), defaultSave(), sanitiseSave(), unequipped(), syncHeroUnlocks(), isHeroOwned(), heroUnlockRequirement(), heroPurchaseCost(), canPurchaseHero(), purchaseHero(), migrateOldPerks(), loadSave(), getSaveEpoch(), writeSave(), mergeSaves(), authoritative(), heroLevelFromSave(), canBuySkill()
- `src/game/skills.ts`: emptySkills(), skillRank()
- `src/game/slashfx.ts`: class SlashFx, spawn(), update(), reset()
- `src/game/slicer.ts`: makeHalf(), deformHalf(), class SliceDebris, reset(), spawnPair(), reslice(), spawnBits(), update(), segmentHitsFruit(), strokeHitsFruit(), segmentHitsHalf(), strokeHitsHalf()
- `src/game/slicers.ts`: hexToNumber(), newSlicerId(), createEmptySlicer(), findSlicer()
- `src/game/state.ts`: createState(), resetState(), leakCost(), damageTower(), resetCombo(), isPerfectWave(), recordWaveKill(), consumeBossWaveCompletion(), awardPerfectWave(), addScore(), chargeSuper(), toast()
- `src/game/strokeContacts.ts`: class StrokeContacts, begin(), has(), add(), canReslice(), missed(), reset()
- `src/game/studioRuntime.ts`: heroIdToStudioKey(), bossStudioCandidates(), bossStudioKey(), setStudioFxCallbacks(), enemyKindToStudioKey(), resolveFruitStudioKey(), directionFromVelocity(), advanceFrameCursor(), storeSignature(), refreshStoreCache(), invalidateStudioRuntimeCache(), getStudioEntityData(), getStudioEntity(), hasStudioWalkClip(), hasStudioPlaybackClip(), sampleStudioTexture(), resolveClip(), clipFps(), ensureSheet(), frameTexture(), createStudioAnimForKey(), createStudioAnimState(), resetStudioAnimState(), resetStudioAnimForKey(), resolveStudioHook(), fireStudioEvent(), triggerStudioHit(), triggerStudioDeath(), triggerStudioSpawn(), updateStudioAnim(), clearStudioRuntimeTextures()
- `src/game/studioRuntimeSignals.ts`: subscribeStudioRuntimeInvalidation(), notifyStudioRuntimeChanged()
- `src/game/studioSoundBank.ts`: loadSoundBank(), saveSoundBank()
- `src/game/towerMilestones.ts`: towerMilestone(), towerUnlockedMilestones(), getTowerMilestoneBonuses()
- `src/game/towerProgression.ts`: defaultTowerProgression(), read(), write(), syncTowerProgression(), towerLevelFromXp(), towerXpForLevel(), towerXpToNextLevel(), getTowerProgression(), getTowerXpState(), grantTowerXp(), resetTowerProgression()
- `src/game/trail.ts`: class BladeTrail, applySlicer(), setColor(), sync(), update(), reset()
- `src/game/turrets.ts`: turretDef(), sellRefund(), canPlaceTurret(), turretRange(), class TurretRig, setOpen(), tick(), nearest()
- `src/game/vipBonuses.ts`: getOwnedVipTier(), vipCoinMultiplier(), vipXpMultiplier(), vipTierPrice(), vipTierPurchaseCoins()
- `src/game/wall.ts`: class WallBase, applyWallSkin(), applySkins(), refreshTowerTexture(), setHero(), refreshHeroTexture(), tickStudioSkins(), reset(), placeSlicer(), toggleSelected(), upgradeSelected(), startMove(), cancelMove(), moveTo(), sellSelected(), selectedSlot(), setTowerHealth(), damageFeedback(), select(), update(), makeHead(), resizeHead(), spawnShot(), refreshPads(), refreshRange()
- `src/game/waves.ts`: add(), mix(), planTitle(), overrideSources(), wavesPerLevel(), planWave(), planBossWave()
- `src/game/world.ts`: buildPads(), slotIndexAt(), slicerCost(), upgradeCost(), towerStats()
- `src/input/blade.ts`: class BladeInput, kind(), project(), queueSegment(), onDown(), onMove(), onUp(), consumeSlash(), consumeSlashes(), consumeClick(), consumeStrokeEnd(), diagnostics(), recordPointerEvent(), reset(), fadeTrail()
- `src/main.ts`: hideBootLoader(), emit(), resetCombo(), towerDamageBonus(), applyCloudSave(), equippedSlicer(), applyEquippedBlade(), persist(), setMode(), performSignedInCatalogueAction(), buySkin(), isUnequippedSkin(), equipItem(), unequipItem(), sellItem(), buyVIP(), wallSkinApply(), buySkill(), selectHero(), award(), announceProgression(), killFruit(), showGameOverOverlay(), submitCurrentRun(), maybeOver(), tryPlace(), tryUpgrade(), restart(), slashLines(), resolveSlash(), trySuper(), worldPct(), setPaused(), quitToMenu(), restartMatch(), showBossIntro(), tickGuest(), tryMove(), trySell(), kiPulse(), simulate(), draw(), launchMatch(), launchCampaign()
- `src/services/achievements.ts`: showAchievementToast(), initAchievementsCache(), applyAchievementUpdates(), reportAchievementProgress()
- `src/services/admin.ts`: mergeAdminConfig(), isUserAdmin(), getAdminHeaders(), fetchAdminConfig(), saveAdminConfig(), adminResetDailyStreak(), adminFetchLeaderboards(), adminDeleteScore(), adminWipeLeaderboardMode()
- `src/services/api.ts`: acceptClaimWallet(), getUserId(), apiRequest(), startLeaderboardRun(), submitScore(), adoptAuthoritativeSave(), fetchMonthlyRank(), claimMonthlyRank(), fetchLeaderboard(), fetchAchievements(), updateAchievementProgress(), claimAchievement(), fetchMissions(), updateMissionProgress(), claimMission(), fetchDailyBonusStatus(), claimDailyBonus(), linkSteam(), getSteamStatus(), fetchCloudSave(), syncCloudSave(), performCatalogueAction(), performWalletAction()
- `src/services/auth.ts`: getAuthToken(), setAuthToken(), isSessionAuthed(), setSessionAuthed(), getCachedAuthUser(), setCachedAuthUser(), authRequest(), fetchMe(), registerWithEmail(), loginWithEmail(), verifyEmailCode(), setEmailForConfirm(), resendVerifyCode(), completeProfile(), logoutAuth(), startSteamLogin(), applyAuthUserToLocalIds()
- `src/services/badges.ts`: apiJson(), fetchBadges(), claimBadge(), reportBadgeProgress()
- `src/services/liveConfig.ts`: escapeHtml(), getLiveConfig(), readLocalBranding(), writeLocalBranding(), applyFavicon(), applyMenuAppearance(), setLiveConfig(), loadLiveConfig(), getScoreMultiplier(), getSuperChargeMultiplier(), getStartMoneyScale(), getStartLivesScale(), getSlicers(), getEnabledSlicers()
- `src/services/missions.ts`: reportMissionEvent()
- `src/services/progress.ts`: enabledMissions(), enabledAchievements(), enabledBadges(), tiers(), reportGameEvent()
- `src/services/social.ts`: request()
- `src/services/steam.ts`: getCachedSteamState(), syncSaveFromUser(), syncSteamState(), linkSteamAccount(), consumeAuthCallbackParams()
- `src/ui/admin.ts`: class AdminController, checkAdminPrivileges(), open(), close(), initListeners(), renderTabs(), renderDesignTab(), loadConfig(), renderLiveStats(), renderCatalogEditors(), renderActiveTab(), renderVipEditor(), renderDailyEditor(), escapeAttr(), renderBrandingEditor(), refreshBrandingPreview(), renderEconomyEditor(), renderLeaderboardManager(), saveCurrentConfig(), readCampaignBossImage(), saveBossNames(), saveContent(), renderContentEditor(), previewCampaignBoss(), syncPreview(), wireUpload(), wireUrl(), set()
- `src/ui/adminCatalog.ts`: escapeAttr(), reqFields(), bindReq(), renderMissionEditor(), addMission(), renderAchievementEditor(), addAchievement(), renderBadgeEditor(), addBadge(), renderRankEditor(), addRank(), sliderField(), renderSlicerEditor(), bindText(), bindNum(), bindRange(), sync(), addSlicer()
- `src/ui/adminMediaStudio.ts`: clipKey(), allCoverageKeys(), entityLabel(), frameRect(), indexFromCell(), clipDefFromRange(), clipEndFrame(), clampClipRange(), defaultEventHook(), defaultEvents(), emptyEntityData(), normalizeClip(), normalizeEventHook(), normalizeEvents(), normalizeEntityData(), defaultStore(), migrateStoreToV2(), coverageForEntity(), coverageSummary(), loadStudioStore(), saveStudioStore(), buildEntityPack(), parseEntityPack(), $(), approxDataUrlKb(), currentEntity(), totalFrames(), setStatus(), pushEventLog(), knownEntityKeys(), fillEntitySelect(), renderEntityRail(), syncGridInputs(), activeClipKey(), syncClipInputs(), syncEventInputs(), readEventInputsIntoEntity(), loadSheetImage(), drawSheet(), drawTimeline(), activeClip(), effectivePreviewFps(), drawPreviewFrame(), drawOne(), stopPreviewLoop(), tickPreview(), playPreview(), advancePlayAll(), playAllStates(), firePreviewHook(), applyClipFromInputs(), setClipRangeFromFrames(), persistAll(), exportSelectedFrame(), exportEntityPack(), importEntityPackFile(), duplicateEntity(), onEntityChange(), bindSheetCanvasClick(), frameFromTimelineX(), bindTimeline(), fillSfxSelects(), renderSoundBank(), bindControls(), onGrid(), installMediaStudio()
- `src/ui/adminSprites.ts`: installSpriteUploads(), loadStored(), getAdminSprite()
- `src/ui/authModal.ts`: syncTitleAuthState(), showEmailAuthModal(), get(), bindTitleAuthButtons()
- `src/ui/combos.ts`: setComboFocusHandler(), class ComboFx, setPlayer(), reset(), update(), onHits(), onReslice(), onKills(), onMilestone(), showSummary(), setMeter(), maybeFocus(), setFocus(), push(), clearStacks()
- `src/ui/components/dom.ts`: el(), append(), classNames(), escapeHtml(), clear()
- `src/ui/components/primitives.ts`: GameButton(), GamePanel(), GameCard(), GameBadge(), GameRankBadge(), GameProgressBar(), GameXPBar(), GameCurrency(), GameAvatar(), GameTabs(), GameSection(), GameHeader(), GameFooter(), GameTooltip(), GameHeroCard(), GameItemCard(), GameEmpty()
- `src/ui/components/surface.ts`: root(), wireGlobal(), openSurface(), openScreenSurface(), closeHandle(), remove(), closeTop(), closeAllSurfaces(), openSurfaceCount(), readSpeed(), GameToast(), confirmModal(), finish()
- `src/ui/creatorSlicerVfx.ts`: $(), escapeAttr(), status(), catalogList(), selectedCatalog(), currentPack(), selectedPreset(), persistDraft(), harvestSlicerFields(), harvestPresetFields(), presetOptions(), renderSlicerSelect(), renderPresetList(), renderSlicerFields(), renderPresetFields(), renderAll(), readFileAsDataUrl(), spawnPreview(), drawPreviewIdle(), tickPreview(), publishToLive(), loadFromDraft(), installCreatorSlicerVfx()
- `src/ui/creatorWaveBoard.ts`: $(), status(), currentLevel(), persistDraft(), syncAdvancedJson(), updatePreview(), fruitOptions(), enemyOptions(), renderSpawnRow(), renderWaveCard(), escapeAttr(), readWaveFromCard(), harvestFromDom(), renderBoard(), bindCardHandlers(), publishToLive(), loadFromLiveOrDraft(), installCreatorWaveBoard(), getCreatorWavesDraft()
- `src/ui/design/designMode.ts`: isDesignModeOpen(), openDesignMode(), paint(), closeDesignMode(), installDesignMode()
- `src/ui/design/screenPreviews.ts`: sampleSave(), noop(), realScreen(), renderPreviewScreen(), dashboard(), missions(), achievements(), settings(), hud()
- `src/ui/design/themeEditor.ts`: field(), toHexInput(), renderThemeEditor(), range(), lengthField(), styleSelect(), rerender()
- `src/ui/design/themePreview.ts`: renderThemePreview(), demoModal()
- `src/ui/floatingScore.ts`: class FloatingScoreManager, ensureContainer(), spawn(), update(), reset()
- `src/ui/hud.ts`: class Hud, setSidebarOpen(), initSidebarMobile(), showMenu(), enterDashboard(), canEnterDashboard(), applyUserToHud(), gateAfterAuth(), returnToTitle(), isTitleOpen(), logoutToTitle(), openAdmin(), setTitleVisible(), playTitleStory(), refreshTitleButtons(), initTitleScreen(), installTitleSliceInteraction(), spawnTitleSlash(), spawnTitleLogoImpact(), openAuthModal(), openConfirmEmailModal(), openProfileSetupModal(), syncSettingsMuteLabel(), showPause(), showPage(), mountMeta(), updateDashboardPanels(), refreshMonthlyRank(), mountHeroes(), mountModes(), mountShop(), updateVIPStatus(), isSuperPanelHidden(), sizeSuperLiquidCanvas(), drawSuperLiquidFrame(), stopSuperLiquidLoop(), startSuperLiquidLoop(), nudgeSuperLiquid(), bootSuperLiquidCanvas(), mountProfileInventory(), mountSkills(), mountHeroPerks(), refreshHeroPick(), sync(), setUpgrade(), initLeaderboardFilters(), loadLeaderboard(), initQuestsSubtabs(), loadQuests(), renderMissions(), renderAchievements(), renderBadges(), renderRanks(), renderProfilePage(), renderProfileBadgesSummary(), renderProfileRankProgress(), setDailyClaimable(), checkDailyBonus(), formatCountdown(), startDailyCountdown(), stopDailyCountdown(), renderDailyCards(), openDailyModal(), initSteamIntegration(), openSteamModal(), initModals(), installModalDismissGestures(), refreshDailyFromAdmin(), writeNext(), control(), hitLogo(), endStroke(), setEl(), setImg(), setStyle(), step(), tick(), dismiss()
- `src/ui/hudToggle.ts`: setupToggle(), installHudToggles()
- `src/ui/lucideIcon.ts`: lucideIcon(), mountLucideIcon(), mountLucidePlaceholders()
- `src/ui/menuParallax.ts`: reducedMotion(), menusVisible(), shouldRun(), refreshRoots(), setTargets(), applyLayers(), clearLayers(), tick(), onPointer(), onTouch(), onOrient(), startActive(), stopActive(), syncMenuParallax(), bootMenuParallax(), stopMenuParallax()
- `src/ui/screens/campaign.ts`: icon(), renderCampaign(), renderDetails()
- `src/ui/screens/heroes.ts`: availabilityBadge(), heroDetail(), renderHeroScreen(), resetHeroView()
- `src/ui/screens/hub.ts`: registerHubTab(), hubTabs(), icon(), buildHeader(), buildFooter(), paintTab(), renderHub(), switchHubTab(), refreshHub(), resetHub()
- `src/ui/screens/hubTabs.ts`: shopMain(), shopSub(), shopHubTab(), inventoryMain(), inventorySub(), slot(), inventoryHubTab(), availabilityBadge(), heroesMain(), heroesSub(), heroesHubTab(), statCard(), profileMain(), profileSub(), profileHubTab(), coopHubTab(), homeMain(), homeSub(), homeHubTab()
- `src/ui/screens/index.ts`: host(), refreshCurrentScreen(), renderFor(), hubOptions(), installGameScreens(), showLegacy()
- `src/ui/screens/inventory.ts`: loadoutStrip(), slot(), renderInventory(), resetInventoryView()
- `src/ui/screens/itemCard.ts`: slicerPreview(), swatch(), slotLabel(), renderItemCard()
- `src/ui/screens/legacyMenu.ts`: showLegacyMenuPage()
- `src/ui/screens/mainMenu.ts`: icon(), playerIdentity(), renderMainMenu()
- `src/ui/screens/news.ts`: renderNews()
- `src/ui/screens/profile.ts`: statCard(), renderProfile()
- `src/ui/screens/registry.ts`: registerScreen(), getScreen(), registeredScreens(), resetRegistry(), applyVisibility(), render(), installScreenRouter(), go(), openScreen(), closeScreen(), back(), home(), installNavLinks(), handler(), installEscHandler(), handler()
- `src/ui/screens/settings.ts`: renderSettings()
- `src/ui/screens/shell.ts`: screenShell(), categoryTabs(), emptyState()
- `src/ui/screens/shop.ts`: renderShop(), resetShopView()
- `src/ui/screens/social.ts`: icon(), formField(), message(), renderSocial(), renderFriends(), lookupProfile(), renderProfile(), renderNotifications(), loadMessages(), loadFriends(), loadNotifications()
- `src/ui/slicerPreview.ts`: renderSlicerLivePreview(), readSlicerCard(), value(), number(), checked(), mountSlicerCard(), refresh(), observeSlicerEditor(), scan(), escapeHtml()
- `src/ui/theme/cssVars.ts`: cssUrl(), scaled(), themeToCssVars(), set(), kebab(), applyThemeToDom(), themeToCssText()
- `src/ui/theme/index.ts`: initThemeSystem()
- `src/ui/theme/layout.ts`: breakpointForWidth(), presentationFor(), findLayoutPreset(), applyLayoutToDom(), getLayout(), setLayout(), currentBreakpoint()
- `src/ui/theme/presets.ts`: findPreset(), presetSummaries()
- `src/ui/theme/themeAssets.ts`: isThemeAssetSlot(), uploadThemeAsset(), setThemeAsset(), clearThemeAsset(), getThemeAsset(), applyFavicon()
- `src/ui/theme/themeStore.ts`: hasStorage(), class ThemeStore, get(), boot(), readStored(), set(), patch(), usePreset(), reset(), export(), import(), presets(), subscribe(), persist(), apply()
- `src/ui/theme/validate.ts`: isPlainObject(), sanitizeCssValue(), pickString(), pickNumber(), pickBool(), sanitizeAssetUrl(), section(), validateTheme(), cloneTheme(), mergeTheme(), exportThemeJson(), importThemeJson()
- `src/ui/towerChip.ts`: ensureChip(), updateTowerChip(), installTowerChip()

## Bottom line

There is a meaningful game and a substantial amount of implemented UI, game logic, server code, and tests. It is inaccurate to say that nothing exists. It is equally inaccurate to say that every feature is complete, bug-free, fully balanced, production-ready, or proven on mobile. The largest factual gaps are online Co-op, true server-verified matches, authored/fully verified Campaign, community forum/moderation, real-device/production verification, and full live-Atlas integration testing. The automated suite passes, but it is not a substitute for those checks.

