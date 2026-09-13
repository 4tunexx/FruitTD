import type { JuiceBank } from '../game/juice';
import { HEROES, heroDef, xpForNext, type HeroId } from '../game/heroes';
import { MODE_INFO, modeRules } from '../game/modes';
import { SHOP_SKINS, heroLevelFromSave, type GameMode, type SaveData } from '../game/save';
import { SKILLS, type SkillId } from '../game/skills';
import type { GameState } from '../game/state';
import { TURRETS, canPlaceTurret, sellRefund, turretDef, type TurretKind } from '../game/turrets';
import type { WallBase } from '../game/wall';
import { MAX_TOWER_LEVEL, PADS, upgradeCost } from '../game/world';
import {
  fetchLeaderboard,
  fetchMissions,
  claimMission,
  fetchAchievements,
  claimAchievement,
  fetchDailyBonusStatus,
  claimDailyBonus,
  fetchMonthlyRank,
  type LeaderboardEntry,
  type MissionItem,
  type AchievementItem,
  type DailyStatus,
} from '../services/api';
import { getCachedSteamState, syncSteamState, linkSteamAccount } from '../services/steam';
import { showAchievementToast } from '../services/achievements';
import { fetchBadges, type BadgeItem } from '../services/badges';
import { loadLiveConfig, getLiveConfig } from '../services/liveConfig';
import { reportGameEvent } from '../services/progress';
import { rankFromScore } from '../game/requirements';
import { getRewardSvg } from './icons';
import { AdminController } from './admin';

export class Hud {
  private readonly score = document.getElementById('hud-score')!;
  private readonly currency = document.getElementById('hud-currency')!;
  private readonly lives = document.getElementById('hud-lives')!;
  private readonly wave = document.getElementById('hud-wave')!;
  private readonly toast = document.getElementById('hud-toast')!;
  private readonly fps = document.getElementById('hud-fps')!;
  private readonly gameover = document.getElementById('hud-gameover')!;
  private readonly finalScore = document.getElementById('hud-final-score')!;
  private readonly finalWave = document.getElementById('hud-final-wave')!;
  private readonly upgrade = document.getElementById('btn-upgrade')!;
  private readonly sell = document.getElementById('btn-sell')!;
  private readonly move = document.getElementById('btn-move')!;
  private readonly place = document.getElementById('btn-place')!;
  private readonly toggle = document.getElementById('btn-toggle')!;
  private readonly pause = document.getElementById('hud-pause')!;
  private readonly pick = document.getElementById('hud-pick')!;
  private readonly juice = document.getElementById('hud-juice')!;
  private readonly shop = document.getElementById('hud-shop')!;
  private readonly hero = document.getElementById('hud-hero')!;
  private readonly hpFill = document.getElementById('hud-hp-fill')!;
  private readonly combo = document.getElementById('hud-combo')!;
  private readonly heroPick = document.getElementById('hero-pick')!;
  private readonly heroBlurb = document.getElementById('hero-blurb')!;
  private readonly saveLine = document.getElementById('save-line')!;
  private readonly superFill = document.getElementById('super-fill')!;
  private readonly superBtn = document.getElementById('btn-super') as HTMLButtonElement;
  private readonly points = document.getElementById('hud-points')!;
  private readonly modeLabel = document.getElementById('player-mode')!;
  private readonly startGate = document.getElementById('hud-start')!;
  private readonly waveProg = document.getElementById('hud-wave-prog');
  private readonly waveProgFill = document.getElementById('hud-wave-prog-fill');
  private readonly steamBadge = document.getElementById('steam-badge');
  private readonly dailyChipDot = document.getElementById('daily-chip-dot');
  private readonly questsAlert = document.getElementById('quests-alert');
  private readonly playerName = document.getElementById('player-name');
  private readonly playerAvatar = document.getElementById('player-avatar') as HTMLImageElement | null;

  private currentSave: SaveData | null = null;
  private lastToast = '';
  private currentLbMode = 'ranked';
  private dailyCountdownTimer: number | null = null;
  private readonly adminController: AdminController;

  onPlace: ((kind: TurretKind) => void) | null = null;
  onHero: ((id: HeroId) => void) | null = null;
  onMode: ((id: GameMode) => void) | null = null;
  onBuySkin: ((id: string) => void) | null = null;
  onBuySkill: ((id: SkillId) => void) | null = null;
  onRename: ((name: string) => void) | null = null;
  onSuper: (() => void) | null = null;
  onSaveUpdate: ((save: SaveData) => void) | null = null;

