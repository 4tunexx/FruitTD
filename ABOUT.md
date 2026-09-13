# Fruit TD — About the Game

## What is Fruit TD?

Fruit TD is a fast arcade **tower defence game built around slicing combat**.

The player controls a hero and uses a blade/slicer to destroy enemies before they reach the Main Tower. Waves become harder, enemy types become more dangerous, combos become more valuable and the player keeps improving through hero XP, tower XP, coins, perks, unlocks and cosmetics.

The important difference is that slicing is only the **weapon system**. The game itself is a tower-defence progression game.

### The vision

> **Protect the tower. Slice the enemies. Build the combo. Upgrade. Unlock. Come back stronger.**

Fruit TD should be easy to understand in seconds but deep enough that players can spend a long time mastering heroes, builds, waves and competitive play.

---

# Game identity

Fruit TD is being designed around three connected layers:

### 1. The Match

Fast slicing combat, combos, enemies, waves, bosses and Main Tower survival.

### 2. The Progression

Hero XP, Level 100 heroes, tower levels, perks, coins, missions, achievements, unlocks and cosmetics.

### 3. The Platform

Shop, Inventory, Slicer Creator, administration, co-op, ranked play, seasons and leaderboards.

The final game should make these layers feed into each other instead of feeling like separate systems.

---

# Match gameplay

A normal match follows this basic structure:

```text
ENTER MATCH
    ↓
SELECT HERO + SLICER
    ↓
WAVE STARTS
    ↓
ENEMIES APPROACH MAIN TOWER
    ↓
SLICE ENEMIES
    ↓
BUILD COMBO
    ↓
MANAGE SPECIAL ENEMIES
    ↓
PROTECT TOWER
    ↓
CLEAR WAVE / DEFEAT BOSS
    ↓
EARN REWARDS
    ↓
UPGRADE / LEVEL / UNLOCK
    ↓
NEXT RUN
```

A good run should constantly give the player something to react to and something to work toward.

---

# Main Tower

The Main Tower is the heart of Fruit TD.

If enemies get through, the tower loses health. If the tower falls, the run ends.

The tower also has its own permanent progression, meaning players are not only levelling their hero. They are building the strength of the account's central defence.

## Permanent Tower Level

The current progression foundation supports **10 tower levels**.

| Level | Name | Reward |
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

This is intended to become a proper tower-building system rather than simply a level number.

---

# Heroes

Heroes are one of the biggest reasons to keep playing.

The old prototype limited heroes to Level 5. The current progression architecture is designed for **Level 1–100**.

Hero XP is persisted and the effective level is calculated from the stored XP.

## Current heroes

### Master Jiju

- Starting hero
- Level requirement: 1
- Free
- First progression path

### Topfu

- Unlocks from Master Jiju progression
- Unlock requirement: Master Jiju Level 10
- Free unlock

### Lagen

- Unlocks from Master Jiju progression
- Unlock requirement: Master Jiju Level 25
- Free unlock

### Tripos

- Late-game hero
- Purchase-only
- Cost: 1,800 coins
- Not automatically unlocked by reaching a level

### Master Ki

- Late-game hero
- Purchase-only
- Cost: 3,000 coins
- Not automatically unlocked by reaching a level

This structure gives the player both **earned unlocks** and **long-term purchase goals**.

---

# Hero progression

Hero XP should never feel like a meaningless bar.

The intended progression structure is:

```text
PLAY HERO
  ↓
EARN HERO XP
  ↓
LEVEL UP
  ↓
UNLOCK MILESTONE
  ↓
GAIN PERK / COSMETIC / FEATURE
  ↓
BUILD STRONGER HERO
  ↓
PLAY HARDER CONTENT
```

Current milestone foundations include:

| Level | Milestone |
|---:|---|
| 5 | New blade-effect slot |
| 10 | Hero Perk I + Topfu unlock |
| 20 | Hero cosmetic slot |
| 25 | Lagen unlock |
| 30 | Hero Perk II |
| 40 | Hero cosmetic slot |
| 50 | Hero Perk III |
| 60 | Hero cosmetic slot |
| 75 | Hero Perk IV |
| 90 | Mastery cosmetic |
| 100 | MAX MASTERY |

The final progression system should add more meaningful decisions around hero builds, perks, abilities and mastery.

---

# Hero perks

Hero perks are intended to give players a reason to specialise instead of every hero simply becoming a larger damage number.

The current code contains a hero-perk progression foundation and persistent perk state.

The planned final system should support:

- Perk ranks
- Perk upgrade costs
- Hero-specific builds
- Combo bonuses
- Damage/defence utility
- Special enemy counter-play
- Long-term mastery choices

