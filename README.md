# Fruit TD

> **A co-op tower defence game where slicing is the weapon.**

Fruit TD is a browser-based Three.js game combining fast slicing combat with tower defence, hero progression, upgrades, cosmetics, missions and future co-op/ranked play.

**This is not a Fruit Ninja clone.** Slicing is the combat input. The real objective is to defend the Main Tower, survive waves, build combos, level heroes, unlock content and improve your build.

## Current status

`phase-1-foundation` is an active development branch. The progression foundation is substantially upgraded, but the project is not yet a finished production release.

### Implemented foundations

- Hero progression to **Level 100**
- Persistent hero XP
- Owned-hero progression and unlock logic
- Level-based hero unlocks
- Purchase-only late-game heroes
- Main Tower progression to **Level 10**
- Persistent Main Tower XP foundation
- Tower milestone rewards
- Normal, explosive, armored, splitter and swift enemies
- Explosive enemies that can damage the Main Tower
- Progressive special-enemy wave spawning
- Boss-wave foundations
- Hero perk progression foundation
- Slicer Creator and live preview foundation
- Slicer catalogue/equipment foundations
- Combo/danger feedback improvements
- Responsive/mobile UI foundations
- Local save and MongoDB-backed server foundation
- Steam integration foundations
- Progression and admin-route tests

### Still in development

- Complete hero XP reward wiring
- Complete tower XP reward wiring
- Full special-enemy behaviours
- Splitter runtime behaviour
- Consistent special-enemy rewards
- Fruit atlas/texture alignment validation
- Final slicing/impact polish
- Full combo reward integration
- Production Slicer Creator test mode
- Clean Shop vs Inventory separation
- Final game-style menus/dashboard
- Reliable Back/Home navigation
- Full mobile-first polish
- Complete missions/achievements/retention systems
- Real-time co-op networking
- Production ranked matchmaking/seasons
- Larger content roster
- Final security/performance/regression QA

## Core loop

```text
CHOOSE HERO
  ↓
DEFEND MAIN TOWER
  ↓
SLICE ENEMIES
  ↓
BUILD COMBOS
  ↓
SURVIVE WAVE
  ↓
EARN XP + COINS + REWARDS
  ↓
LEVEL HERO / UPGRADE TOWER
  ↓
UNLOCK HEROES / PERKS / COSMETICS
  ↓
FACE HARDER WAVES
  ↓
CO-OP / RANKED / MASTERY
```

The target is a strong **one-more-run** loop where every match contributes to progression, mastery, missions, cosmetics or competitive performance.

## Main Tower

The Main Tower is the centre of the game: it is the thing players defend and a permanent progression system.

The current foundation supports **10 permanent levels**:

| Level | Milestone | Reward |
|---:|---|---|
| 1 | Foundation | Starting tower |
| 2 | Fortified Base | +1 starting life |
| 3 | Juice Core | +5% Juice gain |
| 4 | Reinforced Wall | +1 maximum life |
| 5 | Rapid Defence | +5% defence fire rate |
| 6 | Combo Battery | +5% combo reward |
| 7 | Emergency Core | +10% Last Stand reward |
| 8 | Fortress | +1 maximum life |
| 9 | Elite Core | +10% Tower XP from perfect waves |
| 10 | Master Fortress | Fortress badge + Master Tower title |

Permanent tower progression is separate from temporary in-match tower health/state.

## Heroes

Heroes are a major long-term progression system. The old Level 5 ceiling has been replaced with **Level 100** progression and persistent XP.

| Hero | Unlock | Cost | Status |
|---|---:|---:|---|
| **Master Jiju** | Level 1 | Free | Starting hero |
| **Topfu** | Master Jiju Level 10 | Free | Level unlock |
| **Lagen** | Master Jiju Level 25 | Free | Level unlock |
| **Tripos** | Purchase only | 1,800 coins | Late-game hero |
| **Master Ki** | Purchase only | 3,000 coins | Late-game hero |

Tripos and Master Ki are deliberately not automatically unlocked by level.

### Hero milestones

- Level 5 — New blade-effect slot
- Level 10 — Hero Perk I + Topfu unlock
- Level 20 — Hero cosmetic slot
- Level 25 — Lagen unlock
- Level 30 — Hero Perk II
- Level 40 — Hero cosmetic slot
- Level 50 — Hero Perk III
- Level 60 — Hero cosmetic slot
- Level 75 — Hero Perk IV
- Level 90 — Mastery cosmetic
- Level 100 — **MAX MASTERY**

