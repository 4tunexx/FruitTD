# Co-op Multiplayer - Deferred Feature

## Status: Out of Scope for Current Run

Real-time cooperative multiplayer is a substantial feature requiring significant architecture and is deferred for future development.

## Why Co-op is Deferred

### Technical Complexity
Co-op requires:
1. **Real-time networking infrastructure**
   - WebSocket or WebRTC connections
   - Server authoritative game state
   - Client prediction and reconciliation
   - Lag compensation
   - Bandwidth optimization

2. **Game state synchronization**
   - Shared main tower health
   - Coordinated wave spawning
   - Synchronized fruit positions and health
   - Shared combo/score tracking
   - Team juice bank

3. **Matchmaking system**
   - Lobby creation and joining
   - Friend invites
   - Party management
   - Skill-based matching
   - Reconnection handling

4. **UI/UX overhaul**
   - Lobby browser
   - Party invites
   - Ready check
   - Teammate indicators in-game
   - Team chat
   - Shared HUD elements

### Estimated Scope
- **Networking**: 40-60 hours
- **State sync**: 30-40 hours
- **Matchmaking**: 20-30 hours
- **UI/UX**: 30-40 hours
- **Testing**: 20-30 hours
- **Total**: 140-200 hours of development

This is well beyond a single cloud agent run budget.

## Current Architecture Limitations

The game is architected for single-player:
- Client-side game state (`src/game/state.ts`)
- Local simulation and physics
- No server authority for gameplay
- No network message protocol
- No interpolation/extrapolation

## What Would Be Required

### 1. Server Authority
Migrate core game loop to server:
```
Client                    Server
  ↓                         ↓
Input → [Send to Server] → Validate
  ↓                         ↓
← [Game State] ← Simulate
  ↓                         ↓
Render                   Broadcast
```

### 2. Networking Protocol
Define message types:
- Player input (slash, turret placement)
- Game state updates (fruit positions, HP)
- Tower damage
- Wave progression
- Score/combo updates

### 3. Lobby System
- Create party
- Invite friends
- Join via code
- Ready check
- Host migration

### 4. Shared Gameplay
- One shared main tower
- Coordinated spawns
- Team combos (chain between players)
- Shared juice bank
- Team score
- Revive mechanics?

### 5. Backend Infrastructure
- Game server instances
- Session management
- Player presence
- Database for matches
- Analytics

## Trivial Co-op Alternatives (Not Implemented)

Even "simple" co-op features would require significant work:

### Asynchronous Co-op
- Share best scores with friends
- Ghost replay races
- Challenge friends to beat scores
- **Estimate**: 10-15 hours (still substantial)

### Helper System
- Summon friend's hero as AI assistant
- Offline co-op spirit
- **Estimate**: 15-20 hours

These are still too large for current budget.

## Recommendation

Defer co-op until:
1. Single-player experience is polished
2. Content pipeline is stable
3. Player base justifies networking costs
4. Budget allows 2-3 month focused development

## Current Alternatives

Players can compete via:
- **Ranked leaderboards** (implemented)
- **Monthly seasons** (implemented)
- **Mission competition** (implemented)
- **Achievement showcase** (implemented)

## Future Planning

If co-op is prioritized:
1. Prototype with simple WebSocket server
2. Test with 2-player MVP
3. Validate networking performance
4. Design team mechanics
5. Build full matchmaking
6. Scale to 4-player teams

---

**Decision**: Co-op deferred. Focus on single-player polish, security, and admin tools delivers more value per hour of development.