Perk UI and complete gameplay integration are still being finished.

---

# Enemy design

Enemies are designed to make the player think about **what to slice, when to slice it and what risk it creates**.

## Normal

The basic enemy. Reliable target and foundation for early waves.

## Explosive / Volatile

A dangerous target that can damage the Main Tower when triggered.

The purpose is to create a choice:

> **Can you safely cut it before it becomes a problem?**

This should become one of the game's signature mechanics.

## Armored

A high-health enemy that takes longer to remove and increases pressure on the defence line.

## Swift

A fast enemy with lower health. It tests reaction speed and target priority.

## Splitter

A tougher enemy intended to create additional pressure when defeated. Full split behaviour is still being developed.

---

# Bosses

Bosses are already represented in the wave foundations, with higher-level armored boss progression.

The final boss system should have:

- Unique attack patterns
- Multiple phases
- Weak points
- Special slicing rules
- Tower threats
- Large combo opportunities
- Unique rewards

Bosses should feel like events rather than ordinary enemies with more health.

---

# Waves

Wave difficulty should grow through more than enemy quantity.

The long-term wave system is intended to combine:

- Enemy composition
- Enemy speed
- Enemy health
- Special enemies
- Bosses
- Tower pressure
- Objectives
- Wave modifiers
- Reward multipliers
- Co-op mechanics

This gives the game room to remain interesting at high wave counts.

---

# Slicing

Slicing is the most important moment-to-moment mechanic.

It needs to feel immediate.

The target is:

- Low input latency
- Clean hit detection
- Strong blade trail
- Clear target reaction
- Juicy impact effects
- Strong audio feedback
- Combo popups
- Danger warnings
- Camera/visual feedback where appropriate
- Mobile touch support

The player should always understand **what they hit, what happened and what they earned**.

---

# Combos

Combos are a major part of the arcade feel.

The visual direction uses large readable combo feedback and satisfying hit reactions.

The deeper goal is to make combos useful, not just pretty.

Future combo rewards can connect to:

- Score
- Coins
- Hero XP
- Tower XP
- Mission progress
- Special enemy bonuses
- Perfect-wave rewards
- Co-op team bonuses

A player should feel that keeping a combo alive has a real gameplay purpose.

---

# Risk and reward

Fruit TD should constantly create small decisions.

Examples:

- Do I safely slice the volatile enemy?
- Do I chase a combo or protect the tower?
- Do I use my ability now or save it for the boss?
- Do I spend coins on a new hero or cosmetics?
- Do I invest in one hero or level several heroes?
- Do I push for a perfect wave reward?
- Do I take a harder challenge for better rewards?

This is what separates the game from a simple slicing score attack.

---

# Slicer Creator

The Slicer Creator is the admin tool for building the game's custom blades and slicing effects.

Current foundations include:

- Slicer definitions
- Slicer catalogue data
- Editor settings
- Width
- Colour
- Glow
- FX settings
- Live DOM preview
- Automatic preview mounting
- Live updates when editor fields change

## Intended workflow

```text
CREATE
  ↓
CONFIGURE
  ↓
LIVE PREVIEW
  ↓
TEST SLICE
  ↓
INSPECT
  ↓
SAVE
  ↓
PUBLISH
  ↓
SHOP
```

The final editor should allow an admin to inspect the slicer as close as possible to the real game before making it available to players.

---

# Shop

The Shop is the place where players discover things they can buy.

Potential categories include:

- Slicers
- Blade effects
- Hero cosmetics
- Tower cosmetics
- Player cosmetics
- Other collectible items

The Shop should focus on discovery and purchasing, not ownership management.

---

# Inventory

Inventory is separate from the Shop.

Inventory means:

> **Items the player actually owns.**

The basic flow is:

```text
SHOP
 ↓
BUY
 ↓
INVENTORY
 ↓
EQUIP
 ↓
ACTIVE LOADOUT
```

The final system should clearly show:

- Owned
- Equipped
- Locked
- New
- Duplicate handling
- Sellable
- Item details
- Preview

The project currently has the ownership/equipment foundations but still needs the final dedicated Inventory UX and clean data flow.

---

# Economy

Coins are a core progression currency.

Players should earn coins from gameplay and use them for meaningful decisions such as late-game hero purchases and cosmetics.

The economy should avoid becoming either:

- So generous that progression becomes meaningless, or
- So restrictive that the game feels like a grind.

The final economy needs proper reward balancing, sinks, progression pacing and anti-exploit validation.

---

# Missions and achievements

Fruit TD already contains foundations for missions, achievements and badges.

The final system should provide short-term, medium-term and long-term goals.

### Short-term

- Daily missions
- Quick challenges
- Combo targets
- Wave targets

