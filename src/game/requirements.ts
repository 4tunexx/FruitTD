export type ReqCategory =
  | 'slicing'
  | 'combat'
  | 'defense'
  | 'heroes'
  | 'economy'
  | 'social'
  | 'ranked';

export type ProgressMode = 'increment' | 'max';

export type GameEventName =
  | 'fruit_slice'
  | 'reslice'
  | 'combo'
  | 'wave_clear'
  | 'super'
  | 'turret_place'
  | 'turret_upgrade'
  | 'turret_sell'
  | 'turret_move'
  | 'bomb_parry'
  | 'boss_kill'
  | 'slash_damage'
  | 'leak'
  | 'juice'
  | 'game_start'
  | 'game_over'
  | 'hero_level'
  | 'skill_buy'
  | 'skin_buy'
  | 'daily_claim'
  | 'steam_link'
  | 'mission_claim';

export interface RequirementTypeDef {
  id: string;
  category: ReqCategory;
  label: string;
  hint: string;
  event: GameEventName;
  progress: ProgressMode;
  fruitKind?: string;
  fruitFamily?: string;
  turretKind?: string;
  hero?: string;
  mode?: string;
  rankId?: string;
  usesMinValue?: boolean;
  valueField?: 'combo' | 'wave' | 'score' | 'damage' | 'amount' | 'streak' | 'count';
}

export interface Requirement {
  type: string;
  goal: number;
  minValue?: number;
  mode?: string;
  hero?: string;
  fruitKind?: string;
}

export interface GameEvent {
  type: GameEventName;
  fruitKind?: string;
  fruitFamily?: string;
  boss?: boolean;
  combo?: number;
  wave?: number;
  score?: number;
  damage?: number;
  amount?: number;
  lives?: number;
  maxLives?: number;
  mode?: string;
  hero?: string;
  turretKind?: string;
  count?: number;
  streak?: number;
  leaks?: number;
}

export const REQ_CATEGORIES: Array<{ id: ReqCategory; label: string }> = [
  { id: 'slicing', label: 'In-Game Slicing' },
  { id: 'combat', label: 'Combat & Damage' },
  { id: 'defense', label: 'Wall & Turrets' },
  { id: 'heroes', label: 'Heroes & Skills' },
  { id: 'economy', label: 'Score & Economy' },
  { id: 'social', label: 'Login & Social' },
  { id: 'ranked', label: 'Monthly Ranked' },
];

