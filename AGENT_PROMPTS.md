# FruitTD — Coding Agent Prompts

**Repo:** https://github.com/4tunexx/FruitTD  
**Branch:** `main`  
**Source of truth:** `AUDIT_AND_HANDOFF.md`, `PHASE_0_AUDIT.md`, current `main` HEAD  
**Goal:** Give a coding agent self-contained, sequential prompts that avoid re-auditing and keep cost low.

Use these prompts **one at a time**. Each prompt assumes the previous phase is complete and tests still pass.

---

## How to use

1. Paste the prompt into your coding agent (Cursor / Claude / Copilot / etc.).
2. Tell the agent: "Work only on this prompt. Do not expand scope. Run tests after every change. Commit when the acceptance criteria pass."
3. After the agent finishes, review the PR / commit, then move to the next prompt.

---

## Prompt 0 — Baseline health check (run first)

```
You are working in the FruitTD repository (4tunexx/FruitTD) on branch main.

1. Confirm current HEAD and that the working tree is clean.
2. Run: npm test  (or the repo’s test script). Expect all tests green.
3. Run: npm run build  (or the full build script). Expect TypeScript + Vite + API bundle to succeed.
4. Report:
   - Commit SHA
   - Test count / pass / fail
   - Bundle size if available
   - Any obvious regressions from the last menu refactor (unified 4-panel hub)

Do not change any source files. Only report status.
```

---

## Prompt 1 — Live input / hit confirmation (BLOCKER C-01)

```
FruitTD combat blocker: automated / live gestures do not produce hits.

Context from AUDIT_AND_HANDOFF.md (C-01):
- Page enters PLAY and targets spawn, but pointer/touch gestures fail to register score/combo/trail.
- Possible causes: overlay intercepting events, canvas coordinate mismatch after resize, pointer capture, projection, or test-harness issues.

Tasks (in order):
1. In the live game (or a minimal Playwright/Puppeteer harness), after PLAY starts and a fruit is visible:
   - Use document.elementFromPoint / elementsFromPoint at the projected fruit screen position.
   - Log canvas.getBoundingClientRect(), devicePixelRatio, camera projection, and active pointer events.
2. Verify pointerdown / pointermove / pointerup reach the canvas with correct clientX/Y and pointerId.
3. Check src/input/blade.ts and src/game/slicer.ts for any early-return that discards strokes.
4. Fix the root cause only. Prefer the smallest change that restores real hits.
5. Add or extend a test (unit or integration) that proves a synthetic stroke produces a kill/score change.
6. Acceptance: desktop mouse swipe and a simulated touch swipe both produce nonzero score/XP and visible trail + compact feedback rail.

Do not touch economy, auth, or menu code. Run the full test suite after the fix.
```

---

## Prompt 2 — Auth registration path (P0 A-01 + A-02)

```
FruitTD P0 auth issues.

From PHASE_0_AUDIT / AUDIT_AND_HANDOFF:
- Title “Start Game” / “Load Save” both open login mode only. Registration UI exists but is unreachable.
- server/auth.ts logs verification codes and can return previewCode outside a safe non-production guard.

Tasks:
1. In the title / main-menu auth modal, add an explicit “Create account” / “Register” switch that calls the existing registration path.
2. Ensure error, loading, and back behaviour are correct for a brand-new email.
3. In server/auth.ts:
   - Never log verification codes in production.
   - Only return previewCode when NODE_ENV !== 'production' (or an explicit DEV flag).
   - Keep existing scrypt + session behaviour.
4. Add a minimal UI test or e2e smoke that reaches the register form from the title screen.
5. Acceptance: a new user can open register, submit, and the API no longer leaks codes in production builds.

Do not implement a real email provider yet; just close the UI gate and the leak.
```

---

## Prompt 3 — Server-authoritative economy foundation (P0 E-01 / E-02)

```
FruitTD economy is still client-truth.

Reproduced issues:
- /api/profile/sync accepts arbitrary in-cap coins/gems/XP and ownership.
- Lower revision can overwrite higher revision.
- Leaderboard accepts score/wave without a played match.

Tasks (foundation only — do not build full match simulation yet):
1. Introduce a server-owned revision / etag for the player save document. Reject writes with older or missing revision.
2. On sync, validate schema strictly; reject unknown ownership keys and values outside declared ranges.
3. For leaderboard submissions, require a short-lived server-issued run token (or session-bound match id) that is consumed on submit. Reject scores without a valid token.
4. Keep existing client caps as a first line of defence, but server is authoritative.
5. Add API tests that prove:
   - stale revision is rejected
   - forged ownership is rejected
   - leaderboard without run token is rejected
6. Acceptance: the characterisation tests that previously asserted “client can cheat” now fail for the cheat cases and pass for legitimate flows.

Do not rewrite the whole reward pipeline. Keep the change as small as possible while making the server the source of truth for balances and scores.
```