### Medium-term

- Hero milestones
- Tower milestones
- Achievement chains
- Unlock objectives

### Long-term

- Hero mastery
- Tower mastery
- Seasonal goals
- Ranked achievements
- Rare cosmetics

The important rule is that these systems should reinforce the gameplay rather than feel like unrelated checkboxes.

---

# Player retention philosophy

The game should create a healthy **one-more-run** feeling through visible progress.

After a run, the player should be able to see:

```text
+ HERO XP
+ TOWER XP
+ COINS
+ SCORE
+ MISSIONS
+ ACHIEVEMENTS
+ UNLOCK PROGRESS
+ MASTERY PROGRESS
```

Then the game should clearly show what the next useful target is.

Examples:

> **2,400 XP until Hero Level 20**

> **1 more level until Tower upgrade**

> **300 coins until Tripos**

> **1 mission until reward chest**

> **Next wave unlocks a new enemy type**

This gives players a reason to start another run without relying on random rewards alone.

---

# Menus and game UI

The interface is being redesigned away from a website/dashboard feeling and toward a proper game interface.

The final structure should feel closer to a modern multiplayer game:

```text
MAIN MENU
 ├── PLAY
 ├── HEROES
 ├── LOADOUT
 ├── SHOP
 ├── INVENTORY
 ├── MISSIONS
 ├── ACHIEVEMENTS
 ├── RANKED
 ├── CO-OP
 └── SETTINGS
```

The player should always have a clear way to return to the Main Menu.

Menus should prioritise:

- Large game-style cards
- Strong visual hierarchy
- Player level/rank
- Hero display
- Progress bars
- Unlock previews
- Clear CTA buttons
- Controller/touch-friendly controls
- Mobile layouts

The current UI is still being transitioned from prototype structure to this final direction.

---

# Mobile

Mobile is intended to be a first-class platform, not a shrunken desktop version.

The final mobile experience should include:

- Touch slicing
- Responsive HUD
- Safe-area support
- Large touch targets
- Mobile hero/shop/inventory layouts
- Compact menus
- No horizontal overflow
- Correct canvas scaling
- Performance-conscious effects

The current repository already contains responsive/mobile foundations, but complete device QA and final polish remain outstanding.

---

# Co-op

Co-op is a major part of the long-term identity of Fruit TD.

The idea is not simply to put two players into the same game.

Players should have reasons to help each other.

Possible systems include:

- Shared Main Tower
- Team health management
- Team combos
- Hero roles
- Cooperative abilities
- Player-specific objectives
- Team missions
- Shared rewards
- Emergency saves
- Boss coordination

A future co-op match should create moments where two players work together to save a run.

**Full real-time networking is not yet complete in the current branch.**

---

# Ranked

Fruit TD is intended to support a competitive ranked layer once the core match and networking systems are production-ready.

Potential competitive structure:

```text
PLAY RANKED
  ↓
COMPLETE MATCH
  ↓
PERFORMANCE SCORE
  ↓
RATING CHANGE
  ↓
DIVISION PROGRESS
  ↓
SEASONAL REWARDS
```

Planned systems include:

- Ranked matchmaking
- Divisions
- Seasonal ranks
- Leaderboards
- Match history
- Performance tracking
- Competitive rewards
- Server-authoritative result validation

The current repository contains ranked-score foundations, but full ranked matchmaking is not yet implemented.

---

# Administration

Fruit TD includes an admin/server foundation intended to become a full live game control centre.

The admin system should eventually allow authorised staff to manage:

- Game configuration
- Missions
- Achievements
- Slicers
- Catalogue items
- Shop availability
- Rewards
- Events
- Player moderation
- Scores
- Live configuration

The Slicer Creator is an important part of this system because it allows game content to be designed and inspected without rebuilding the entire game manually.

Production server-side authorisation and security still require final hardening.

---

# Saving and account progression

The project has a local save architecture plus MongoDB/server foundations.

Current progression data includes foundations for:

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

Save migration and merge handling are also present.

The final production system should make cloud progression authoritative, secure and resistant to client-side manipulation.

---

# Technical architecture

Fruit TD currently uses:

- **TypeScript** for application/game logic
- **Three.js** for 3D rendering and gameplay presentation
- **Vite** for the frontend build/dev environment
- **Tailwind CSS** for UI styling foundations
- **Express** for the local/server API layer
- **MongoDB / MongoDB Atlas** for persistent server data
- **Steam Web API integration foundations**
- **Vercel configuration** for deployment

The source is currently divided between game systems, UI systems, server/API code and administration.

---

# Important game systems in the codebase

The current implementation contains dedicated foundations for:

