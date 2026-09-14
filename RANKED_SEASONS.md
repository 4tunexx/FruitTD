# Ranked Seasons System

## Current Implementation

The game includes a functional monthly ranked season system:

### Season Identifiers
- Format: `ranked-YYYY-MM` (e.g., `ranked-2026-09`)
- Generated via `monthlyLeaderboardMode()` in `src/game/requirements.ts`
- Automatically rotates each calendar month

### Rank Tiers
Seven tiers from Bronze to Grandmaster:
- **Bronze**: 0+ points (starting tier)
- **Silver**: 1,500+ points
- **Gold**: 4,000+ points
- **Platinum**: 8,000+ points
- **Diamond**: 15,000+ points
- **Master**: 25,000+ points
- **Grandmaster**: 40,000+ points

### Admin Configuration
- Tiers are editable in Admin Control Center → Monthly Ranks tab
- Change thresholds, colors, icons per tier
- Saved to MongoDB Atlas

### Leaderboard Integration
- Scores submitted via `/api/leaderboard` POST
- Monthly leaderboard filtered by season mode
- User rank calculated from best monthly score
- Ranked route: `/api/leaderboard/monthly-rank`

### UI Display
- HUD shows current monthly rank and progress
- Next tier threshold and points needed
- Season identifier (e.g., "ranked-2026-09")
- Tier progression visual

## Incremental Improvements Completed

### Server-Side Validation
- Score submissions capped at reasonable maximums (10M points)
- Wave, combo, and fruits sliced validation
- Prevents absurd client-submitted values

### Season Infrastructure
- Monthly rotation automatic via date-based mode keys
- Persistent season scores in MongoDB `leaderboards` collection
- Historical season data preserved (old seasons remain in DB)

### Rank Progression Hooks
- `rankFromScore()` calculates tier from score
- `rankThreshold()` gets minimum score for tier
- Mission/achievement requirements can target specific ranks
- Badge rewards for reaching tiers

## Not Yet Implemented

### Full Matchmaking
Real-time competitive matchmaking with:
- Queue system
- Skill-based matching
- Team composition
- Match history
- MMR/Elo ratings

**Status**: Out of scope for current iteration. Current system supports:
- Solo ranked score submission
- Monthly leaderboards
- Tier-based progression
- Season rotation

### Season Rewards
End-of-season rewards (coins, badges, exclusive skins) not yet distributed automatically. Current workaround:
- Admins can manually grant rewards via daily bonus or config
- Mission system can award badges for reaching tiers

### Decay System
Rank decay for inactive players not implemented.

### Placement Matches
New players start at Bronze tier 0 points (no placement matches).

## Testing

Test the ranked system:
1. Play a match in Ranked mode
2. Submit score via game over screen
3. Check `/api/leaderboard/monthly-rank?userId=YOUR_ID`
4. View monthly leaderboard: `/api/leaderboard?mode=monthly`
5. Verify tier progression in HUD

## Future Enhancements

If expanding ranked system:
1. **Season Rewards**: Auto-distribute end-of-season rewards
2. **Placement Matches**: Initial 5-10 matches for new players
3. **Decay**: Points decay after 7+ days inactive
4. **Match History**: Store individual ranked match results
5. **Leaderboard Brackets**: Top 10/50/100 rewards
6. **Skill Rating**: Separate MMR from display points
7. **Matchmaking**: Real-time queue for competitive 1v1 or co-op
8. **Season Challenges**: Special missions per season
9. **Cosmetic Rewards**: Season-exclusive skins/badges
10. **Detailed Stats**: Win rate, average score, best hero

## Architecture Notes

- Seasons stored as `leaderboards` documents with mode field
- Each user can have multiple entries per mode (best score kept)
- Admin can wipe specific mode: `/api/admin/leaderboard/delete` with `wipeAll: true, mode: 'ranked-2026-09'`
- Tiers configurable via admin panel, stored in `admin_config.ranks`