export const REQUIREMENT_TYPES: RequirementTypeDef[] = [
  { id: 'slice_any', category: 'slicing', label: 'Slice any fruit', hint: 'Count every fruit sliced', event: 'fruit_slice', progress: 'increment' },
  { id: 'slice_watermelon', category: 'slicing', label: 'Slice watermelons', hint: 'Watermelon kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'watermelon' },
  { id: 'slice_lemon', category: 'slicing', label: 'Slice lemons', hint: 'Lemon kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'lemon' },
  { id: 'slice_orange', category: 'slicing', label: 'Slice oranges', hint: 'Orange kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'orange' },
  { id: 'slice_banana', category: 'slicing', label: 'Slice bananas', hint: 'Banana kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'banana' },
  { id: 'slice_strawberry', category: 'slicing', label: 'Slice strawberries', hint: 'Strawberry kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'strawberry' },
  { id: 'slice_pineapple', category: 'slicing', label: 'Slice pineapples', hint: 'Pineapple kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'pineapple' },
  { id: 'slice_kiwi', category: 'slicing', label: 'Slice kiwis', hint: 'Kiwi kills', event: 'fruit_slice', progress: 'increment', fruitKind: 'kiwi' },
  { id: 'slice_citrus', category: 'slicing', label: 'Slice citrus family', hint: 'Lemon, orange, banana, pineapple', event: 'fruit_slice', progress: 'increment', fruitFamily: 'lemon' },
  { id: 'slice_berry', category: 'slicing', label: 'Slice berry family', hint: 'Strawberry and kiwi', event: 'fruit_slice', progress: 'increment', fruitFamily: 'berry' },
  { id: 'slice_melon', category: 'slicing', label: 'Slice melon family', hint: 'Watermelons', event: 'fruit_slice', progress: 'increment', fruitFamily: 'melon' },
  { id: 'slice_citrus_or_berry', category: 'slicing', label: 'Slice lemons or strawberries', hint: 'Classic daily citrus mix', event: 'fruit_slice', progress: 'increment' },
  { id: 'slice_boss', category: 'slicing', label: 'Defeat boss fruit', hint: 'Boss kills', event: 'boss_kill', progress: 'increment' },
  { id: 'reslice_halves', category: 'slicing', label: 'Re-slice fruit halves', hint: 'Cut debris pieces', event: 'reslice', progress: 'increment' },
  { id: 'slice_casual', category: 'slicing', label: 'Slice fruit in Casual', hint: 'Casual mode slices', event: 'fruit_slice', progress: 'increment', mode: 'casual' },
  { id: 'slice_ranked', category: 'slicing', label: 'Slice fruit in Ranked', hint: 'Ranked mode slices', event: 'fruit_slice', progress: 'increment', mode: 'ranked' },
  { id: 'slice_arena', category: 'slicing', label: 'Slice fruit in Arena', hint: 'Arena mode slices', event: 'fruit_slice', progress: 'increment', mode: 'arena' },
  { id: 'slice_coop', category: 'slicing', label: 'Slice fruit in Co-op', hint: 'Co-op mode slices', event: 'fruit_slice', progress: 'increment', mode: 'coop' },

  { id: 'combo_count', category: 'combat', label: 'Land combos', hint: 'Combos at or above Min Value', event: 'combo', progress: 'increment', usesMinValue: true },
  { id: 'combo_peak', category: 'combat', label: 'Reach combo size', hint: 'Highest combo reached', event: 'combo', progress: 'max', valueField: 'combo' },
  { id: 'combo_reach_5', category: 'combat', label: 'Reach 5x combo', hint: 'Hit a 5x combo', event: 'combo', progress: 'max', valueField: 'combo' },
  { id: 'combo_reach_10', category: 'combat', label: 'Reach 10x combo', hint: 'Hit a 10x combo', event: 'combo', progress: 'max', valueField: 'combo' },
  { id: 'combo_reach_15', category: 'combat', label: 'Reach 15x combo', hint: 'Hit a 15x combo', event: 'combo', progress: 'max', valueField: 'combo' },
  { id: 'slash_damage', category: 'combat', label: 'Deal slash damage', hint: 'Accumulate blade damage', event: 'slash_damage', progress: 'increment', valueField: 'damage' },
  { id: 'bomb_parry', category: 'combat', label: 'Parry bombs', hint: 'Deflect bombs with a fast slash', event: 'bomb_parry', progress: 'increment' },
  { id: 'super_activate', category: 'combat', label: 'Activate Super Juice', hint: 'Use Super', event: 'super', progress: 'increment' },
  { id: 'run_max_combo', category: 'combat', label: 'Max combo in a run', hint: 'Best combo when the run ends', event: 'game_over', progress: 'max', valueField: 'combo' },
  { id: 'run_fruits', category: 'combat', label: 'Fruits sliced in a run', hint: 'Best single-run fruit count', event: 'game_over', progress: 'max', valueField: 'amount' },

  { id: 'wave_reach', category: 'defense', label: 'Reach wave number', hint: 'Highest wave reached', event: 'wave_clear', progress: 'max', valueField: 'wave' },
  { id: 'waves_cleared', category: 'defense', label: 'Clear waves', hint: 'Count of waves cleared', event: 'wave_clear', progress: 'increment' },
  { id: 'perfect_wave', category: 'defense', label: 'Clear waves at full lives', hint: 'No damage that wave', event: 'wave_clear', progress: 'increment' },
  { id: 'turret_place', category: 'defense', label: 'Place any turret', hint: 'Build turrets', event: 'turret_place', progress: 'increment' },
  { id: 'place_guillotine', category: 'defense', label: 'Place Guillotine', hint: 'Build Guillotine', event: 'turret_place', progress: 'increment', turretKind: 'guillotine' },
  { id: 'place_vortex', category: 'defense', label: 'Place Vortex Drain', hint: 'Build Vortex', event: 'turret_place', progress: 'increment', turretKind: 'vortex' },
  { id: 'place_laser', category: 'defense', label: 'Place Lemon Laser', hint: 'Build Laser', event: 'turret_place', progress: 'increment', turretKind: 'laser' },
  { id: 'place_railgun', category: 'defense', label: 'Place Melon Railgun', hint: 'Build Railgun', event: 'turret_place', progress: 'increment', turretKind: 'railgun' },
  { id: 'place_sprinkler', category: 'defense', label: 'Place Citrus Sprinkler', hint: 'Build Sprinkler', event: 'turret_place', progress: 'increment', turretKind: 'sprinkler' },
  { id: 'place_blender', category: 'defense', label: 'Place Blender Pit', hint: 'Build Blender', event: 'turret_place', progress: 'increment', turretKind: 'blender' },
  { id: 'turret_upgrade', category: 'defense', label: 'Upgrade turrets', hint: 'Level up towers', event: 'turret_upgrade', progress: 'increment' },
  { id: 'turret_sell', category: 'defense', label: 'Sell turrets', hint: 'Sell placed towers', event: 'turret_sell', progress: 'increment' },
  { id: 'turret_move', category: 'defense', label: 'Move turrets', hint: 'Relocate towers', event: 'turret_move', progress: 'increment' },
  { id: 'prevent_leak', category: 'defense', label: 'Stop leaks (survive waves)', hint: 'Same as waves cleared', event: 'wave_clear', progress: 'increment' },

  { id: 'play_jiju', category: 'heroes', label: 'Play as Master Jiju', hint: 'Start or finish a run as Jiju', event: 'game_start', progress: 'increment', hero: 'jiju' },
  { id: 'play_topfu', category: 'heroes', label: 'Play as Topfu', hint: 'Start a run as Topfu', event: 'game_start', progress: 'increment', hero: 'topfu' },
  { id: 'play_lagen', category: 'heroes', label: 'Play as Lagen', hint: 'Start a run as Lagen', event: 'game_start', progress: 'increment', hero: 'lagen' },
  { id: 'play_tripos', category: 'heroes', label: 'Play as Tripos', hint: 'Start a run as Tripos', event: 'game_start', progress: 'increment', hero: 'tripos' },
  { id: 'play_ki', category: 'heroes', label: 'Play as Master Ki', hint: 'Start a run as Ki', event: 'game_start', progress: 'increment', hero: 'ki' },
  { id: 'hero_level', category: 'heroes', label: 'Hero level-ups', hint: 'Gain hero levels', event: 'hero_level', progress: 'increment' },
  { id: 'buy_skill', category: 'heroes', label: 'Buy skill ranks', hint: 'Spend skill points', event: 'skill_buy', progress: 'increment' },
  { id: 'play_games', category: 'heroes', label: 'Finish matches', hint: 'Game over count', event: 'game_over', progress: 'increment' },
  { id: 'play_casual_games', category: 'heroes', label: 'Finish Casual matches', hint: 'Casual game overs', event: 'game_over', progress: 'increment', mode: 'casual' },
  { id: 'play_ranked_games', category: 'heroes', label: 'Finish Ranked matches', hint: 'Ranked game overs', event: 'game_over', progress: 'increment', mode: 'ranked' },
  { id: 'play_arena_games', category: 'heroes', label: 'Finish Arena matches', hint: 'Arena game overs', event: 'game_over', progress: 'increment', mode: 'arena' },
  { id: 'play_coop_games', category: 'heroes', label: 'Finish Co-op matches', hint: 'Co-op game overs', event: 'game_over', progress: 'increment', mode: 'coop' },

  { id: 'score_reach', category: 'economy', label: 'Reach score', hint: 'Highest score (max)', event: 'game_over', progress: 'max', valueField: 'score' },
  { id: 'earn_score', category: 'economy', label: 'Earn score points', hint: 'Add score as it is gained', event: 'slash_damage', progress: 'increment', valueField: 'score' },
  { id: 'buy_skin', category: 'economy', label: 'Buy shop skins', hint: 'Purchase blades or walls', event: 'skin_buy', progress: 'increment' },
  { id: 'juice_collect', category: 'economy', label: 'Collect juice', hint: 'Juice bank pickups', event: 'juice', progress: 'increment', valueField: 'amount' },
  { id: 'leak_hits', category: 'economy', label: 'Wall leaks taken', hint: 'Fruit that reach the wall', event: 'leak', progress: 'increment' },

  { id: 'claim_daily', category: 'social', label: 'Claim daily bonus', hint: 'Daily login claims', event: 'daily_claim', progress: 'increment' },
  { id: 'daily_streak', category: 'social', label: 'Reach daily streak', hint: 'Highest streak day', event: 'daily_claim', progress: 'max', valueField: 'streak' },
  { id: 'steam_link', category: 'social', label: 'Link Steam', hint: 'Connect a Steam profile', event: 'steam_link', progress: 'increment' },
  { id: 'claim_mission', category: 'social', label: 'Claim missions', hint: 'Turn claimable missions in', event: 'mission_claim', progress: 'increment' },

  { id: 'monthly_score', category: 'ranked', label: 'Monthly ranked score', hint: 'Best score this month', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked' },
  { id: 'reach_bronze', category: 'ranked', label: 'Reach Bronze', hint: 'Hit Bronze monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'bronze' },
  { id: 'reach_silver', category: 'ranked', label: 'Reach Silver', hint: 'Hit Silver monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'silver' },
  { id: 'reach_gold', category: 'ranked', label: 'Reach Gold', hint: 'Hit Gold monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'gold' },
  { id: 'reach_platinum', category: 'ranked', label: 'Reach Platinum', hint: 'Hit Platinum monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'platinum' },
  { id: 'reach_diamond', category: 'ranked', label: 'Reach Diamond', hint: 'Hit Diamond monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'diamond' },
  { id: 'monthly_games', category: 'ranked', label: 'Play monthly ranked games', hint: 'Ranked finishes this period', event: 'game_over', progress: 'increment', mode: 'ranked' },
  { id: 'reach_master', category: 'ranked', label: 'Reach Master', hint: 'Hit Master monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'master' },
  { id: 'reach_grandmaster', category: 'ranked', label: 'Reach Grandmaster', hint: 'Hit Grandmaster monthly threshold', event: 'game_over', progress: 'max', valueField: 'score', mode: 'ranked', rankId: 'grandmaster' },
  { id: 'combo_reach_20', category: 'combat', label: 'Reach 20x combo', hint: 'Hit a 20x combo', event: 'combo', progress: 'max', valueField: 'combo' },
  { id: 'score_casual', category: 'economy', label: 'Casual high score', hint: 'Best casual run score', event: 'game_over', progress: 'max', valueField: 'score', mode: 'casual' },
  { id: 'score_arena', category: 'economy', label: 'Arena high score', hint: 'Best arena run score', event: 'game_over', progress: 'max', valueField: 'score', mode: 'arena' },
  { id: 'score_coop', category: 'economy', label: 'Co-op high score', hint: 'Best co-op run score', event: 'game_over', progress: 'max', valueField: 'score', mode: 'coop' },
  { id: 'super_ranked', category: 'combat', label: 'Activate Super in Ranked', hint: 'Use Super during Ranked', event: 'super', progress: 'increment', mode: 'ranked' },
  { id: 'boss_ranked', category: 'slicing', label: 'Defeat bosses in Ranked', hint: 'Boss kills during Ranked', event: 'boss_kill', progress: 'increment', mode: 'ranked' },
  { id: 'slice_bomb', category: 'slicing', label: 'Parry or clear bombs', hint: 'Bomb encounters you survive', event: 'bomb_parry', progress: 'increment' },
  { id: 'wave_ranked', category: 'defense', label: 'Clear ranked waves', hint: 'Waves cleared in Ranked', event: 'wave_clear', progress: 'increment', mode: 'ranked' },
];

export function requirementById(id: string): RequirementTypeDef | undefined {
  return REQUIREMENT_TYPES.find((r) => r.id === id);
}

export function requirementsByCategory(category: ReqCategory): RequirementTypeDef[] {
  return REQUIREMENT_TYPES.filter((r) => r.category === category);
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthlyLeaderboardMode(date = new Date()): string {
  return `monthly-${currentMonthKey(date)}`;
}

export interface RankTier {
  id: string;
  title: string;
  minScore: number;
  color: string;
  icon: string;
  rewardCoins?: number;
  rewardGems?: number;
}

export const DEFAULT_RANK_TIERS: RankTier[] = [
  { id: 'bronze', title: 'Bronze', minScore: 0, color: '#cd7f32', icon: 'Shield', rewardCoins: 100 },
  { id: 'silver', title: 'Silver', minScore: 1500, color: '#c0c0c0', icon: 'Medal', rewardCoins: 250, rewardGems: 5 },
  { id: 'gold', title: 'Gold', minScore: 4000, color: '#f5c542', icon: 'Trophy', rewardCoins: 500, rewardGems: 10 },
  { id: 'platinum', title: 'Platinum', minScore: 8000, color: '#7dd3fc', icon: 'BadgeCheck', rewardCoins: 750, rewardGems: 15 },
  { id: 'diamond', title: 'Diamond', minScore: 15000, color: '#67e8f9', icon: 'Diamond', rewardCoins: 1500, rewardGems: 30 },
  { id: 'master', title: 'Master', minScore: 25000, color: '#c084fc', icon: 'Crown', rewardCoins: 2500, rewardGems: 60 },
  { id: 'grandmaster', title: 'Grandmaster', minScore: 40000, color: '#fb7185', icon: 'Flame', rewardCoins: 5000, rewardGems: 100 },
];

export function rankFromScore(score: number, tiers: RankTier[] = DEFAULT_RANK_TIERS): RankTier {
  const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((t) => score >= t.minScore) ?? sorted[sorted.length - 1] ?? DEFAULT_RANK_TIERS[0];
}

export function rankThreshold(rankId: string, tiers: RankTier[] = DEFAULT_RANK_TIERS): number {
  return tiers.find((t) => t.id === rankId)?.minScore ?? 0;
}

export interface CatalogMission {
  id: string;
  type: 'main' | 'daily';
  title: string;
  desc: string;
  icon: string;
  enabled: boolean;
  requirement: Requirement;
  rewardCoins: number;
  rewardSp: number;
  rewardGems?: number;
  rewardBadge?: string;
}

export interface CatalogAchievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  enabled: boolean;
  requirement: Requirement;
  rewardCoins: number;
  rewardSp: number;
  rewardGems?: number;
  rewardBadge?: string;
}

export interface CatalogBadge {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  enabled: boolean;
  requirement?: Requirement;
  rewardCoins?: number;
  rewardGems?: number;
}

export function mergeRewardDefaults<T extends { id: string; rewardCoins?: number; rewardGems?: number }>(
  items: T[], defaults: T[],
): T[] {
  const byId = new Map(defaults.map((item) => [item.id, item]));
  const configuredById = new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
  const mergedItems = [...configuredById.values(), ...defaults.filter((item) => !configuredById.has(item.id))];
  return mergedItems.map((item) => {
    const fallback = byId.get(item.id);
    const merged = { ...fallback, ...item } as T;
    const rewardCoins = Math.max(0, Math.min(1_000_000, Math.floor(Number(item.rewardCoins ?? fallback?.rewardCoins) || 0)));
    const rewardGems = Math.max(0, Math.min(1_000_000, Math.floor(Number(item.rewardGems ?? fallback?.rewardGems) || 0)));
    return {
      ...merged,
      rewardCoins,
      rewardGems,
      ...('rewardSp' in merged ? { rewardSp: Math.max(0, Math.min(10_000, Math.floor(Number(merged.rewardSp) || 0))) } : {}),
    } as T;
  });
}

function req(type: string, goal: number, extra: Partial<Requirement> = {}): Requirement {
  return { type, goal, ...extra };
}

type MissionSeed = Omit<CatalogMission, 'type'> & { type: 'daily' | 'weekly' | 'monthly' };
const MISSION_SEEDS: MissionSeed[] = [
  { id: 'daily_lemons', type: 'daily', title: 'Citrus Squeeze', desc: 'Slice 30 lemons or strawberries', icon: 'Citrus', enabled: true, requirement: req('slice_citrus_or_berry', 30), rewardCoins: 80, rewardSp: 0 },
  { id: 'daily_combos', type: 'daily', title: 'Combo Fiend', desc: 'Perform 4 combos of 3x or higher', icon: 'Zap', enabled: true, requirement: req('combo_count', 4, { minValue: 3 }), rewardCoins: 120, rewardSp: 0 },
  { id: 'daily_wave', type: 'daily', title: 'Wave Survivor', desc: 'Survive to wave 5 in any run', icon: 'Waves', enabled: true, requirement: req('wave_reach', 5), rewardCoins: 100, rewardSp: 0 },
  { id: 'weekly_fruits', type: 'weekly', title: 'Fruit Apocalypse', desc: 'Slice 250 total fruits this week', icon: 'Swords', enabled: true, requirement: req('slice_any', 250), rewardCoins: 350, rewardSp: 1 },
  { id: 'monthly_ranked_climb', type: 'monthly', title: 'Monthly Climb', desc: 'Score 4,000 in Ranked this month to reach Gold', icon: 'Trophy', enabled: true, requirement: req('reach_gold', 4000), rewardCoins: 500, rewardSp: 1, rewardGems: 10, rewardBadge: 'gold-slicer' },
  { id: 'monthly_silver_climb', type: 'monthly', title: 'Silver Season', desc: 'Score 1,500 in Ranked this month to reach Silver', icon: 'Medal', enabled: true, requirement: req('reach_silver', 1500), rewardCoins: 250, rewardSp: 0, rewardGems: 5, rewardBadge: 'silver-slicer' },
  { id: 'monthly_diamond_climb', type: 'monthly', title: 'Diamond Season', desc: 'Score 15,000 in Ranked this month to reach Diamond', icon: 'Diamond', enabled: true, requirement: req('reach_diamond', 15000), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: 'diamond-slicer' },
  { id: 'daily_apples', type: 'daily', title: 'Apple Purge', desc: 'Slice 25 apples', icon: 'Apple', enabled: true, requirement: req('slice_any', 25, { fruitKind: 'apple' }), rewardCoins: 75, rewardSp: 0 },
  { id: 'daily_watermelons', type: 'daily', title: 'Crack the Rind', desc: 'Slice 12 watermelons', icon: 'CircleDot', enabled: true, requirement: req('slice_watermelon', 12), rewardCoins: 90, rewardSp: 0 },
  { id: 'daily_oranges', type: 'daily', title: 'Orange Alert', desc: 'Slice 25 oranges', icon: 'Citrus', enabled: true, requirement: req('slice_orange', 25), rewardCoins: 75, rewardSp: 0 },
  { id: 'daily_bananas', type: 'daily', title: 'Peel Patrol', desc: 'Slice 25 bananas', icon: 'Banana', enabled: true, requirement: req('slice_banana', 25), rewardCoins: 75, rewardSp: 0 },
  { id: 'daily_kiwis', type: 'daily', title: 'Kiwi Sweep', desc: 'Slice 25 kiwis', icon: 'Circle', enabled: true, requirement: req('slice_kiwi', 25), rewardCoins: 75, rewardSp: 0 },
  { id: 'daily_pineapples', type: 'daily', title: 'Crown Breaker', desc: 'Slice 18 pineapples', icon: 'Crown', enabled: true, requirement: req('slice_pineapple', 18), rewardCoins: 90, rewardSp: 0 },
  { id: 'daily_bombs', type: 'daily', title: 'Bomb Disposal', desc: 'Parry 6 explosive fruits', icon: 'Bomb', enabled: true, requirement: req('bomb_parry', 6), rewardCoins: 130, rewardSp: 0 },
  { id: 'daily_juice', type: 'daily', title: 'Fresh Supply', desc: 'Collect 120 juice', icon: 'Droplets', enabled: true, requirement: req('juice_collect', 120), rewardCoins: 90, rewardSp: 0 },
  { id: 'daily_damage', type: 'daily', title: 'Clean Cuts', desc: 'Deal 1,500 slash damage', icon: 'Sword', enabled: true, requirement: req('slash_damage', 1500), rewardCoins: 110, rewardSp: 0 },
  { id: 'daily_perfect', type: 'daily', title: 'Untouched Wall', desc: 'Clear 2 perfect waves', icon: 'ShieldCheck', enabled: true, requirement: req('perfect_wave', 2), rewardCoins: 130, rewardSp: 0 },
  { id: 'daily_super', type: 'daily', title: 'Vitamin Overdrive', desc: 'Activate Super Juice twice', icon: 'Sparkles', enabled: true, requirement: req('super_activate', 2), rewardCoins: 100, rewardSp: 0 },
  { id: 'daily_build', type: 'daily', title: 'Wall Engineer', desc: 'Place 3 turrets', icon: 'Hammer', enabled: true, requirement: req('turret_place', 3), rewardCoins: 90, rewardSp: 0 },
  { id: 'daily_upgrade', type: 'daily', title: 'Sharpen Defences', desc: 'Upgrade 2 turrets', icon: 'ArrowUpCircle', enabled: true, requirement: req('turret_upgrade', 2), rewardCoins: 100, rewardSp: 0 },
  { id: 'daily_move', type: 'daily', title: 'Tactical Shift', desc: 'Move a turret once', icon: 'Move', enabled: true, requirement: req('turret_move', 1), rewardCoins: 70, rewardSp: 0 },
  { id: 'daily_reslice', type: 'daily', title: 'Second Cut', desc: 'Re-slice 12 fruit halves', icon: 'Slice', enabled: true, requirement: req('reslice_halves', 12), rewardCoins: 100, rewardSp: 0 },
  { id: 'daily_score', type: 'daily', title: 'Score Run', desc: 'Earn 2,000 score', icon: 'Gauge', enabled: true, requirement: req('earn_score', 2000), rewardCoins: 120, rewardSp: 0 },
  { id: 'daily_jiju', type: 'daily', title: 'Master on Duty', desc: 'Start a run as Master Jiju', icon: 'UserRound', enabled: true, requirement: req('play_jiju', 1), rewardCoins: 60, rewardSp: 0 },
  { id: 'daily_ranked', type: 'daily', title: 'Ranked Deployment', desc: 'Finish a Ranked match', icon: 'Medal', enabled: true, requirement: req('play_ranked_games', 1), rewardCoins: 140, rewardSp: 0, rewardGems: 1 },
  { id: 'weekly_fruit_raid', type: 'weekly', title: 'Orchard Raid', desc: 'Slice 750 fruits', icon: 'Swords', enabled: true, requirement: req('slice_any', 750), rewardCoins: 700, rewardSp: 1 },
  { id: 'weekly_melons', type: 'weekly', title: 'Melon Siege', desc: 'Slice 80 watermelons', icon: 'CircleDot', enabled: true, requirement: req('slice_watermelon', 80), rewardCoins: 500, rewardSp: 1 },
  { id: 'weekly_citrus', type: 'weekly', title: 'Citrus Storm', desc: 'Slice 180 citrus fruits', icon: 'Citrus', enabled: true, requirement: req('slice_citrus', 180), rewardCoins: 500, rewardSp: 1 },
  { id: 'weekly_berries', type: 'weekly', title: 'Berry Cleanup', desc: 'Slice 150 berry fruits', icon: 'Cherry', enabled: true, requirement: req('slice_berry', 150), rewardCoins: 500, rewardSp: 1 },
  { id: 'weekly_waves', type: 'weekly', title: 'Long Watch', desc: 'Clear 30 waves', icon: 'Waves', enabled: true, requirement: req('waves_cleared', 30), rewardCoins: 650, rewardSp: 1 },
  { id: 'weekly_perfect', type: 'weekly', title: 'Perfect Defence', desc: 'Clear 12 perfect waves', icon: 'ShieldCheck', enabled: true, requirement: req('perfect_wave', 12), rewardCoins: 700, rewardSp: 1, rewardGems: 3 },
  { id: 'weekly_combos', type: 'weekly', title: 'Chain Reaction', desc: 'Land 30 combos of 5x or higher', icon: 'Zap', enabled: true, requirement: req('combo_count', 30, { minValue: 5 }), rewardCoins: 650, rewardSp: 1 },
  { id: 'weekly_bosses', type: 'weekly', title: 'Overlord Hunter', desc: 'Defeat 5 bosses', icon: 'Skull', enabled: true, requirement: req('slice_boss', 5), rewardCoins: 800, rewardSp: 1, rewardGems: 5 },
  { id: 'weekly_guillotines', type: 'weekly', title: 'Falling Blades', desc: 'Place 8 Guillotines', icon: 'Scissors', enabled: true, requirement: req('place_guillotine', 8), rewardCoins: 450, rewardSp: 1 },
  { id: 'weekly_vortex', type: 'weekly', title: 'Drain the Horde', desc: 'Place 8 Vortex Drains', icon: 'Tornado', enabled: true, requirement: req('place_vortex', 8), rewardCoins: 450, rewardSp: 1 },
  { id: 'weekly_lasers', type: 'weekly', title: 'Lemon Lightshow', desc: 'Place 8 Lemon Lasers', icon: 'ScanLine', enabled: true, requirement: req('place_laser', 8), rewardCoins: 450, rewardSp: 1 },
  { id: 'weekly_upgrades', type: 'weekly', title: 'Fortified', desc: 'Upgrade turrets 15 times', icon: 'ChevronsUp', enabled: true, requirement: req('turret_upgrade', 15), rewardCoins: 550, rewardSp: 1 },
  { id: 'weekly_games', type: 'weekly', title: 'Active Defender', desc: 'Finish 10 matches', icon: 'Gamepad2', enabled: true, requirement: req('play_games', 10), rewardCoins: 600, rewardSp: 1 },
  { id: 'weekly_ranked', type: 'weekly', title: 'Ladder Duty', desc: 'Finish 5 Ranked matches', icon: 'Trophy', enabled: true, requirement: req('play_ranked_games', 5), rewardCoins: 700, rewardSp: 1, rewardGems: 5 },
  { id: 'weekly_horde', type: 'weekly', title: 'Horde Holdout', desc: 'Clear 20 Horde waves', icon: 'UsersRound', enabled: true, requirement: req('waves_cleared', 20, { mode: 'horde' }), rewardCoins: 750, rewardSp: 1, rewardGems: 4 },
  { id: 'weekly_campaign', type: 'weekly', title: 'Road Through Rot', desc: 'Clear 20 Campaign waves', icon: 'Map', enabled: true, requirement: req('waves_cleared', 20, { mode: 'campaign' }), rewardCoins: 750, rewardSp: 1, rewardGems: 4 },
  { id: 'weekly_damage', type: 'weekly', title: 'Blade Work', desc: 'Deal 30,000 slash damage', icon: 'Sword', enabled: true, requirement: req('slash_damage', 30000), rewardCoins: 650, rewardSp: 1 },
  { id: 'weekly_juice', type: 'weekly', title: 'Full Reservoir', desc: 'Collect 2,000 juice', icon: 'Droplets', enabled: true, requirement: req('juice_collect', 2000), rewardCoins: 550, rewardSp: 1 },
  { id: 'weekly_reslice', type: 'weekly', title: 'No Pulp Wasted', desc: 'Re-slice 100 fruit halves', icon: 'Slice', enabled: true, requirement: req('reslice_halves', 100), rewardCoins: 600, rewardSp: 1 },
  { id: 'monthly_master', type: 'monthly', title: 'Master Season', desc: 'Reach Master rank', icon: 'Crown', enabled: true, requirement: req('reach_master', 25000), rewardCoins: 2000, rewardSp: 3, rewardGems: 60 },
  { id: 'monthly_grandmaster', type: 'monthly', title: 'Grandmaster Season', desc: 'Reach Grandmaster rank', icon: 'Flame', enabled: true, requirement: req('reach_grandmaster', 40000), rewardCoins: 4000, rewardSp: 5, rewardGems: 100 },
  { id: 'monthly_games_25', type: 'monthly', title: 'Season Regular', desc: 'Finish 25 Ranked matches', icon: 'CalendarCheck', enabled: true, requirement: req('monthly_games', 25), rewardCoins: 1200, rewardSp: 2, rewardGems: 15 },
  { id: 'monthly_games_75', type: 'monthly', title: 'Season Veteran', desc: 'Finish 75 Ranked matches', icon: 'BadgeCheck', enabled: true, requirement: req('monthly_games', 75), rewardCoins: 2500, rewardSp: 4, rewardGems: 40 },
  { id: 'monthly_score_50000', type: 'monthly', title: 'Score Vanguard', desc: 'Earn a 50,000 Ranked score', icon: 'Gauge', enabled: true, requirement: req('monthly_score', 50000), rewardCoins: 3000, rewardSp: 4, rewardGems: 60 },
  { id: 'monthly_waves', type: 'monthly', title: 'Unbroken Line', desc: 'Clear 200 Ranked waves', icon: 'Shield', enabled: true, requirement: req('wave_ranked', 200), rewardCoins: 3000, rewardSp: 4, rewardGems: 50 },
];

export const DEFAULT_MISSIONS: CatalogMission[] = [
  ...MISSION_SEEDS.map((mission) => ({ ...mission, type: 'main' as const })),
  { id: 'daily_slice', type: 'daily', title: 'Fresh Cut', desc: 'Slice 20 fruits', icon: 'Slice', enabled: true, requirement: req('slice_any', 20), rewardCoins: 80, rewardSp: 0 },
  { id: 'daily_combo', type: 'daily', title: 'Quick Combo', desc: 'Land 3 combos of 3x or higher', icon: 'Zap', enabled: true, requirement: req('combo_count', 3, { minValue: 3 }), rewardCoins: 100, rewardSp: 0 },
  { id: 'daily_hold', type: 'daily', title: 'Hold the Line', desc: 'Reach wave 5', icon: 'Shield', enabled: true, requirement: req('wave_reach', 5), rewardCoins: 120, rewardSp: 0 },
  { id: 'daily_boss', type: 'daily', title: 'Overlord Patrol', desc: 'Defeat 1 boss', icon: 'Crown', enabled: true, requirement: req('slice_boss', 1), rewardCoins: 150, rewardSp: 0, rewardGems: 1 },
  { id: 'daily_bomb', type: 'daily', title: 'Bomb Squad', desc: 'Parry 3 explosive fruits', icon: 'Bomb', enabled: true, requirement: req('bomb_parry', 3), rewardCoins: 120, rewardSp: 0 },
];

export const DEFAULT_ACHIEVEMENTS: CatalogAchievement[] = [
  { id: 'first_slice', title: 'First Blood', desc: 'Slice your very first fruit', icon: 'Sword', enabled: true, requirement: req('slice_any', 1), rewardCoins: 50, rewardSp: 0, rewardGems: 1, rewardBadge: 'first-cut' },
  { id: 'combo_5', title: 'Combo Artist', desc: 'Execute a 5x or higher combo slice', icon: 'Zap', enabled: true, requirement: req('combo_reach_5', 5), rewardCoins: 100, rewardSp: 0 },
  { id: 'combo_10', title: 'Blade Master', desc: 'Execute a massive 10x combo slice', icon: 'Swords', enabled: true, requirement: req('combo_reach_10', 10), rewardCoins: 250, rewardSp: 1, rewardBadge: 'combo-king' },
  { id: 'fruit_100', title: 'Fruit Peeler', desc: 'Slice 100 total fruits', icon: 'Apple', enabled: true, requirement: req('slice_any', 100), rewardCoins: 150, rewardSp: 0 },
  { id: 'fruit_500', title: 'Juice Tycoon', desc: 'Slice 500 total fruits', icon: 'Droplets', enabled: true, requirement: req('slice_any', 500), rewardCoins: 300, rewardSp: 1 },
  { id: 'fruit_1000', title: 'Legendary Samurai', desc: 'Slice 1,000 total fruits', icon: 'Medal', enabled: true, requirement: req('slice_any', 1000), rewardCoins: 600, rewardSp: 2 },
  { id: 'wave_5', title: 'Hold The Line', desc: 'Survive to wave 5', icon: 'Shield', enabled: true, requirement: req('wave_reach', 5), rewardCoins: 100, rewardSp: 0 },
  { id: 'wave_10', title: 'Citrus Citadel', desc: 'Survive to wave 10', icon: 'Castle', enabled: true, requirement: req('wave_reach', 10), rewardCoins: 250, rewardSp: 1, rewardBadge: 'wall-guard' },
  { id: 'super_juice', title: 'Max Vitamin C', desc: 'Activate Super Juice mode', icon: 'Sparkles', enabled: true, requirement: req('super_activate', 1), rewardCoins: 100, rewardSp: 0 },
  { id: 'untouchable', title: 'Pristine Wall', desc: 'Clear a wave with 100% wall integrity', icon: 'ShieldCheck', enabled: true, requirement: req('perfect_wave', 1), rewardCoins: 150, rewardSp: 0 },
  { id: 'turret_builder', title: 'Fortress Architect', desc: 'Place 3 turrets on your defensive wall', icon: 'Hammer', enabled: true, requirement: req('turret_place', 3), rewardCoins: 150, rewardSp: 0 },
  { id: 'steam_connect', title: 'Steam Cadet', desc: 'Link your Steam profile to Fruit TD', icon: 'Gamepad2', enabled: true, requirement: req('steam_link', 1), rewardCoins: 500, rewardSp: 1, rewardBadge: 'steam-cadet' },
  { id: 'diamond_rank', title: 'Diamond Slicer', desc: 'Reach Diamond on the monthly ranked ladder', icon: 'Diamond', enabled: true, requirement: req('reach_diamond', 15000), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: 'diamond-slicer' },
  { id: 'combo_15', title: 'Chain Commander', desc: 'Reach a 15x combo', icon: 'Link', enabled: true, requirement: req('combo_reach_15', 15), rewardCoins: 350, rewardSp: 1 },
  { id: 'combo_20', title: 'Unbroken Edge', desc: 'Reach a 20x combo', icon: 'Infinity', enabled: true, requirement: req('combo_reach_20', 20), rewardCoins: 600, rewardSp: 2, rewardGems: 5, rewardBadge: 'combo-legend' },
  { id: 'fruit_5000', title: 'Orchard Reaper', desc: 'Slice 5,000 total fruits', icon: 'Skull', enabled: true, requirement: req('slice_any', 5000), rewardCoins: 1500, rewardSp: 3, rewardGems: 15, rewardBadge: 'fruit-reaper' },
  { id: 'fruit_10000', title: 'Extinction Event', desc: 'Slice 10,000 total fruits', icon: 'Flame', enabled: true, requirement: req('slice_any', 10000), rewardCoins: 3000, rewardSp: 5, rewardGems: 30 },
  { id: 'wave_25', title: 'Iron Wall', desc: 'Reach wave 25', icon: 'ShieldCheck', enabled: true, requirement: req('wave_reach', 25), rewardCoins: 500, rewardSp: 1 },
  { id: 'wave_50', title: 'Last Stronghold', desc: 'Reach wave 50', icon: 'Castle', enabled: true, requirement: req('wave_reach', 50), rewardCoins: 1000, rewardSp: 2, rewardGems: 10 },
  { id: 'wave_100', title: 'Century Hold', desc: 'Reach wave 100', icon: 'Landmark', enabled: true, requirement: req('wave_reach', 100), rewardCoins: 2500, rewardSp: 4, rewardGems: 30 },
  { id: 'boss_10', title: 'Boss Breaker', desc: 'Defeat 10 bosses', icon: 'Skull', enabled: true, requirement: req('slice_boss', 10), rewardCoins: 700, rewardSp: 1, rewardBadge: 'boss-breaker' },
  { id: 'boss_50', title: 'Overlord Bane', desc: 'Defeat 50 bosses', icon: 'Crown', enabled: true, requirement: req('slice_boss', 50), rewardCoins: 2000, rewardSp: 3, rewardGems: 25 },
  { id: 'bomb_50', title: 'Blast Proof', desc: 'Parry 50 bombs', icon: 'Bomb', enabled: true, requirement: req('bomb_parry', 50), rewardCoins: 600, rewardSp: 1, rewardBadge: 'bomb-tech' },
  { id: 'reslice_250', title: 'Pulp Specialist', desc: 'Re-slice 250 fruit halves', icon: 'Slice', enabled: true, requirement: req('reslice_halves', 250), rewardCoins: 700, rewardSp: 1 },
  { id: 'damage_100k', title: 'Six Figures of Pain', desc: 'Deal 100,000 slash damage', icon: 'Sword', enabled: true, requirement: req('slash_damage', 100000), rewardCoins: 1000, rewardSp: 2 },
  { id: 'juice_5000', title: 'Reservoir Master', desc: 'Collect 5,000 juice', icon: 'Droplets', enabled: true, requirement: req('juice_collect', 5000), rewardCoins: 800, rewardSp: 2 },
  { id: 'super_25', title: 'Overcharged', desc: 'Activate Super Juice 25 times', icon: 'Sparkles', enabled: true, requirement: req('super_activate', 25), rewardCoins: 750, rewardSp: 2 },
  { id: 'perfect_25', title: 'Flawless Defender', desc: 'Clear 25 perfect waves', icon: 'ShieldCheck', enabled: true, requirement: req('perfect_wave', 25), rewardCoins: 1000, rewardSp: 2, rewardGems: 10, rewardBadge: 'perfect-guard' },
  { id: 'turrets_50', title: 'Defence Network', desc: 'Place 50 turrets', icon: 'TowerControl', enabled: true, requirement: req('turret_place', 50), rewardCoins: 750, rewardSp: 2 },
  { id: 'upgrades_50', title: 'Maximum Output', desc: 'Upgrade turrets 50 times', icon: 'ChevronsUp', enabled: true, requirement: req('turret_upgrade', 50), rewardCoins: 900, rewardSp: 2 },
  { id: 'sales_10', title: 'Field Quartermaster', desc: 'Sell 10 turrets', icon: 'Coins', enabled: true, requirement: req('turret_sell', 10), rewardCoins: 400, rewardSp: 1 },
  { id: 'moves_25', title: 'Mobile Defence', desc: 'Move turrets 25 times', icon: 'Move', enabled: true, requirement: req('turret_move', 25), rewardCoins: 500, rewardSp: 1 },
  { id: 'games_10', title: 'Standing Orders', desc: 'Finish 10 matches', icon: 'Gamepad2', enabled: true, requirement: req('play_games', 10), rewardCoins: 400, rewardSp: 1 },
  { id: 'games_50', title: 'Career Defender', desc: 'Finish 50 matches', icon: 'CalendarCheck', enabled: true, requirement: req('play_games', 50), rewardCoins: 1000, rewardSp: 2, rewardGems: 10 },
  { id: 'games_200', title: 'Orchard Veteran', desc: 'Finish 200 matches', icon: 'BadgeCheck', enabled: true, requirement: req('play_games', 200), rewardCoins: 3000, rewardSp: 5, rewardGems: 40, rewardBadge: 'veteran' },
  { id: 'casual_25', title: 'Casual Specialist', desc: 'Finish 25 Casual matches', icon: 'Leaf', enabled: true, requirement: req('play_casual_games', 25), rewardCoins: 700, rewardSp: 1 },
  { id: 'ranked_25', title: 'Ranked Regular', desc: 'Finish 25 Ranked matches', icon: 'Trophy', enabled: true, requirement: req('play_ranked_games', 25), rewardCoins: 1000, rewardSp: 2, rewardGems: 10 },
  { id: 'arena_25', title: 'Arena Contender', desc: 'Finish 25 Arena matches', icon: 'Swords', enabled: true, requirement: req('play_arena_games', 25), rewardCoins: 900, rewardSp: 2 },
  { id: 'coop_25', title: 'Reliable Partner', desc: 'Finish 25 Co-op matches', icon: 'UsersRound', enabled: true, requirement: req('play_coop_games', 25), rewardCoins: 900, rewardSp: 2 },
  { id: 'topfu_10', title: 'Topfu Disciple', desc: 'Start 10 runs as Topfu', icon: 'UserRound', enabled: true, requirement: req('play_topfu', 10), rewardCoins: 500, rewardSp: 1 },
  { id: 'lagen_10', title: 'Lagen Disciple', desc: 'Start 10 runs as Lagen', icon: 'UserRound', enabled: true, requirement: req('play_lagen', 10), rewardCoins: 500, rewardSp: 1 },
  { id: 'tripos_10', title: 'Triple Path', desc: 'Start 10 runs as Tripos', icon: 'GitBranch', enabled: true, requirement: req('play_tripos', 10), rewardCoins: 600, rewardSp: 1 },
  { id: 'ki_10', title: 'Spirit Path', desc: 'Start 10 runs as Master Ki', icon: 'Sparkles', enabled: true, requirement: req('play_ki', 10), rewardCoins: 600, rewardSp: 1 },
  { id: 'skills_10', title: 'Trained Operative', desc: 'Buy 10 skill ranks', icon: 'BrainCircuit', enabled: true, requirement: req('buy_skill', 10), rewardCoins: 600, rewardSp: 2 },
  { id: 'skins_10', title: 'Blade Collector', desc: 'Buy 10 shop items', icon: 'ShoppingBag', enabled: true, requirement: req('buy_skin', 10), rewardCoins: 700, rewardSp: 2, rewardBadge: 'collector' },
  { id: 'daily_7', title: 'One Week Strong', desc: 'Claim 7 daily bonuses', icon: 'CalendarCheck', enabled: true, requirement: req('claim_daily', 7), rewardCoins: 500, rewardSp: 1, rewardGems: 5 },
  { id: 'daily_30', title: 'Monthly Survivor', desc: 'Claim 30 daily bonuses', icon: 'CalendarDays', enabled: true, requirement: req('claim_daily', 30), rewardCoins: 1500, rewardSp: 3, rewardGems: 25, rewardBadge: 'daily-veteran' },
  { id: 'score_10000', title: 'Five Digit Run', desc: 'Reach 10,000 score in a run', icon: 'Gauge', enabled: true, requirement: req('score_reach', 10000), rewardCoins: 700, rewardSp: 1 },
  { id: 'score_50000', title: 'Score Titan', desc: 'Reach 50,000 score in a run', icon: 'ChartNoAxesCombined', enabled: true, requirement: req('score_reach', 50000), rewardCoins: 2000, rewardSp: 3, rewardGems: 20 },
  { id: 'horde_wave_50', title: 'Horde Holdout', desc: 'Reach wave 50 in Horde', icon: 'UsersRound', enabled: true, requirement: req('wave_reach', 50, { mode: 'horde' }), rewardCoins: 1500, rewardSp: 3, rewardGems: 15, rewardBadge: 'horde-veteran' },
];

export const DEFAULT_BADGES: CatalogBadge[] = [
  { id: 'first-cut', title: 'First Cut', desc: 'Awarded for your first slice', icon: 'Sword', rarity: 'common', enabled: true, requirement: req('slice_any', 1), rewardCoins: 50 },
  { id: 'combo-king', title: 'Combo King', desc: 'Awarded for a 10x combo', icon: 'Zap', rarity: 'rare', enabled: true, requirement: req('combo_reach_10', 10), rewardCoins: 150, rewardGems: 2 },
  { id: 'wall-guard', title: 'Wall Guard', desc: 'Hold the wall to wave 10', icon: 'Shield', rarity: 'rare', enabled: true, requirement: req('wave_reach', 10), rewardCoins: 100, rewardGems: 2 },
  { id: 'steam-cadet', title: 'Steam Cadet', desc: 'Linked Steam account', icon: 'Gamepad2', rarity: 'common', enabled: true, requirement: req('steam_link', 1), rewardCoins: 100 },
  { id: 'bronze-slicer', title: 'Bronze Slicer', desc: 'Finish a Ranked match this month', icon: 'Shield', rarity: 'common', enabled: true, requirement: req('monthly_games', 1), rewardCoins: 100 },
  { id: 'silver-slicer', title: 'Silver Slicer', desc: 'Monthly Silver rank', icon: 'Medal', rarity: 'rare', enabled: true, requirement: req('reach_silver', 1500), rewardCoins: 250, rewardGems: 5 },
  { id: 'gold-slicer', title: 'Gold Slicer', desc: 'Monthly Gold rank', icon: 'Trophy', rarity: 'epic', enabled: true, requirement: req('reach_gold', 4000), rewardCoins: 500, rewardGems: 10 },
  { id: 'diamond-slicer', title: 'Diamond Slicer', desc: 'Monthly Diamond rank', icon: 'Diamond', rarity: 'legendary', enabled: true, requirement: req('reach_diamond', 15000), rewardCoins: 1000, rewardGems: 25 },
  { id: 'daily-regular', title: 'Daily Regular', desc: 'Claim 7 daily bonuses', icon: 'CalendarCheck', rarity: 'rare', enabled: true, requirement: req('claim_daily', 7), rewardCoins: 250, rewardGems: 5 },
  { id: 'combo-legend', title: 'Combo Legend', desc: 'Reach a 20x combo', icon: 'Infinity', rarity: 'epic', enabled: true, requirement: req('combo_reach_20', 20), rewardCoins: 400, rewardGems: 8 },
  { id: 'fruit-reaper', title: 'Fruit Reaper', desc: 'Slice 5,000 fruits', icon: 'Skull', rarity: 'epic', enabled: true, requirement: req('slice_any', 5000), rewardCoins: 600, rewardGems: 10 },
  { id: 'boss-breaker', title: 'Boss Breaker', desc: 'Defeat 10 bosses', icon: 'Crown', rarity: 'epic', enabled: true, requirement: req('slice_boss', 10), rewardCoins: 500, rewardGems: 10 },
  { id: 'bomb-tech', title: 'Bomb Technician', desc: 'Parry 50 bombs', icon: 'Bomb', rarity: 'rare', enabled: true, requirement: req('bomb_parry', 50), rewardCoins: 350, rewardGems: 5 },
  { id: 'perfect-guard', title: 'Perfect Guard', desc: 'Clear 25 perfect waves', icon: 'ShieldCheck', rarity: 'epic', enabled: true, requirement: req('perfect_wave', 25), rewardCoins: 500, rewardGems: 10 },
  { id: 'collector', title: 'Arsenal Collector', desc: 'Buy 10 shop items', icon: 'ShoppingBag', rarity: 'rare', enabled: true, requirement: req('buy_skin', 10), rewardCoins: 400, rewardGems: 5 },
  { id: 'daily-veteran', title: 'Daily Veteran', desc: 'Claim 30 daily bonuses', icon: 'CalendarDays', rarity: 'epic', enabled: true, requirement: req('claim_daily', 30), rewardCoins: 600, rewardGems: 15 },
  { id: 'master-slicer', title: 'Master Slicer', desc: 'Reach Master rank', icon: 'Crown', rarity: 'legendary', enabled: true, requirement: req('reach_master', 25000), rewardCoins: 1000, rewardGems: 25 },
  { id: 'horde-veteran', title: 'Horde Veteran', desc: 'Clear 50 Horde waves', icon: 'UsersRound', rarity: 'legendary', enabled: true, requirement: req('wave_reach', 50, { mode: 'horde' }), rewardCoins: 1000, rewardGems: 25 },
  { id: 'campaign-pathfinder', title: 'Campaign Pathfinder', desc: 'Clear 100 Campaign waves', icon: 'Map', rarity: 'epic', enabled: true, requirement: req('waves_cleared', 100, { mode: 'campaign' }), rewardCoins: 750, rewardGems: 15 },
  { id: 'veteran', title: 'Orchard Veteran', desc: 'Finish 200 matches', icon: 'BadgeCheck', rarity: 'legendary', enabled: true, requirement: req('play_games', 200), rewardCoins: 1000, rewardGems: 25 },
];

export function matchRequirement(
  requirement: Requirement,
  event: GameEvent,
  tiers: RankTier[] = DEFAULT_RANK_TIERS
): { hit: boolean; value: number } {
  const def = requirementById(requirement.type);
  if (!def) return { hit: false, value: 0 };
  if (def.event !== event.type) return { hit: false, value: 0 };

  const mode = requirement.mode || def.mode;
  if (mode && mode !== 'any' && event.mode && event.mode !== mode) return { hit: false, value: 0 };

  const hero = requirement.hero || def.hero;
  if (hero && hero !== 'any' && event.hero && event.hero !== hero) return { hit: false, value: 0 };

  const fruitKind = requirement.fruitKind || def.fruitKind;
  if (fruitKind && fruitKind !== 'any' && event.fruitKind !== fruitKind) return { hit: false, value: 0 };
  if (def.fruitFamily && event.fruitFamily !== def.fruitFamily) return { hit: false, value: 0 };
  if (def.turretKind && event.turretKind !== def.turretKind) return { hit: false, value: 0 };

  if (requirement.type === 'slice_citrus_or_berry') {
    if (event.fruitKind !== 'lemon' && event.fruitKind !== 'strawberry') return { hit: false, value: 0 };
  }

  if (requirement.type === 'perfect_wave') {
    if (event.lives == null || event.maxLives == null || event.lives < event.maxLives) {
      return { hit: false, value: 0 };
    }
  }

  if (def.usesMinValue || requirement.type === 'combo_count') {
    const min = requirement.minValue ?? 3;
    if ((event.combo ?? 0) < min) return { hit: false, value: 0 };
  }

  if (requirement.type === 'combo_reach_5' && (event.combo ?? 0) < 5) return { hit: false, value: 0 };
  if (requirement.type === 'combo_reach_10' && (event.combo ?? 0) < 10) return { hit: false, value: 0 };
  if (requirement.type === 'combo_reach_15' && (event.combo ?? 0) < 15) return { hit: false, value: 0 };
  if (requirement.type === 'combo_reach_20' && (event.combo ?? 0) < 20) return { hit: false, value: 0 };

  if (def.rankId) {
    const needed = rankThreshold(def.rankId, tiers);
    const score = event.score ?? 0;
    if (score < needed) return { hit: false, value: 0 };
    return { hit: true, value: score };
  }

  if (requirement.type === 'earn_score') {
    if (!event.score) return { hit: false, value: 0 };
    return { hit: true, value: event.score };
  }

  if (def.progress === 'max') {
    const field = def.valueField || 'score';
    const value =
      field === 'combo'
        ? event.combo ?? 0
        : field === 'wave'
          ? event.wave ?? 0
          : field === 'score'
            ? event.score ?? 0
            : field === 'streak'
              ? event.streak ?? 0
              : field === 'amount'
                ? event.amount ?? event.count ?? 0
                : event.damage ?? 0;
    return { hit: value > 0, value };
  }

  if (def.valueField === 'damage') return { hit: (event.damage ?? 0) > 0, value: event.damage ?? 1 };
  if (def.valueField === 'amount') return { hit: (event.amount ?? 1) > 0, value: event.amount ?? 1 };
  if (def.valueField === 'score' && event.score) return { hit: true, value: event.score };
  return { hit: true, value: 1 };
}

export function newCatalogId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