The final hero system will make levelling meaningful through perks, abilities, cosmetics, build choices and mastery rewards.

## Enemies and waves

Current enemy definitions:

- **Normal** — standard target
- **Explosive / Volatile** — dangerous target that can damage the Main Tower
- **Armored** — high-health, slower target
- **Splitter** — tougher target intended to create additional pressure
- **Swift** — fast, lower-health target

Current wave foundations include progressive special enemies, explosive targets, boss waves and higher-level armored bosses.

Explosive enemies introduce a tower-defence decision: **slice safely or risk the tower**. The current system supports Main Tower damage when a volatile enemy is triggered plus danger feedback and special score/XP rules. More advanced telegraphs and behaviours are still being developed.

## Slicing and combos

Slicing is the primary combat input. The target feel is fast, readable and satisfying:

- Responsive slicing
- Clear target feedback
- Combo building
- Impact feedback
- Danger warnings
- Score/XP feedback
- Blade effects
- Hit reactions

The visual direction takes inspiration from high-quality arcade slicing games, while the underlying gameplay remains tower defence.

Future combo rewards will connect accuracy, speed, special enemies, wave performance and eventually team actions to progression.

## Slicer Creator

The admin Slicer Creator foundation includes:

- Slicer definitions
- Catalogue data
- Editor foundations
- Width settings
- Colour settings
- Glow settings
- FX settings
- Live DOM preview
- Automatic preview mounting in slicer editor cards
- Live updates when editor values change

Target workflow:

```text
CREATE SLICER → EDIT → LIVE INSPECT → TEST SLICE → SAVE → PUBLISH → SHOP
```

The current live preview is a foundation. A full production-grade slice testing/inspection environment is still being built.

## Shop and Inventory

The final architecture separates:

**Shop** = items available to purchase.

**Inventory** = items the player actually owns.

```text
SHOP → PURCHASE → INVENTORY → EQUIP → ACTIVE ITEM
```

Owned skins, equipment and catalogue foundations already exist. The final UI, ownership validation, selling and equip/unequip flow are still being completed.

## Progression

Current progression foundations cover:

- Hero XP / Level 1–100
- Hero milestones and unlocks
- Hero purchases
- Hero perks
- Main Tower XP / Level 1–10
- Tower milestones
- Coins
- Skill points and skills
- Skins and equipment
- High score
- Ranked score storage
- Best wave
- Games played
- Missions
- Achievements
- Badges
- Daily/weekly/monthly progression concepts

## Co-op and ranked

Fruit TD is intended to become a **co-op tower defence game with competitive progression**.

### Co-op direction

- Shared Main Tower
- Team combos
- Different hero roles
- Cooperative abilities
- Team events
- Shared rewards
- Team missions

### Ranked direction

- Ranked matches
- Divisions/tiers
- Seasons
- Leaderboards
- Match results
- Performance tracking
- Competitive rewards

**Current limitation:** full real-time multiplayer networking and production ranked matchmaking are not complete in this branch.

## Admin Control Center

The project contains admin/server foundations for:

- Admin routes
- Game configuration
- Missions
- Scores
- Catalogue/content management
- Slicer management
- Live configuration
- Administrative testing

The intended result is a proper live game control centre. Production security and server-side authorisation still require final hardening.

## Saving and persistence

The save architecture contains foundations for:

- Hero XP
- Owned heroes
- Coins
- Skill points
- Skills
- Skins
- Equipped cosmetics
- High score
- Ranked score
- Best wave
- Games played
- Main Tower XP
- Main Tower lifetime XP

Save migration and merge handling are also present. Final production cloud-save authority, conflict resolution and security validation remain to be completed.

## Technology

- TypeScript
- Three.js
- Vite
- Tailwind CSS
- Express
- MongoDB / MongoDB Atlas
- Steam Web API integration foundations
- Vercel deployment configuration

### Scripts

```bash
npm run dev
npm run server
npm run build
npm run build:api
npm run preview
npm test
```

## Local development

Requirements:

- Node.js
- npm
- MongoDB Atlas for server-backed features
- Steam Web API key for Steam-related features

Install:

```bash
npm install
```

Create `.env` from `.env.example` and configure the required variables, including:

```text
MONGODB_URI=
STEAM_API_KEY=
```