- `heroes` — hero definitions and combat stats
- `heroProgression` — Level 100 progression and perks
- `heroPerkSave` — persistent hero perk state
- `save` — player save data, migrations and ownership
- `state` — live game state
- `towerProgression` — persistent Main Tower XP/levels
- `towerMilestones` — permanent tower rewards
- `waves` — enemy wave composition
- `enemies` — enemy types and rules
- `fruits` — runtime targets/enemy presentation
- `slicers` — slicer definitions/equipment
- `slicerPreview` — live admin slicer preview
- `combos` — combo presentation and feedback
- `progressionUi` — progression HUD compatibility/presentation
- `missions` — mission foundations
- `achievements` — achievement foundations
- `badges` — badge foundations
- server/admin routes — backend/admin foundation

---

# Development philosophy

Fruit TD should follow these rules throughout development.

### Gameplay first

A system is not finished because a button exists. It is finished when the gameplay, rewards, persistence and UI all work together.

### No fake progression

Level numbers should represent real progression. Unlocks and rewards must actually work.

### No meaningless menus

Every screen should have a purpose and clear navigation.

### No client-trusted competitive rewards

Competitive progression and valuable account data must eventually be validated server-side.

### Mobile matters

A feature that works on desktop but breaks on a phone is not finished.

### Content should be reusable

Admin tools should make it easier to create and manage content without duplicating hard-coded systems.

---

# Current development phases

## Phase 1 — Foundation

Mostly established.

- Hero Level 100
- Persistent hero XP
- Hero ownership/unlocks
- Purchase-only heroes
- Tower Level 10
- Tower XP foundation
- Tower milestones
- Enemy definitions
- Explosive tower damage
- Hero perk foundation
- Slicer live preview foundation
- Progression tests

## Phase 2 — Gameplay completion

Current priority.

- Wire all XP reward paths
- Finish tower XP gameplay rewards
- Finish special enemy runtime behaviours
- Finish splitter behaviour
- Apply special rewards consistently
- Fix fruit atlas/texture alignment
- Finish slicing impact behaviour
- Finish combo reward integration
- Improve boss/wave variety

## Phase 3 — Progression and mastery

- Complete perk UI
- Complete milestone rewards
- Hero build choices
- Mastery system
- Daily/weekly progression
- Missions/achievements expansion
- Better end-of-run progression

## Phase 4 — Slicer, Shop and Inventory

- Production Slicer Creator
- Live slice test mode
- Draft/publish workflow
- Shop cleanup
- Dedicated Inventory
- Ownership validation
- Equip/unequip
- Selling rules
- Cosmetic previews

## Phase 5 — Game UI and mobile

- Real game-style dashboard/menu
- Main Menu
- Reliable Back/Home navigation
- Better hero selection
- Better Shop/Inventory screens
- Mobile-first HUD
- Touch polish
- Small-screen QA
- Safe-area/device testing

## Phase 6 — Multiplayer and ranked

- Real-time co-op
- Lobby/matchmaking
- Shared team state
- Team rewards
- Ranked matchmaking
- Divisions
- Seasons
- Leaderboards
- Server-authoritative competitive validation

## Phase 7 — Content

- More heroes
- More enemies
- More bosses
- More tower content
- More slicers
- More cosmetics
- Events
- Seasons
- Challenges

## Phase 8 — Production QA

- Regression testing
- Save migration testing
- Cloud-save conflict testing
- Mobile performance
- Desktop performance
- Network failure handling
- Security audit
- Admin permission audit
- Asset/texture validation
- Production deployment verification

---

# What "finished" means

Fruit TD should only be considered **100% complete** when the major systems are connected end-to-end.

That means:

```text
GAMEPLAY
  +
PROGRESSION
  +
SAVING
  +
CONTENT
  +
SHOP
  +
INVENTORY
  +
SLICER CREATOR
  +
MENUS
  +
MOBILE
  +
CO-OP
  +
RANKED
  +
SECURITY
  +
TESTING
  +
PERFORMANCE
  =
PRODUCTION GAME
```

A feature should not be marked complete simply because its UI exists. The underlying behaviour, persistence, rewards, edge cases and tests must also work.

---

# Final vision

Fruit TD should become a game where the player can start with one simple hero and eventually build a complete identity around the way they play.

A new player sees:

> **Protect the tower. Slice the enemies.**

A regular player sees:

> **Which hero should I level next?**

A committed player sees:

> **Which build, slicer and tower upgrades give me the best run?**

A competitive player sees:

> **Can my team survive higher waves and climb the ranked ladder?**

That is the intended progression from a simple slicing mechanic into a complete co-op tower-defence game.

**Fruit TD — slice smart, defend hard, keep pushing.**
