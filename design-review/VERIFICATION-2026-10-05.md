# FruitTD verification phases — 5 October 2026

This record covers the current local fixes and their evidence. Earlier audit documents are historical. It does not certify every live account journey or claim the project has no remaining defects.

## Phase 1 — Realtime lifecycle

Fixed immediate retry loops after failed subscriptions, late connections after disposal, late token responses, and an old Arena subscription failure closing a replacement screen's client. Co-op cleanup uses the same room/disposal guards. Completed Arena matches close their subscription.

Four Arena regressions exercise failed subscription fallback, delayed imports, delayed tokens, and replacement-client ownership. These tests use fake realtime clients; the original production Ably error has not been reproduced against two live accounts.

## Phase 2 — Admin menus and editing

Opened all 13 visible admin tabs at 1440×900, 768×1024 and 390×844 using the actual admin controller and markup in `admin-preview.html`. That development page intercepts API actions and keeps saves in memory. It requires no privileged credentials and does not publish config to the real server.

Fixed:

- Title, announcement, accent and economy drafts being reset by tab changes.
- Daily reward text/numeric drafts waiting for blur before updating; added the missing Gems control for all seven days.
- Published local appearance using edits made after the save request started; publishing now uses the submitted snapshot.
- Mobile overflow in Missions, Achievements and Badges caused by a requirement field spanning a nonexistent second column.
- The tall mobile tab menu, replaced with one scrolling row; switching tabs returns to the top of the editor.
- Admin blade previews losing their size limit to a later generic canvas rule. All four previews are capped at 320×100; on a 390px phone they fit at about 314×100.
- Untrusted leaderboard player names being interpolated into HTML. Names are now text nodes.
- Old leaderboard responses overwriting newer refreshes, and failed score deletion silently appearing successful.
- Hidden catalog editors being rebuilt when only one tab changes.

Browser checks confirmed all tabs opened, corrected layouts fitted, title/economy drafts survived switching, and a changed Daily Gems value survived switching and a local mock save. Three admin regressions cover draft retention, literal name rendering and out-of-order refreshes. Individual Creator uploads and real account publishing remain live integration work.

## Phase 3 — Arena gameplay and blade visuals

Played the local Arena practice flow on a 390×844 viewport: built a Fire Blade on a blue tile, upgraded it, opened attack controls and sent a blue fruit pack. Verified the resulting feedback, enemy wall damage, exit confirmation, result overlay and acknowledgement back to the queue. The lobby's battle layout class and result overlay cleared after acknowledgement.

At 1440×900 the battlefield filled a 1110×786 area beside the command panel, with blue and red bases arranged across the landscape view. Mobile had no page overflow. These checks use the actual game simulation and renderer with a local opponent; they do not settle account rewards or ratings.

Reproduced the desktop Shop animation defect: blade preview containers had zero width while mobile used explicit dimensions. Previews now fill their card width; all three desktop Shop canvases measured approximately 276×98. Their backgrounds and borders also follow the dark grey/yellow palette. Existing animation tests verify moving cuts, shine and clearing between swipes.

## Phase 4 — Startup, keyboard and controller menus

The actual title → sign-in entry rendered within phone, tablet and desktop widths without horizontal overflow. Settings opened and closed normally.

Reproduced directional focus doing nothing because the menu controller selected a hidden Campaign dialog. It now selects the visible dialog, including legacy Settings and sign-in surfaces. In the browser, successive Down presses focused Settings' close button and Mute sound. A regression also exercises simulated gamepad A/B: A cannot activate the page behind a modal, and B closes the visible modal. Physical controller testing is still pending.

Signed-out startup now skips personal monthly-rank requests. Signed-in requests use the authenticated session without a client-supplied user ID. Two service regressions cover those paths.

## Phase 5 — Build and performance

- Complete suite: **416 tests passed, zero failures**; 10 new tests in this pass.
- Production build: TypeScript, frontend and API bundling passed.
- Menu artwork: lossless WebP conversion reduced 2,318,457 bytes to 1,714,832 bytes, saving 603,625 bytes (26%). Decoded RGBA pixels were checked for equality.
- Test-runner crashes or launch failures now return failure instead of falling back to exit code zero.
- JavaScript size warnings remain: main approximately 537KB and Three.js approximately 509KB before gzip. A proper lazy game bootstrap remains performance work; the warning was not suppressed.

## Phase 6 — Remaining live verification

The next release checks require a staging environment or suitable signed-in test sessions:

1. Two-account Arena and Co-op connection loss, reconnection and result settlement against live Ably.
2. Privileged admin publication → another account receiving the catalog → purchase → Inventory → equip.
3. A played Campaign boss kill and end animation on real phone/tablet hardware, including backgrounding and rotation.
4. Physical controller and Steam wrapper behavior.

No deployment was performed in this pass. Browser admin saves were isolated in preview memory. Tests cover server reward and authorization rules, but that evidence does not substitute for the live journeys above.

## Visual evidence

- `admin-mobile-fixed.jpg` — compact admin tabs and bounded blade preview.
- `arena-desktop-verified.jpg` — the actual local practice match, blue/red lanes and full desktop layout.
- `desktop-blades-fixed.jpg` — desktop Shop previews after correcting their zero-width containers.