---

## Prompt 4 — Claim atomicity (P1 E-03)

```
Daily / mission / achievement claims acknowledge success but do not atomically credit the server wallet.

Tasks:
1. Make claim endpoints perform a single atomic Mongo transaction (or equivalent findOneAndUpdate with conditions) that:
   - checks the claim has not already been taken
   - credits coins / gems / XP / items
   - marks the claim as consumed
2. Client should treat the response as the new authoritative wallet; do not optimistically add then sync later.
3. Add concurrent-claim tests (two parallel requests) proving only one succeeds.
4. Acceptance: after a successful claim, a subsequent cloud-save read shows the credited balance without requiring a client-side apply.

Scope limited to claim endpoints and the matching client handlers.
```

---

## Prompt 5 — Navigation & duplicate screens (N-01 … N-11)

```
FruitTD has a modern 4-panel hub and leftover legacy lobby markup.

Tasks:
1. Inventory every screen/overlay: list the single active implementation and its owner module.
2. Confirm that legacy #btn-start / #menu-leftnav are never visible or interactive after the menu refactor.
3. Ensure Back returns one level, Home returns to main hub, and quit-from-match shows exactly one confirmation.
4. Add stable data-testid attributes to active controls (Play, Heroes, Shop, Inventory, Profile, Settings, Admin).
5. Remove dead legacy handlers only after confirming no remaining references.
6. Acceptance: a route matrix (manual or scripted) can reach every primary screen and return without dead-ends or double prompts.

Do not redesign visuals; only fix routing, ownership, and testability.
```

---

## Prompt 6 — Shop → Inventory → Equip end-to-end

```
Shop purchase → Inventory → Equip → play → reload is not fully verified.

Tasks:
1. Trace the active buy / equip / unequip / sell paths (ignore hidden legacy inventory).
2. Ensure server (once Prompt 3 is done) owns ownership; client only requests actions.
3. Wire unequip on the active Inventory screen if missing.
4. Add a focused test or short e2e that:
   - purchases a catalogue item (or uses an admin-granted one)
   - equips it
   - reloads and confirms ownership + equipped state persist
5. Acceptance: the journey works for at least one slicer / skin and survives page reload.

Keep visual polish out of scope.
```

---

## Prompt 7 — Combat polish follow-ups (after C-01 is green)

```
Only run this after Prompt 1 (live hits) is confirmed.

1. Verify splitter parent quarantine + original-wave accounting under real play (not just unit tests).
2. Confirm reslice of own debris is blocked.
3. Confirm compact feedback rail, score pool (≤4 nodes), and directional slash FX appear on real kills.
4. Fix any remaining display-vs-actual reward text mismatches (bomb parry, combo tier text).
5. Acceptance: a short recorded play session shows correct score, combo, wave-clear, and no pool-reuse corruption.

No new features; only close the combat verification gaps listed in AUDIT_AND_HANDOFF.md.
```

---

## Prompt 8 — Production hardening checklist

```
Prepare a production-readiness pass.

1. Confirm email verification cannot fall back to previewCode in production.
2. Confirm admin routes remain behind Steam-ID allowlist (or stronger auth).
3. Add rate limits / attempt limits on auth and claim endpoints if missing.
4. Scan for remaining client-trusted progression writes; list any that still need server authority.
5. Produce a short PRODUCTION_CHECKLIST.md with pass/fail for:
   - auth gates
   - economy authority
   - leaderboard integrity
   - admin permission matrix
   - asset licensing notes (Sound/ folder)
6. Do not deploy; only document and fix the clear security/authority gaps.
```

---

## Prompt 9 — Agent cost-saving rules (always include)

```
Standing instructions for every FruitTD coding-agent session:

- Read AUDIT_AND_HANDOFF.md and AGENT_PROMPTS.md before starting.
- Never rewrite main.ts or hud.ts from scratch; make surgical changes.
- Prefer existing modules (progression/*, save.ts, navigation.ts, screens/*).
- Run the full test suite after every meaningful change.
- Keep commits small and focused; one logical fix per commit.
- Do not expand scope beyond the current prompt.
- If a live browser check is required, prefer a minimal Playwright script over full manual exploration.
- When finished, output: files changed, tests run, acceptance criteria status, and the next recommended prompt.
```

---

## Recommended order

0 → 1 (blocker) → 2 (auth) → 3 (economy) → 4 (claims) → 5 (nav) → 6 (shop/inventory) → 7 (combat polish) → 8 (prod)

Stop after any prompt whose acceptance criteria fail; do not stack unfinished work.
