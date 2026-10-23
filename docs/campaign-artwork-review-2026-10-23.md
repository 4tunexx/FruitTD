# Campaign chapter artwork follow-up

The 100-stage completion test already covers sequential unlocks, stopping the match after a boss kill, duplicate completion callbacks, and all 20 chapter milestones. This is logic coverage, not a full gameplay playthrough.

The chapter artwork workflow was missing. Chapters now support an optional optimized WebP image, uploaded and previewed in Admin → Content. Saving chapter text preserves the image; the remove action clears it on the next chapter save. The chapter renderer displays the configured image and clears previous artwork for text-only chapters. Malformed or oversized images are rejected on the server.

Asynchronous boss/chapter image decoding now uses a request generation guard, so switching editor selections or removing an image invalidates a pending upload.

Validation: 638 tests passed, no failures/skips. TypeScript, Vite and API bundling passed. Main JavaScript 574.37 kB / 186.04 kB gzip; existing chunk-size warning remains. Chromium at 390×844 verified upload, save, switching chapters and in-game rendering without horizontal overflow or page errors. Save verification used isolated preview memory, not production MongoDB.

Live multiplayer, live account settlement, real-device performance and full campaign playthroughs remain outstanding.
