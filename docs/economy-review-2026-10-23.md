# Economy follow-up — 23 October 2026

Found and fixed: admin-authored blade prices were stored without integer/range or resale checks. A resale above purchase cost allowed repeat buy/sell profit; fractional prices could produce balances rejected by later purchases.

- Shared validation rejects negative, fractional, non-finite, oversized and profitable-resale prices.
- Admin checks both client-side and server-side, with a blade-specific error. Duplicate IDs, wall ID collisions and paid starter blades are rejected.
- Transaction-time checks protect existing malformed records without changing player balances. Guest transactions use the same guard.
- Added an HTTP route lifecycle test covering purchase without auto-equip, equipment persistence, unequip, equipped-item sale, repeated sale rejection and starter protection.
- Added malformed-pricing tests proving rejected requests leave the wallet and revision unchanged.

Validation: 636 tests passed, zero failed/skipped; TypeScript, Vite and API build passed. Main bundle 574.08 kB / 185.93 kB gzip; existing size warning remains.

These route tests use an isolated collection substitute. No live MongoDB accounts or configuration were modified. Separate-account multiplayer, real-device performance, live settlement and complete campaign playthrough remain outstanding as recorded in the earlier release review.