Run the server:

```bash
npm run server
```

Run the frontend in another terminal:

```bash
npm run dev
```

Default local URLs:

```text
Game: http://localhost:5173
API:  http://localhost:3001
```

## Build and tests

```bash
npm run build
npm test
```

The current tests include server/admin route coverage and progression tests.

## Development roadmap

### Phase 1 — Foundation

- [x] Hero Level 100 foundation
- [x] Persistent hero XP foundation
- [x] Hero ownership/unlock foundation
- [x] Purchase-only late heroes
- [x] Main Tower Level 10 foundation
- [x] Tower XP persistence foundation
- [x] Tower milestones
- [x] Special enemy definitions
- [x] Explosive tower-damage foundation
- [x] Hero perk foundation
- [x] Slicer live-preview foundation
- [x] Progression tests

### Phase 2 — Gameplay completion

- [ ] Wire every hero XP reward path
- [ ] Wire tower XP rewards into gameplay
- [ ] Finish special enemy behaviours
- [ ] Finish splitter behaviour
- [ ] Apply special-enemy reward multipliers consistently
- [ ] Repair/validate fruit atlas mappings
- [ ] Finish slicing/impact behaviour
- [ ] Finish combo reward integration
- [ ] Expand boss/wave behaviour

### Phase 3 — Progression and mastery

- [ ] Hero perk upgrade UI
- [ ] Complete milestone rewards
- [ ] Meaningful hero builds
- [ ] Mastery rewards
- [ ] Daily/weekly progression
- [ ] Expanded missions and achievements
- [ ] Better end-of-run rewards screen

### Phase 4 — Slicer, Shop and Inventory

- [ ] Production Slicer Creator
- [ ] Live slice test mode
- [ ] Draft/publish workflow
- [ ] Shop catalogue cleanup
- [ ] Separate Inventory screen
- [ ] Ownership validation
- [ ] Equip/unequip flow
- [ ] Selling rules
- [ ] Cosmetic previews

### Phase 5 — Game UI and mobile

- [ ] Replace website-like dashboard with a real game menu
- [ ] Proper Main Menu
- [ ] Reliable Back/Home navigation
- [ ] Improved hero selection
- [ ] Improved Shop/Inventory UI
- [ ] Mobile-first HUD
- [ ] Touch slicing polish
- [ ] Small-screen QA
- [ ] Safe-area/device testing

### Phase 6 — Multiplayer and ranked

- [ ] Real-time co-op networking
- [ ] Lobby/match flow
- [ ] Shared team tower state
- [ ] Team rewards
- [ ] Ranked matchmaking
- [ ] Ranked divisions
- [ ] Seasonal leaderboards
- [ ] Server-authoritative competitive validation

### Phase 7 — Content

- [ ] More heroes
- [ ] More enemy behaviours
- [ ] More bosses
- [ ] More tower content
- [ ] More slicers
- [ ] More cosmetics
- [ ] Events
- [ ] Seasons
- [ ] Challenges

### Phase 8 — Production QA

- [ ] Full regression testing
- [ ] Save migration testing
- [ ] Cloud-save conflict testing
- [ ] Mobile performance testing
- [ ] Desktop performance testing
- [ ] Network-failure testing
- [ ] Security audit
- [ ] Admin permission audit
- [ ] Asset/texture validation
- [ ] Final production deployment verification

## Design principles

1. **Slicing must feel good.**
2. **The Main Tower must matter.**
3. **Every enemy should create a decision.**
4. **Progression should feel rewarding, not pointless grinding.**
5. **Heroes should feel different, not just reskinned damage numbers.**
6. **Cosmetics should give players reasons to customise.**
7. **Menus should feel like a real game, not a website.**
8. **Mobile is a first-class platform.**
9. **Co-op should require teamwork.**
10. **Competitive systems must be server-authoritative.**

## Documentation

- `README.md` — project overview, setup, current implementation and roadmap
- `ABOUT.md` — detailed product/game vision and feature specification
- `FruitTD_Game_Plan.txt` — legacy prototype design document

The legacy game-plan file describes an earlier prototype called **Juice Press: Co-op Crunch**. It contains ideas that no longer match the current Fruit TD architecture, so current source code and documentation are authoritative.

## Status

**Active development.** Fruit TD is moving from its prototype foundation toward a complete tower-defence game with deep progression, custom slicing, mobile support, co-op and competitive play.
