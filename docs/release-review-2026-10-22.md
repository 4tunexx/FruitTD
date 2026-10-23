# FruitTD gameplay and admin review — 22 October 2026

This is a verified improvement release, not a claim that every feature is bug-free or that player retention has been established.

## Changes

- Fixed a desktop CSS conflict that left the Arena battlefield absolutely positioned underneath a large command strip. The final combat stylesheet now owns scene positioning and command-bar direction.
- Compact Arena header, readable attack cards, clear Send label, first-build hint, safe-area padding, and separate blue/red identity colours. Selecting an existing turret shows its upgrade/sell actions instead of the new-build catalogue.
- Defence view frames the defensive half at a useful scale; Attack shows both mirrored lanes. Existing authoritative rules still restrict construction to legal defensive pads.
- Incoming PvP snapshots preserve pressed controls and update the battlefield during interactions. Older command responses cannot replace newer match revisions. A host marker lets portalled matches clean up when the hub reuses its content container.
- Co-op polling preserves room-code inputs and friend-name drafts. The live match escapes the hub's clipping, keeps scene updates flowing during swipes, and cleans up when its host disappears.
- Co-op has a compact health/resource HUD, collapsible roster and tower controls, and a clearer result panel. Leaving an active run asks for confirmation because it ends the team run.
- Improved shared-field camera framing and removed a redundant drawn road that covered the existing battlefield texture.
- Admin supports exact numeric entry; the old global conversion from number fields to sliders has been removed. Generic balance controls retain both a slider and exact input. Invalid values cannot be published through the main save action.
- Mobile admin has a section selector, compact counters, shorter instructions, and a smaller Save changes button.
- Admin previews show Co-op fruit positions and main tower levels through 10; auxiliary turrets remain capped at the actual supported level. PvP preview health reflects main tower upgrades. Illegal pad territory is marked visually.
- Shared DOM helpers preserve false ARIA states. Static navigation/button numbers no longer count up through misleading temporary values.
- Development previews now include the current visual styles. Added an isolated Co-op preview using the actual game rules and renderer.

## Evidence

- `npm test`: **633 passed, 0 failed, 0 skipped**, 12 suites. Includes existing server economy/claim, campaign, PvP, Co-op, content, UI and admin regressions.
- Added regression coverage for pressed-control snapshots, exact admin values and invalid input, false ARIA states, and Co-op drafts across polling/roster updates.
- `npm run build`: passed TypeScript, Vite and API bundling.
- Main JS bundle: **573.08 kB**, **185.54 kB gzip**. The existing >500 kB chunk warning remains.
- Browser: desktop, 390×844 phone, 820×1180 tablet, and 844×390 landscape Arena layout checks. Panels remained within the viewport without horizontal document overflow.
- Browser: all **17 admin tabs** opened; numeric input remained `type=number`; an edited PvP value survived switching sections and saved successfully in the isolated preview. Mobile section selector worked; no page JavaScript errors.
- Browser: Co-op started with two fixture players, rendered directly under document body, cancelled Leave without ending the run, confirmed Leave, and returned the result to its hub host. No page JavaScript errors.
- Screenshots: `design-review/admin-mobile-oct22.jpg` and `design-review/coop-mobile-oct22.jpg`.

## What this does not establish

Browser gameplay and admin saves used isolated local fixtures. They did not write to live player accounts or MongoDB. The automated economy tests are not a live shop-purchase/account settlement test. Actual separate-account Ably play, connection recovery on real mobile networks, physical iOS/Android/tablet performance, all 100 campaign stages played end to end, and retention/balance playtesting remain unverified. The artwork remains the existing art, ready for later replacement.

The connected Vercel production deployment before this release was READY at base commit `b9b7be3`. An error-log query returned no matching entries for its returned window; absence of logs is not proof of fault-free operation.