  constructor() {
    this.place.classList.add('hidden');
    this.shop.classList.add('hidden');

    for (const def of TURRETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.turret = def.kind;
      btn.className = 'turret-btn';
      btn.addEventListener('click', () => this.onPlace?.(def.kind));
      this.shop.appendChild(btn);
    }

    this.superBtn.addEventListener('click', () => this.onSuper?.());

    // Navigation Tabs
    document.querySelectorAll<HTMLButtonElement>('#menu-tabs [data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page || 'play';
        this.showPage(page);
        if (page === 'leaderboard') this.loadLeaderboard();
        if (page === 'quests') this.loadQuests();
      });
    });

    const nameInput = document.getElementById('name-input') as HTMLInputElement | null;
    nameInput?.addEventListener('change', () => this.onRename?.(nameInput.value.trim() || 'Slicer'));

    const refreshDailyFromAdmin = () => {
      this.checkDailyBonus();
      void this.refreshMonthlyRank();
      const modal = document.getElementById('modal-daily');
      if (modal && !modal.classList.contains('hidden')) {
        void this.openDailyModal();
      }
    };
    this.adminController = new AdminController(refreshDailyFromAdmin, refreshDailyFromAdmin);

    this.initModals();
    this.initLeaderboardFilters();
    this.initQuestsSubtabs();
    this.initSteamIntegration();
    this.checkDailyBonus();
    void loadLiveConfig().then(() => this.refreshMonthlyRank());
  }

  showMenu(open: boolean): void {
    this.startGate.classList.toggle('hidden', !open);
    if (open) {
      this.showPause(false);
      this.checkDailyBonus();
    }
  }

  showPause(open: boolean): void {
    this.pause.classList.toggle('hidden', !open);
    this.pause.classList.toggle('flex', open);
  }

  showPage(page: string): void {
    for (const el of document.querySelectorAll('.menu-page')) el.classList.add('hidden');
    document.getElementById(`page-${page}`)?.classList.remove('hidden');
    document.querySelectorAll('#menu-tabs .menu-tab').forEach((btn) => {
      btn.classList.toggle('is-on', (btn as HTMLElement).dataset.page === page);
    });
  }

  mountMeta(save: SaveData): void {
    this.currentSave = save;
    this.mountHeroes(save);
    this.mountModes(save.mode);
    this.mountShop(save);
    this.mountSkills(save);

    if (this.playerName) this.playerName.textContent = save.nickname;
    if (this.playerAvatar) this.playerAvatar.src = save.avatar;

    const nameInput = document.getElementById('name-input') as HTMLInputElement | null;
    if (nameInput) nameInput.value = save.nickname;
    void this.refreshMonthlyRank();
  }

  async refreshMonthlyRank(): Promise<void> {
    const el = document.getElementById('player-rank');
    const data = await fetchMonthlyRank();
    const fallback = rankFromScore(0, getLiveConfig().ranks);
    const rank = data?.rank || fallback;
    if (el) {
      el.textContent = rank.title;
      el.style.color = rank.color;
      el.style.borderColor = rank.color;
      el.title = data
        ? `Monthly ${rank.title} · ${data.score.toLocaleString()} pts`
        : `Monthly ${rank.title}`;
    }
  }

  mountHeroes(save: SaveData): void {
    this.heroPick.innerHTML = '';
    for (const hero of HEROES) {
      const lv = heroLevelFromSave(save, hero.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.hero = hero.id;
      btn.className = 'hero-btn';
      btn.innerHTML = `<p class="text-sm font-black">${hero.name}</p><p class="text-[11px] text-zinc-400">${hero.title} · Lv ${lv}</p>`;
      btn.addEventListener('click', () => this.onHero?.(hero.id));
      this.heroPick.appendChild(btn);
    }
    this.refreshHeroPick(save.hero, save);
  }

  mountModes(mode: GameMode): void {
    const box = document.getElementById('mode-pick')!;
    box.innerHTML = '';
    for (const m of MODE_INFO) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mode-btn${m.id === mode ? ' is-on' : ''}`;
      btn.innerHTML = `<p class="font-black">${m.name}</p><p class="text-[11px] text-zinc-400">${m.blurb}</p>`;
      btn.addEventListener('click', () => this.onMode?.(m.id));
      box.appendChild(btn);
    }
    this.modeLabel.textContent = modeRules(mode).name;
  }

  mountShop(save: SaveData): void {
    const coinEl = document.getElementById('shop-coins');
    if (coinEl) coinEl.textContent = `${save.coins} coins`;
    const box = document.getElementById('skin-shop')!;
    box.innerHTML = '';
    for (const skin of SHOP_SKINS) {
      const owned = save.ownedSkins.includes(skin.id);
      const eq = save.bladeSkin === skin.id || save.wallSkin === skin.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `skin-btn${eq ? ' is-on' : ''}`;
      btn.innerHTML = `<p class="font-black">${skin.name}</p><p class="text-[11px] text-zinc-400">${
        owned ? (eq ? 'Equipped' : 'Owned — click to use') : `Buy  ${skin.cost} coins`
      }</p>`;
      btn.addEventListener('click', () => this.onBuySkin?.(skin.id));
      box.appendChild(btn);
    }
  }

  mountSkills(save: SaveData): void {
    const spEl = document.getElementById('skill-points');
    if (spEl) spEl.textContent = `${save.skillPoints} points`;
    const box = document.getElementById('skill-tree')!;
    box.innerHTML = '';
    for (const skill of SKILLS) {
      const rank = save.skills[skill.id] ?? 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-btn';
      btn.innerHTML = `<p class="font-black">${skill.name}  ${rank}/${skill.max}</p><p class="text-[11px] text-zinc-400">${skill.blurb}</p>`;
      btn.disabled = save.skillPoints <= 0 || rank >= skill.max;
      btn.addEventListener('click', () => this.onBuySkill?.(skill.id as SkillId));
      box.appendChild(btn);
    }
  }

  refreshHeroPick(id: HeroId, save: SaveData): void {
    const hero = heroDef(id);
    const lv = heroLevelFromSave(save, id);
    this.heroBlurb.innerHTML = `<b>${hero.name}</b> — ${hero.blurb}<br>Mouse: ${hero.mouse}<br>Touch: ${hero.touch}`;
    this.saveLine.textContent = `Best ${save.highScore} · wave ${save.bestWave} · ${save.coins} coins · ${hero.name} Lv ${lv}`;
    for (const btn of this.heroPick.querySelectorAll('button')) {
      btn.classList.toggle('is-on', btn.dataset.hero === id);
    }
  }

  sync(
    state: GameState,
    wall: WallBase,
    bank: JuiceBank,
    fps: number,
    onToast: (text: string) => void,
    points = 0,
    playActive = false
  ): void {
    this.score.textContent = String(state.score);
    this.currency.textContent = `$${state.currency}`;
    this.lives.textContent = String(state.lives);
    this.wave.textContent = String(state.wave);
    this.fps.textContent = `${Math.round(fps)} FPS`;
    this.juice.textContent = `🍋${bank.yellow}  🍓${bank.pink}  🍊${bank.orange}  🥝${bank.green}`;
    this.points.textContent = points > 0 ? `✨ ${points} skill point${points !== 1 ? 's' : ''} available` : '';
    const hero = heroDef(state.hero);
    const next = xpForNext(state.heroLevel);
    this.hero.textContent = `${hero.name}  ·  Lv ${state.heroLevel}/5  ·  XP ${state.heroXp}/${next}`;
    this.hpFill.style.width = `${Math.max(0, (state.lives / Math.max(1, state.maxLives)) * 100)}%`;
    this.combo.textContent = state.combo > 1 ? `× ${state.combo} COMBO` : '';
    this.superFill.style.height = `${Math.min(100, state.superJuice)}%`;
    this.superBtn.disabled = state.superJuice < 100;
    this.modeLabel.textContent = modeRules(state.mode).name;

    // Wave progress bar
    if (this.waveProgFill && state.waveTotal > 0 && state.waveSpawning) {
      const pct = Math.min(100, (state.waveKilled / state.waveTotal) * 100);
      this.waveProgFill.style.width = `${pct}%`;
      if (this.waveProg) this.waveProg.classList.remove('hidden');
    } else if (this.waveProg) {
      this.waveProg.classList.add('hidden');
    }

    const slot = wall.selectedSlot();
    const pad = PADS[slot.index];
    if (wall.moving) {
      this.pick.textContent = 'Click a blue pad to move · click again to cancel';
      this.shop.classList.add('hidden');
      this.upgrade.classList.add('hidden');
      this.sell.classList.add('hidden');
      this.toggle.classList.add('hidden');
      this.move.classList.remove('hidden');
      this.move.textContent = '↩ Cancel move';
    } else if (slot.main) {
      this.pick.textContent = `Main tower  ·  Lv ${slot.level}/${MAX_TOWER_LEVEL}`;
      this.shop.classList.add('hidden');
      this.upgrade.classList.remove('hidden');
      this.sell.classList.add('hidden');
      this.move.classList.add('hidden');
      this.toggle.classList.add('hidden');
      this.setUpgrade(state.currency, slot.level, 'main');
    } else if (slot.filled && slot.kind && slot.kind !== 'main') {
      const def = turretDef(slot.kind);
      this.pick.textContent = `${def.name}  ·  Lv ${slot.level}/${MAX_TOWER_LEVEL}`;
      this.shop.classList.add('hidden');
      this.upgrade.classList.remove('hidden');
      this.sell.classList.remove('hidden');
      this.sell.textContent = `💰 Sell  +$${sellRefund(slot.kind, slot.level)}`;
      this.move.classList.remove('hidden');
      this.move.textContent = 'Move  M';
      this.toggle.classList.toggle('hidden', slot.kind !== 'blender');
      this.setUpgrade(state.currency, slot.level, def.name);
    } else {
      this.pick.textContent = pad.floor ? 'Floor pad — pit / blade' : 'Wall pad — turret';
      this.shop.classList.remove('hidden');
      this.upgrade.classList.add('hidden');
      this.sell.classList.add('hidden');
      this.move.classList.add('hidden');
      this.toggle.classList.add('hidden');
      for (const btn of this.shop.querySelectorAll('button')) {
        const kind = btn.dataset.turret as TurretKind;
        const def = turretDef(kind);
        const affordable = state.currency >= def.cost;
        const fits = canPlaceTurret(kind, pad);
        btn.disabled = !fits || !affordable;
        btn.textContent = `${def.name}  $${def.cost}${fits ? '' : '  (floor only)'}${!affordable && fits ? '  💸' : ''}`;
      }
    }

    if (state.toast && state.toast !== '__restart__' && state.toast !== this.lastToast) {
      this.lastToast = state.toast;
      onToast(state.toast);
    }
    if (state.toastTimer > 0 && state.toast && state.toast !== '__restart__') {
      this.toast.textContent = state.toast;
      this.toast.classList.remove('hidden');
    } else {
      this.toast.classList.add('hidden');
      this.lastToast = '';
    }

    const showOver = !state.running && playActive;
    this.gameover.classList.toggle('hidden', !showOver);
    this.gameover.classList.toggle('flex', showOver);
    if (showOver) {
      this.finalScore.textContent = `${state.score.toLocaleString()}`;
      if (this.finalWave) this.finalWave.textContent = `Wave ${state.wave}`;
    }
  }

  private setUpgrade(money: number, level: number, label: string): void {
    const cost = upgradeCost(level);
    if (cost == null) {
      this.upgrade.textContent = `${label} maxed  ★ Lv 5`;
      this.upgrade.toggleAttribute('disabled', true);
      return;
    }
    this.upgrade.textContent = `⬆ Level up ${label}  $${cost}`;
    this.upgrade.toggleAttribute('disabled', money < cost);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEADERBOARDS
  // ══════════════════════════════════════════════════════════════════════════
  private initLeaderboardFilters(): void {
    const filterBtns = document.querySelectorAll('#lb-mode-filter .filter-pill');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentLbMode = (btn as HTMLElement).dataset.mode || 'ranked';
        this.loadLeaderboard();
      });
    });
  }

  async loadLeaderboard(): Promise<void> {
    const listEl = document.getElementById('lb-entries-list');
    const userCard = document.getElementById('lb-user-card');
    if (!listEl) return;

    listEl.innerHTML = '<div class="lb-loading">Connecting to MongoDB Atlas...</div>';

    const res = await fetchLeaderboard(this.currentLbMode, 50);
    if (!res || !res.leaderboard || res.leaderboard.length === 0) {
      listEl.innerHTML = '<div class="lb-loading">No scores recorded for this mode yet. Be the first!</div>';
      if (userCard) userCard.classList.add('hidden');
      return;
    }

    listEl.innerHTML = '';
    const myId = this.currentSave ? this.currentSave.nickname : '';

    res.leaderboard.forEach((entry: LeaderboardEntry) => {
      const row = document.createElement('div');
      const isMe = entry.nickname === myId;
      row.className = `lb-row${isMe ? ' is-me' : ''}`;

      let rankDisplay = `#${entry.rank}`;
      let rankClass = '';
      if (entry.rank === 1) {
        rankDisplay = '🥇';
        rankClass = 'lb-rank--1';
      } else if (entry.rank === 2) {
        rankDisplay = '🥈';
        rankClass = 'lb-rank--2';
      } else if (entry.rank === 3) {
        rankDisplay = '🥉';
        rankClass = 'lb-rank--3';
      }

      const avatarSrc = entry.steamAvatar || entry.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%231d4ed8"/></svg>';
      const heroDefItem = HEROES.find((h) => h.id === entry.hero);

      row.innerHTML = `
        <span class="lb-rank ${rankClass}">${rankDisplay}</span>
        <div class="lb-player-cell">
          <img class="lb-avatar" src="${avatarSrc}" alt="" />
          <span class="lb-name">${entry.steamPersona || entry.nickname}</span>
          ${entry.steamId ? '<span class="steam-pill" title="Verified Steam User">STEAM</span>' : ''}
        </div>
        <span class="text-xs font-semibold text-slate-400">${heroDefItem?.name || entry.hero}</span>
        <span class="text-xs font-bold text-slate-300">W${entry.wave}</span>
        <span class="lb-score-val">${entry.score.toLocaleString()}</span>
      `;
      listEl.appendChild(row);
    });

    if (userCard && res.userRank) {
      userCard.classList.remove('hidden');
      const myRank = document.getElementById('lb-my-rank');
      const myName = document.getElementById('lb-my-name');
      const myWave = document.getElementById('lb-my-wave');
      const myScore = document.getElementById('lb-my-score');
      if (myRank) myRank.textContent = `#${res.userRank.rank}`;
      if (myName) myName.textContent = myId || 'You';
      if (myWave) myWave.textContent = `Wave ${res.userRank.wave}`;
      if (myScore) myScore.textContent = `${res.userRank.score.toLocaleString()} pts`;
    } else if (userCard) {
      userCard.classList.add('hidden');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // QUESTS (MISSIONS & ACHIEVEMENTS)
  // ══════════════════════════════════════════════════════════════════════════
  private initQuestsSubtabs(): void {
    document.querySelectorAll<HTMLButtonElement>('.quests-subtabs .subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.sub;
        document.querySelectorAll('.quests-subtabs .subtab').forEach((other) => {
          other.classList.toggle('is-active', other === btn);
        });
        document.querySelectorAll('.quests-subcontent').forEach((el) => {
          el.classList.toggle('hidden', el.id !== `subpage-${target}`);
        });
      });
    });
  }

  async loadQuests(): Promise<void> {
    await Promise.all([this.renderMissions(), this.renderAchievements(), this.renderBadges(), this.renderRanks()]);
  }

  private async renderMissions(): Promise<void> {
    const listEl = document.getElementById('missions-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="lb-loading">Syncing daily missions...</div>';
    const res = await fetchMissions();

    if (!res || !res.missions) {
      listEl.innerHTML = '<div class="lb-loading">Could not load missions. Check network connection.</div>';
      return;
    }

    listEl.innerHTML = '';
    let hasClaimable = false;

    res.missions.forEach((m: MissionItem) => {
      if (m.completed && !m.claimed) hasClaimable = true;
      const card = document.createElement('div');
      card.className = 'mission-card';

      const pct = Math.min(100, (m.progress / m.goal) * 100);
      const rewardStr = `${m.rewardCoins} coins${m.rewardSp ? ` + ${m.rewardSp} SP` : ''}${m.rewardBadge ? ` · ${m.rewardBadge}` : ''}`;

      card.innerHTML = `
        <div class="mission-top">
          <div class="mission-icon">${m.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="mission-title-row">
              <div class="mission-title">${m.title}</div>
              <span class="mission-type-pill mission-type-pill--${m.type}">${m.type}</span>
            </div>
            <div class="mission-desc">${m.desc}</div>
          </div>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="mission-bottom">
          <span class="text-xs text-slate-400 font-bold">${m.progress} / ${m.goal}</span>
          <span class="reward-badge">${rewardStr}</span>
          <button class="claim-btn" ${!m.completed || m.claimed ? 'disabled' : ''}>
            ${m.claimed ? 'Claimed' : m.completed ? 'Claim' : 'In Progress'}
          </button>
        </div>
      `;

      const claimBtn = card.querySelector('.claim-btn') as HTMLButtonElement;
      if (m.completed && !m.claimed) {
        claimBtn.addEventListener('click', async () => {
          claimBtn.disabled = true;
          claimBtn.textContent = 'Claiming...';
          const claimRes = await claimMission(m.id);
          if (claimRes && this.currentSave) {
            this.currentSave.coins += claimRes.rewardCoins;
            this.currentSave.skillPoints += claimRes.rewardSp;
            this.onSaveUpdate?.(this.currentSave);
            this.mountMeta(this.currentSave);
            showAchievementToast('Mission Complete!', m.title, '🎁', `${claimRes.rewardCoins} Coins`);
            void reportGameEvent({ type: 'mission_claim' });
            this.renderMissions();
            this.renderBadges();
          }
        });
      }

      listEl.appendChild(card);
    });

    if (this.questsAlert) {
      this.questsAlert.classList.toggle('hidden', !hasClaimable);
    }
  }

  private async renderAchievements(): Promise<void> {
    const listEl = document.getElementById('achievements-list');
    const statsEl = document.getElementById('ach-stats-text');
    const claimableEl = document.getElementById('ach-claimable-text');
    if (!listEl) return;

    listEl.innerHTML = '<div class="lb-loading">Syncing achievements...</div>';
    const res = await fetchAchievements();

    if (!res || !res.achievements) {
      listEl.innerHTML = '<div class="lb-loading">Could not load achievements.</div>';
      return;
    }

    if (statsEl) statsEl.textContent = `Unlocked: ${res.stats.unlocked} / ${res.stats.total}`;
    if (claimableEl) {
      claimableEl.textContent = res.stats.claimable > 0 ? `${res.stats.claimable} Claimable Rewards!` : '';
    }

    listEl.innerHTML = '';
    res.achievements.forEach((ach: AchievementItem) => {
      const card = document.createElement('div');
      card.className = `ach-card${ach.unlocked ? ' is-unlocked' : ''}`;

      const pct = Math.min(100, (ach.progress / ach.maxProgress) * 100);
      const rewardStr = `${ach.rewardCoins} 🪙${ach.rewardSp ? ` + ${ach.rewardSp} ⚡` : ''}`;

      card.innerHTML = `
        <div class="ach-top">
          <div class="ach-icon">${ach.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="ach-title">${ach.title}</div>
            <div class="ach-desc">${ach.desc}</div>
          </div>
        </div>
        <div class="bar-track">
          <div class="bar-fill bar-fill--amber" style="width: ${pct}%"></div>
        </div>
        <div class="ach-bottom">
          <span class="text-xs text-slate-400 font-bold">${ach.progress} / ${ach.maxProgress}</span>
          <span class="reward-badge">${rewardStr}</span>
          <button class="claim-btn" ${!ach.unlocked || ach.claimed ? 'disabled' : ''}>
            ${ach.claimed ? 'Claimed' : ach.unlocked ? 'Claim' : 'Locked'}
          </button>
        </div>
      `;

      const claimBtn = card.querySelector('.claim-btn') as HTMLButtonElement;
      if (ach.unlocked && !ach.claimed) {
        claimBtn.addEventListener('click', async () => {
          claimBtn.disabled = true;
          claimBtn.textContent = 'Claiming...';
          const claimRes = await claimAchievement(ach.id);
          if (claimRes && this.currentSave) {
            this.currentSave.coins += claimRes.rewardCoins;
            this.currentSave.skillPoints += claimRes.rewardSp;
            this.onSaveUpdate?.(this.currentSave);
            this.mountMeta(this.currentSave);
            showAchievementToast('Trophy Claimed!', ach.title, '🏆', `${claimRes.rewardCoins} Coins`);
            this.renderAchievements();
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  private async renderBadges(): Promise<void> {
    const listEl = document.getElementById('badges-list');
    const statsEl = document.getElementById('badge-stats-text');
    if (!listEl) return;
    listEl.innerHTML = '<div class="lb-loading">Syncing badges...</div>';
    const res = await fetchBadges();
    if (!res?.badges) {
      listEl.innerHTML = '<div class="lb-loading">Could not load badges.</div>';
      return;
    }
    if (statsEl) statsEl.textContent = `Unlocked: ${res.unlocked} / ${res.badges.length}`;
    listEl.innerHTML = '';
    res.badges.forEach((badge: BadgeItem) => {
      const card = document.createElement('div');
      const pct = Math.min(100, (badge.progress / badge.maxProgress) * 100);
      card.className = `badge-card rarity-${badge.rarity}${badge.unlocked ? ' is-unlocked' : ''}`;
      card.innerHTML = `
        <div class="ach-top">
          <div class="ach-icon">${badge.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="ach-title">${badge.title}</div>
            <div class="ach-desc">${badge.desc}</div>
          </div>
          <span class="badge-rarity">${badge.rarity}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="ach-bottom">
          <span class="text-xs text-slate-400 font-bold">${badge.progress} / ${badge.maxProgress}</span>
          <span class="reward-badge">${badge.unlocked ? 'Unlocked' : 'In progress'}</span>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  private async renderRanks(): Promise<void> {
    const currentEl = document.getElementById('rank-current-card');
    const tiersEl = document.getElementById('rank-tiers-list');
    const monthlyEl = document.getElementById('rank-monthly-list');
    if (!currentEl || !tiersEl) return;

    const [rank, monthlyBoard] = await Promise.all([fetchMonthlyRank(), fetchLeaderboard('monthly', 8)]);
    const tiers = [...(getLiveConfig().ranks || [])].sort((a, b) => a.minScore - b.minScore);
    const current = rank?.rank || rankFromScore(0, tiers);
    const next = rank?.next || tiers.find((t) => t.minScore > current.minScore) || null;
    const score = rank?.score || 0;
    const span = next ? Math.max(1, next.minScore - current.minScore) : 1;
    const into = next ? Math.min(span, Math.max(0, score - current.minScore)) : span;
    const pct = next ? Math.min(100, (into / span) * 100) : 100;

    currentEl.innerHTML = `
      <div class="rank-now-icon" style="color:${current.color};border-color:${current.color}">${current.icon}</div>
      <div class="flex-1 min-w-0">
        <p class="rank-now-title" style="color:${current.color}">${current.title}</p>
        <p class="mission-desc">${rank?.season || 'This month'} · ${score.toLocaleString()} seasonal points</p>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${current.color}"></div></div>
        <p class="text-xs text-slate-400 font-bold mt-1">${
          next ? `${score.toLocaleString()} / ${next.minScore.toLocaleString()} to ${next.title}` : 'Top monthly tier reached'
        }</p>
      </div>
    `;

    tiersEl.innerHTML = tiers
      .map((tier) => {
        const reached = score >= tier.minScore;
        return `<div class="rank-tier-row${reached ? ' is-reached' : ''}${tier.id === current.id ? ' is-current' : ''}">
          <span class="rank-tier-icon" style="color:${tier.color}">${tier.icon}</span>
          <strong style="color:${tier.color}">${tier.title}</strong>
          <span>${tier.minScore.toLocaleString()} pts</span>
        </div>`;
      })
      .join('');

    if (monthlyEl) {
      monthlyEl.innerHTML = '';
      (monthlyBoard?.leaderboard || []).forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'mission-card';
        row.innerHTML = `
          <div class="mission-top">
            <div class="mission-icon">#${entry.rank}</div>
            <div class="flex-1 min-w-0">
              <div class="mission-title">${entry.steamPersona || entry.nickname}</div>
              <div class="mission-desc">Wave ${entry.wave} · ${entry.score.toLocaleString()} pts</div>
            </div>
          </div>`;
        monthlyEl.appendChild(row);
      });
      if (!monthlyBoard?.leaderboard?.length) {
        monthlyEl.innerHTML = '<div class="lb-loading">No monthly ranked scores yet. Play Ranked to climb Bronze → Diamond.</div>';
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DAILY BONUS MODAL
  // ══════════════════════════════════════════════════════════════════════════
  private setDailyClaimable(canClaim: boolean): void {
    if (this.dailyChipDot) this.dailyChipDot.classList.toggle('hidden', !canClaim);
    document.getElementById('daily-btn-badge')?.classList.toggle('hidden', !canClaim);
  }

  private async checkDailyBonus(): Promise<void> {
    const status = await fetchDailyBonusStatus();
    this.setDailyClaimable(!!status?.canClaim);
  }

  private formatCountdown(canClaim: boolean): string {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const ms = Math.max(0, next - now.getTime());
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    const clock = `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
    return canClaim ? `Reward ready — next reset in ${clock}` : `Next reward in ${clock}`;
  }

  private startDailyCountdown(canClaim: boolean): void {
    this.stopDailyCountdown();
    const tick = () => {
      const el = document.getElementById('daily-countdown-text');
      if (el) el.textContent = this.formatCountdown(canClaim);
    };
    tick();
    this.dailyCountdownTimer = window.setInterval(tick, 1000);
  }

  private stopDailyCountdown(): void {
    if (this.dailyCountdownTimer != null) {
      window.clearInterval(this.dailyCountdownTimer);
      this.dailyCountdownTimer = null;
    }
  }

  private renderDailyCards(status: DailyStatus, celebrateDay?: number): void {
    const calendar = document.getElementById('daily-calendar');
    if (!calendar) return;
    calendar.innerHTML = '';

    status.rewards.forEach((tier) => {
      const isCurrent = tier.day === status.streak;
      const isClaimed = tier.day < status.streak || (!status.canClaim && tier.day === status.streak);
      const isReady = isCurrent && status.canClaim;
      const isDay7 = tier.day === 7;
      const icon = getRewardSvg(tier.iconType, tier.coins);
      const extras: string[] = [];
      if (tier.skillPoints > 0) extras.push(`+${tier.skillPoints} SP`);
      if (tier.skinUnlock) extras.push('Legendary unlock');

      const tag = isClaimed ? 'CLAIMED' : isReady ? 'READY!' : `DAY ${tier.day}`;
      const tagClass = isClaimed ? 'tag-claimed' : isReady ? 'tag-ready' : 'tag-locked';
      const card = document.createElement('div');
      card.className = `daily-reward-card${isCurrent ? ' is-current' : ''}${isClaimed ? ' is-claimed' : ''}${isDay7 ? ' is-day-7' : ''}${celebrateDay === tier.day ? ' is-claiming' : ''}`;
      card.innerHTML = `
        <span class="daily-day-label">Day ${tier.day}</span>
        <div class="daily-reward-svg">${icon}</div>
        <span class="daily-reward-amount">+${tier.coins.toLocaleString()}</span>
        <span class="daily-reward-extra">${extras.join(' · ') || tier.label}</span>
        <span class="daily-status-tag ${tagClass}">${tag}</span>
      `;
      calendar.appendChild(card);
    });
  }

  private async openDailyModal(celebrateDay?: number): Promise<void> {
    const modal = document.getElementById('modal-daily');
    const calendar = document.getElementById('daily-calendar');
    const claimBtn = document.getElementById('btn-claim-daily') as HTMLButtonElement | null;
    const streakCount = document.getElementById('daily-streak-count');
    if (!modal || !calendar) return;

    modal.classList.remove('hidden');
    calendar.innerHTML = '<div class="lb-loading">Loading daily bonus...</div>';

    const status: DailyStatus | null = await fetchDailyBonusStatus();
    if (!status) {
      calendar.innerHTML = '<div class="lb-loading">Could not check daily bonus.</div>';
      return;
    }

    this.setDailyClaimable(status.canClaim);
    if (streakCount) streakCount.textContent = `${status.streak} Day${status.streak !== 1 ? 's' : ''}`;
    this.renderDailyCards(status, celebrateDay);
    this.startDailyCountdown(status.canClaim);

    if (claimBtn) {
      claimBtn.disabled = !status.canClaim;
      claimBtn.textContent = status.canClaim ? 'Claim Daily Reward' : 'Claimed Today — come back tomorrow';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEAM LINK MODAL
  // ══════════════════════════════════════════════════════════════════════════
  private async initSteamIntegration(): Promise<void> {
    const state = await syncSteamState();
    if (state.linked) {
      if (this.steamBadge) this.steamBadge.classList.remove('hidden');
      if (this.playerName && state.personaName) this.playerName.textContent = state.personaName;
      if (this.playerAvatar && state.avatar) this.playerAvatar.src = state.avatar;
    }
  }

  private openSteamModal(): void {
    const modal = document.getElementById('modal-steam');
    const steamState = getCachedSteamState();
    const profileCard = document.getElementById('steam-profile-card');
    const form = document.getElementById('steam-link-form');
    const errEl = document.getElementById('steam-link-error');

    if (errEl) errEl.classList.add('hidden');
    modal?.classList.remove('hidden');

    if (steamState.linked) {
      form?.classList.add('hidden');
      profileCard?.classList.remove('hidden');
      const nameEl = document.getElementById('steam-card-name');
      const idEl = document.getElementById('steam-card-id');
      const avatarEl = document.getElementById('steam-card-avatar') as HTMLImageElement | null;
      if (nameEl && steamState.personaName) nameEl.textContent = steamState.personaName;
      if (idEl && steamState.steamId) idEl.textContent = `SteamID64: ${steamState.steamId}`;
      if (avatarEl && steamState.avatar) avatarEl.src = steamState.avatar;
    } else {
      form?.classList.remove('hidden');
      profileCard?.classList.add('hidden');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL EVENT LISTENERS
  // ══════════════════════════════════════════════════════════════════════════
  private initModals(): void {
    // Daily Modal Triggers
    document.getElementById('btn-daily-chip')?.addEventListener('click', () => this.openDailyModal());
    document.getElementById('btn-open-daily')?.addEventListener('click', () => this.openDailyModal());
    document.getElementById('btn-close-daily')?.addEventListener('click', () => {
      this.stopDailyCountdown();
      document.getElementById('modal-daily')?.classList.add('hidden');
    });

    // Claim Daily Action
    document.getElementById('btn-claim-daily')?.addEventListener('click', async () => {
      const claimBtn = document.getElementById('btn-claim-daily') as HTMLButtonElement | null;
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.textContent = 'Claiming...';
      }

      const res = await claimDailyBonus();
      if (res && this.currentSave) {
        this.currentSave.coins += res.reward.coins;
        this.currentSave.skillPoints += res.reward.skillPoints;
        if (res.reward.skinUnlock && !this.currentSave.ownedSkins.includes(res.reward.skinUnlock)) {
          this.currentSave.ownedSkins.push(res.reward.skinUnlock);
        }
        this.onSaveUpdate?.(this.currentSave);
        this.mountMeta(this.currentSave);
        showAchievementToast('Daily Login Reward!', res.reward.label, getRewardSvg(res.reward.iconType, res.reward.coins));
        void reportGameEvent({ type: 'daily_claim', streak: res.streak });
        this.setDailyClaimable(false);
        await this.openDailyModal(res.streak);
      } else if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.textContent = 'Claim Daily Reward';
      }
    });

    // Steam Modal Triggers
    document.getElementById('btn-steam-chip')?.addEventListener('click', () => this.openSteamModal());
    document.getElementById('btn-open-steam-shop')?.addEventListener('click', () => this.openSteamModal());
    document.getElementById('btn-close-steam')?.addEventListener('click', () => {
      document.getElementById('modal-steam')?.classList.add('hidden');
    });

    // Submit Steam Link
    document.getElementById('btn-submit-steam')?.addEventListener('click', async () => {
      const input = document.getElementById('steam-input') as HTMLInputElement | null;
      const errEl = document.getElementById('steam-link-error');
      const submitBtn = document.getElementById('btn-submit-steam') as HTMLButtonElement | null;
      const val = input?.value.trim();

      if (!val) {
        if (errEl) {
          errEl.textContent = 'Please enter a SteamID64, profile link, or custom URL.';
          errEl.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connecting Steam...';
      }

      const res = await linkSteamAccount(val);
      if (res.success && res.profile) {
        if (this.steamBadge) this.steamBadge.classList.remove('hidden');
        if (this.playerName) this.playerName.textContent = res.profile.personaName;
        if (this.playerAvatar) this.playerAvatar.src = res.profile.avatarFull;
        if (this.currentSave) {
          this.currentSave.nickname = res.profile.personaName;
          this.currentSave.avatar = res.profile.avatarFull;
          this.onSaveUpdate?.(this.currentSave);
          this.mountMeta(this.currentSave);
        }
        showAchievementToast('Steam Connected!', res.profile.personaName, '🎮', '500 Coins + 1 SP');
        void reportGameEvent({ type: 'steam_link' });
        this.adminController.checkAdminPrivileges();
        this.openSteamModal();
      } else {
        if (errEl) {
          errEl.textContent = res.error || 'Failed to resolve Steam account. Check your input and try again.';
          errEl.classList.remove('hidden');
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Link Profile';
        }
      }
    });
  }
}
