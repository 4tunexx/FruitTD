# Permanent reward history and daily reset verification

## Confirmed issue

The published catalog contains 50 main missions and 5 daily missions. The main missions retain IDs from the former daily/weekly/monthly catalog. Production still contains claimed mission records under those historical period keys, alongside newer `MAIN` records. Looking up only `MAIN` discarded earlier progress and claim history.

Main mission reads, progress updates and claims now consider every historical period for that mission and account. Progress carries forward using the highest recorded value; completed or claimed history stays complete. Any historical claim or wallet receipt blocks a new permanent payout. Historical documents remain intact; this release does not remove currency or rewrite player saves.

Achievements and badges remain permanent. Quest lists now recognize the wallet's atomic payment receipts, even if the separate progress/claim marker is stale or missing. Completed progress is monotonic, completed objectives stop generating new completion events, and private quest responses cannot be cached. The client refreshes claim state after an unsuccessful claim rather than leaving an obsolete claim button enabled.

Daily missions still use their exact UTC date. A previous day's completion/receipt cannot complete or claim today's objective. Main missions are independent of the calendar. UI explains both rules.

## Popup categories

The former shared popup always prefixed its title with `ACHIEVEMENT`, including missions, badges, daily login, seasonal prizes and even login/Admin errors. Quest notices now use explicit categories and phases. Gameplay completion says reward available and where to claim it; only a successful payment says reward received and shows a plus amount. Daily login remains separate from daily missions. Neutral service messages have no achievement prefix.

## Validation

`server/questLifetime.test.ts` covers old daily/weekly main-mission history, unpaid legacy completion, parallel claims, midnight/month transitions, all three quest lists with missing/stale marker documents, daily fresh-progress requirements, badge lifetime payouts, and interruption after wallet payment but before marker storage. Existing atomic wallet/profile tests remain in place. Type checking, full test suite and production build run before publication.

The claim marker is secondary to the atomic wallet receipt. A marker storage error after payment must still return the paid wallet to the client; subsequent lists and retries recognize the receipt.

## Mode scope and remaining verification

Solo Casual/Horde/Campaign and local Co-op send quest events through the shared client progression service and these authenticated routes. Online Arena/Ranked settle rewards with per-match receipts and set permanent PvP achievements without resetting their claim flags. Online Co-op uses per-match receipts and sets its permanent achievement without resetting its claim flag. Daily login and seasonal leaderboard prizes have their own intentionally repeatable period keys; this change does not alter those rules.

Automated mode simulations and recovery coverage from earlier releases are documented in `ingame-followup-verification.md`. This release reruns the full suite, including that coverage. It does not certify every line of code or every live game session. Physical iPhone heat/FPS/touch checks and real multi-account network play remain outstanding. The available browser cannot create a WebGL context, so a complete rendered combat playthrough is unavailable in this environment.
