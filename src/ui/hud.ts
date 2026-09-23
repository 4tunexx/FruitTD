import type { JuiceBank } from '../game/juice';
import { HEROES, MAX_HERO_LEVEL, heroDef, type HeroId } from '../game/heroes';
import { getTowerXpState } from '../game/towerProgression';
import { HERO_PERKS } from '../game/heroProgression';
import { getAvailableHeroPerkPoints, upgradeHeroPerk } from '../game/heroPerkSave';
import { MODE_INFO, modeRules } from '../game/modes';
import { WALL_SKINS, loadSave, writeSave, type GameMode, type SaveData } from '../game/save';
import { findSlicer } from '../game/slicers';
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
import {
  getCachedSteamState,
  syncSteamState,
  isSessionAuthed,
  setSessionAuthed,
  consumeAuthCallbackParams,
  applySteamBonusIfNeeded,
} from '../services/steam';
import {
  loginWithEmail,
  registerWithEmail,
  verifyEmailCode,
  setEmailForConfirm,
  resendVerifyCode,
  completeProfile,
  logoutAuth,
  fetchMe,
  getCachedAuthUser,
  startSteamLogin,
  applyAuthUserToLocalIds,
  getAuthToken,
  type AuthUser,
} from '../services/auth';
import { showAchievementToast } from '../services/achievements';
import { fetchBadges, type BadgeItem } from '../services/badges';
import { loadLiveConfig, getLiveConfig, getSlicers } from '../services/liveConfig';
import { bootMenuParallax, syncMenuParallax } from './menuParallax';
import { navigation } from '../game/navigation';
import { getHeroXpState } from '../game/progression';
import { getAllHeroStatuses } from '../game/progression/heroStatus';
import { reportGameEvent } from '../services/progress';
import { rankFromScore } from '../game/requirements';
import { getRewardSvg } from './icons';
import { AdminController } from './admin';
import type { Sfx } from '../audio/sfx';
import { isUserAdmin } from '../services/admin';

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
  private juiceCanvasBooted = false;
  private juiceCanvas: HTMLCanvasElement | null = null;
  private juiceCtx: CanvasRenderingContext2D | null = null;
  private juiceRaf = 0;
  private juiceAnimating = false;
  private juiceT = 0;
  private lastJuicePct = -1;
  private juiceLastChangeMs = 0;
  private readonly adminController: AdminController;
  private titleStoryTimer: number | null = null;
  private readonly titleStory = document.querySelector<HTMLElement>('.title-tagline')?.textContent?.trim() ?? '';
  private modalPointer: { id: number; x: number; y: number; modal: HTMLElement } | null = null;
  private titleSlicePointer: { id: number; x: number; y: number; logoHit: boolean } | null = null;
  private titleSliceCount = 0;
  private titleSliceResetTimer: number | null = null;

  onPlace: ((kind: TurretKind) => void) | null = null;
  onHero: ((id: HeroId) => void) | null = null;
  onHeroPurchase: ((id: HeroId) => void) | null = null;
  onToastRequest: ((message: string) => void) | null = null;
  onMode: ((id: GameMode) => void) | null = null;
  onBuySkin: ((id: string) => void) | null = null;
  onEquipItem: ((id: string) => void) | null = null;
  onUnequipItem: ((id: string) => void) | null = null;
  onSellItem: ((id: string) => void) | null = null;
  onDeleteItem: ((id: string) => void) | null = null;
  onBuySkill: ((id: SkillId) => void) | null = null;
  onRename: ((name: string) => void) | null = null;
  onSuper: (() => void) | null = null;
  onSaveUpdate: ((save: SaveData) => void) | null = null;
  onBuyVIP: ((tier: 'bronze' | 'silver' | 'gold') => void) | null = null; // P1-2

  constructor(private readonly sfx?: Sfx) {
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
    // Wire both the legacy tab bar and the new left nav data-page buttons
    document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page || 'play';
        this.showPage(page);
        if (page === 'leaderboard') this.loadLeaderboard();
        if (page === 'quests') this.loadQuests();
        // Update active state on left nav
        document.querySelectorAll<HTMLButtonElement>('#menu-leftnav .menu-navitem[data-page]').forEach(n => {
          n.classList.toggle('is-active', n.dataset.page === page);
        });
      });
    });

    const nameInput = document.getElementById('name-input') as HTMLInputElement | null;
    nameInput?.addEventListener('change', () => this.onRename?.(nameInput.value.trim() || 'Slicer'));

    const refreshDailyFromAdmin = () => {
      this.checkDailyBonus();
      void this.refreshMonthlyRank();
      if (this.currentSave) this.mountShop(this.currentSave);
      const modal = document.getElementById('modal-daily');
      if (modal && !modal.classList.contains('hidden')) {
        void this.openDailyModal();
      }
    };
    this.adminController = new AdminController(refreshDailyFromAdmin, refreshDailyFromAdmin);

    this.initSidebarMobile();
    this.initModals();
    this.initTitleScreen();
    this.initLeaderboardFilters();
    this.initQuestsSubtabs();
    void this.initSteamIntegration(); // P1-2: async Steam auth check
    this.checkDailyBonus();
    this.bootSuperLiquidCanvas();
    bootMenuParallax();
    this.refreshTitleButtons();
    this.playTitleStory();
    navigation.onChange(() => {
      const inMatch = navigation.isInGame();
      document.body.classList.toggle('is-playing', inMatch);
      document.getElementById('app')?.classList.toggle('is-playing', inMatch);
      syncMenuParallax();
    });
    void loadLiveConfig().then(() => this.refreshMonthlyRank());
  }

  private setSidebarOpen(open: boolean): void {
    const app = document.getElementById('app');
    const toggle = document.getElementById('btn-sidebar-toggle');
    const backdrop = document.getElementById('btn-sidebar-close');
    app?.classList.toggle('sidebar-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    backdrop?.classList.toggle('hidden', !open);
  }

  private initSidebarMobile(): void {
    document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => this.setSidebarOpen(true));
    document.getElementById('btn-sidebar-close')?.addEventListener('click', () => this.setSidebarOpen(false));
    document.getElementById('btn-sidebar-hide')?.addEventListener('click', () => this.setSidebarOpen(false));
    // Auto-close after placing / upgrading on phones so slicing stays free
    this.shop.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 860px)').matches) this.setSidebarOpen(false);
    });
  }

  showMenu(open: boolean): void {
    if (open && !isSessionAuthed()) {
      this.returnToTitle();
      return;
    }
    this.setTitleVisible(false);
    if (open) {
      // Returning from a match lands on the Phase 2 main menu, not the
      // legacy dashboard page (§2, §12).
      this.startGate.classList.add('hidden');
      navigation.setState('MAIN_MENU');
      this.showPause(false);
      this.checkDailyBonus();
    } else {
      this.startGate.classList.add('hidden');
      document.getElementById('screen-main-menu')?.classList.add('hidden');
    }
  }

  enterDashboard(): void {
    if (!this.canEnterDashboard()) {
      this.returnToTitle();
      void this.gateAfterAuth(getCachedAuthUser());
      return;
    }
    this.setTitleVisible(false);
    document.getElementById('title-settings')?.classList.add('hidden');
    document.getElementById('title-quit')?.classList.add('hidden');
    // The Phase 2 main menu is the lobby now; the legacy page stays mounted
    // for quests/leaderboard/skills but is not what the player lands on (§2).
    this.startGate.classList.add('hidden');
    this.showPage('play');
    navigation.setState('MAIN_MENU');
    this.checkDailyBonus();
    void this.refreshMonthlyRank();
  }

  private canEnterDashboard(): boolean {
    if (!isSessionAuthed() || !getAuthToken()) return false;
    const user = getCachedAuthUser();
    if (!user) return false;
    if (!user.emailVerified) return false;
    if (!user.profileComplete && !user.steamId) return false;
    return true;
  }

  private applyUserToHud(user: AuthUser): void {
    applyAuthUserToLocalIds(user);
    const save = this.currentSave || loadSave();
    save.nickname = user.nickname || user.username;
    if (user.avatar) save.avatar = user.avatar;
    writeSave(save);
    this.currentSave = save;
    this.onSaveUpdate?.(save);
    this.mountMeta(save);
    if (user.steamId && this.steamBadge) this.steamBadge.classList.remove('hidden');
  }

  private async gateAfterAuth(user: AuthUser | null): Promise<void> {
    if (!user) {
      setSessionAuthed(false);
      this.returnToTitle();
      return;
    }
    this.applyUserToHud(user);
    if (!user.emailVerified) {
      this.openConfirmEmailModal(user);
      return;
    }
    if (!user.profileComplete && !user.steamId) {
      this.openProfileSetupModal();
      return;
    }
    setSessionAuthed(true);
    this.adminController.checkAdminPrivileges();
    this.enterDashboard();
  }

  returnToTitle(): void {
    this.startGate.classList.add('hidden');
    // Unwind the screen stack so no game screen lingers behind the title.
    navigation.reset('TITLE');
    for (const host of document.querySelectorAll('.ftd-screen-host')) {
      host.classList.add('hidden');
    }
    this.setTitleVisible(true);
    this.refreshTitleButtons();
  }

  isTitleOpen(): boolean {
    const title = document.getElementById('title-screen');
    return !!title && !title.classList.contains('hidden');
  }

  async logoutToTitle(): Promise<void> {
    await logoutAuth();
    this.returnToTitle();
  }

  openAdmin(): void {
    if (isUserAdmin()) {
      void this.adminController.open();
      return;
    }
    showAchievementToast(
      'Admin access required',
      'Sign in with the Steam account configured for this server.',
      '🔒',
    );
  }

  private setTitleVisible(open: boolean): void {
    const title = document.getElementById('title-screen');
    title?.classList.toggle('hidden', !open);
    if (open) this.playTitleStory();
  }

  /** Replays the world briefing each time the player returns to the title. */
  private playTitleStory(): void {
    const story = document.querySelector<HTMLElement>('.title-tagline');
    if (!story || !this.titleStory) return;
    if (this.titleStoryTimer !== null) window.clearTimeout(this.titleStoryTimer);
    story.textContent = '';
    story.classList.remove('is-typing');
    void story.offsetWidth;
    story.classList.add('is-typing');

    let index = 0;
    const writeNext = () => {
      story.textContent = this.titleStory.slice(0, index++);
      if (index <= this.titleStory.length) {
        this.titleStoryTimer = window.setTimeout(writeNext, 12);
      } else {
        this.titleStoryTimer = null;
        story.classList.remove('is-typing');
      }
    };
    writeNext();
  }

  private refreshTitleButtons(): void {
    const tips = [
      'Discover your story — slice and assess your character.',
      'Explosive enemies damage your tower when sliced incorrectly — read the warning!',
      'Chain combos for bonus coins and hero XP.',
      'Upgrade your Main Tower to unlock powerful perks.',
      'Level your hero to 100 for MAX MASTERY rewards.',
      'Co-op unlocks when your hero reaches Level 25.',
      'Splitter enemies spawn smaller waves — plan your defense.',
    ];
    const user = getCachedAuthUser();
    const ready = this.canEnterDashboard();
    const continueBtn = document.getElementById('btn-title-continue');
    const loginBtn = document.getElementById('btn-title-login');
    const account = document.getElementById('title-account-line');
    continueBtn?.classList.toggle('hidden', !ready);
    loginBtn?.classList.toggle('hidden', ready);
    if (account) {
      if (user?.nickname || user?.username) {
        account.textContent = `Sign in as @${user.steamPersona || user.nickname || user.username}`;
      } else {
        account.textContent = 'Not signed in — click Start Game';
      }
    }
    // Rotate tip text
    const tipEl = document.getElementById('title-tip-text');
    if (tipEl) {
      tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];
    }
  }

  private initTitleScreen(): void {
    const title = document.getElementById('title-screen');
    const logo = document.querySelector<HTMLElement>('.title-logo');
    const titleButtons = document.querySelectorAll<HTMLButtonElement>('#title-menu .title-btn');
    for (const button of titleButtons) {
      button.addEventListener('pointerenter', () => this.sfx?.cursorMove());
      button.addEventListener('click', () => this.sfx?.select());
    }
    logo?.addEventListener('pointerenter', () => this.sfx?.shopHover());
    title?.addEventListener('pointermove', (event) => {
      const rect = title.getBoundingClientRect();
      const pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      const pointerY = (event.clientY - rect.top) / rect.height - 0.5;
      title.style.setProperty('--title-bg-x', `${(-pointerX * 56).toFixed(1)}px`);
      title.style.setProperty('--title-bg-y', `${(-pointerY * 38).toFixed(1)}px`);
      title.style.setProperty('--title-bg-scale', `${(1.04 + Math.abs(pointerX) * 0.035 + Math.abs(pointerY) * 0.02).toFixed(3)}`);
      title.style.setProperty('--title-world-x', `${(-pointerX * 9).toFixed(1)}px`);
      title.style.setProperty('--title-world-y', `${(-pointerY * 6).toFixed(1)}px`);
      title.style.setProperty('--title-world-scale', `${(1.004 + Math.abs(pointerX) * 0.008 + Math.abs(pointerY) * 0.005).toFixed(3)}`);
    });
    this.installTitleSliceInteraction(title, logo);
    document.getElementById('btn-title-continue')?.addEventListener('click', () => {
      if (this.canEnterDashboard()) this.enterDashboard();
      else void this.gateAfterAuth(getCachedAuthUser());
    });
    document.getElementById('btn-title-login')?.addEventListener('click', () => this.openAuthModal('login'));
    // "Load Save" button — reuses btn-title-register id, opens login to restore cloud save
    document.getElementById('btn-title-register')?.addEventListener('click', () => this.openAuthModal('login'));
    document.getElementById('btn-title-settings')?.addEventListener('click', () => {
      document.getElementById('title-settings')?.classList.remove('hidden');
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      document.getElementById('title-settings')?.classList.add('hidden');
    });
    document.getElementById('btn-settings-mute')?.addEventListener('click', () => {
      document.getElementById('btn-mute')?.click();
      this.syncSettingsMuteLabel();
    });
    document.getElementById('btn-mute-topbar')?.addEventListener('click', () => {
      document.getElementById('btn-mute')?.click();
      this.syncSettingsMuteLabel();
    });
    document.getElementById('btn-settings-logout')?.addEventListener('click', async () => {
      await logoutAuth();
      document.getElementById('title-settings')?.classList.add('hidden');
      this.returnToTitle();
    });
    document.getElementById('btn-title-quit')?.addEventListener('click', () => {
      document.getElementById('title-quit')?.classList.remove('hidden');
      window.close();
    });
    document.getElementById('btn-quit-back')?.addEventListener('click', () => {
      document.getElementById('title-quit')?.classList.add('hidden');
    });
    document.getElementById('btn-dash-main-menu')?.addEventListener('click', () => {
      this.returnToTitle();
    });
    this.syncSettingsMuteLabel();
  }

  /** Decorative title-only slash target. It never feeds gameplay rewards or save data. */
  private installTitleSliceInteraction(title: HTMLElement | null, logo: HTMLElement | null): void {
    if (!title || !logo) return;
    const control = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, input, select, textarea, a');
    const hitLogo = (startX: number, startY: number, endX: number, endY: number) => {
      const rect = logo.getBoundingClientRect();
      const pad = 16;
      return !(
        Math.max(startX, endX) < rect.left - pad ||
        Math.min(startX, endX) > rect.right + pad ||
        Math.max(startY, endY) < rect.top - pad ||
        Math.min(startY, endY) > rect.bottom + pad
      );
    };

    title.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || control(event.target)) return;
      event.preventDefault();
      this.titleSlicePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, logoHit: false };
      title.setPointerCapture?.(event.pointerId);
    });
    title.addEventListener('pointermove', (event) => {
      const stroke = this.titleSlicePointer;
      if (!stroke || stroke.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
      if (distance < 18) return;
      event.preventDefault();
      const logoHit = !stroke.logoHit && hitLogo(stroke.x, stroke.y, event.clientX, event.clientY);
      this.spawnTitleSlash(title, stroke.x, stroke.y, event.clientX, event.clientY, logoHit);
      if (logoHit) {
        stroke.logoHit = true;
        this.titleSliceCount++;
        if (this.titleSliceResetTimer !== null) window.clearTimeout(this.titleSliceResetTimer);
        this.titleSliceResetTimer = window.setTimeout(() => { this.titleSliceCount = 0; }, 1800);
        this.sfx?.swipe(false);
        this.sfx?.slice('watermelon', Math.min(10, this.titleSliceCount));
        if (this.titleSliceCount > 1) this.sfx?.combo(this.titleSliceCount);
        logo.classList.remove('is-sliced');
        void logo.offsetWidth;
        logo.classList.add('is-sliced');
        this.spawnTitleLogoImpact(title, logo);
      }
      stroke.x = event.clientX;
      stroke.y = event.clientY;
    });
    const endStroke = (event: PointerEvent) => {
      if (this.titleSlicePointer?.id === event.pointerId) this.titleSlicePointer = null;
    };
    title.addEventListener('pointerup', endStroke);
    title.addEventListener('pointercancel', endStroke);
  }

  private spawnTitleSlash(title: HTMLElement, startX: number, startY: number, endX: number, endY: number, logoHit: boolean): void {
    const bounds = title.getBoundingClientRect();
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    const trail = document.createElement('i');
    trail.className = `title-slice-trail${logoHit ? ' is-hit' : ''}`;
    trail.style.left = `${startX - bounds.left}px`;
    trail.style.top = `${startY - bounds.top}px`;
    trail.style.width = `${length}px`;
    trail.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    title.appendChild(trail);
    window.setTimeout(() => trail.remove(), 260);

    if (!logoHit) return;
    const bonus = document.createElement('div');
    bonus.className = 'title-slice-bonus';
    bonus.textContent = this.titleSliceCount > 1 ? `LOGO SLICE x${this.titleSliceCount}` : '+25 LOGO HIT';
    bonus.style.left = `${endX - bounds.left}px`;
    bonus.style.top = `${endY - bounds.top}px`;
    title.appendChild(bonus);
    window.setTimeout(() => bonus.remove(), 850);
  }

  private spawnTitleLogoImpact(title: HTMLElement, logo: HTMLElement): void {
    const titleRect = title.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const impact = document.createElement('div');
    impact.className = 'title-logo-impact';
    impact.style.left = `${logoRect.left - titleRect.left + logoRect.width * 0.5}px`;
    impact.style.top = `${logoRect.top - titleRect.top + logoRect.height * 0.53}px`;
    for (let index = 0; index < 6; index++) {
      const spark = document.createElement('i');
      spark.style.setProperty('--spark-angle', `${index * 60 + Math.random() * 20 - 10}deg`);
      impact.appendChild(spark);
    }
    title.appendChild(impact);
    window.setTimeout(() => impact.remove(), 520);
  }

  private authMode: 'login' | 'register' = 'login';
  private steamModalMode: 'login' | 'register' | 'link' = 'login';

  private openAuthModal(mode: 'login' | 'register'): void {
    this.authMode = mode;
    const title = document.getElementById('auth-modal-title');
    const sub = document.getElementById('auth-modal-sub');
    const submit = document.getElementById('btn-auth-email-submit');
    const err = document.getElementById('auth-email-error');
    const steamBtn = document.getElementById('btn-auth-open-steam');
    const switchBtn = document.getElementById('btn-auth-switch');
    if (switchBtn) switchBtn.textContent = mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in';
    const password = document.getElementById('auth-password') as HTMLInputElement | null;
    if (password) password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    if (title) title.textContent = mode === 'login' ? 'Login' : 'Register';
    if (sub) {
      sub.textContent =
        mode === 'login'
          ? 'Sign in with Steam or your email.'
          : 'Create an account with Steam or email.';
    }
    if (submit) submit.textContent = mode === 'login' ? 'Login with email' : 'Register with email';
    if (steamBtn) {
      steamBtn.textContent = mode === 'login' ? 'Sign in through Steam' : 'Register through Steam';
    }
    err?.classList.add('hidden');
    document.getElementById('modal-auth')?.classList.remove('hidden');
  }

  private openConfirmEmailModal(user: AuthUser): void {
    const emailInput = document.getElementById('confirm-email-input') as HTMLInputElement | null;
    const wrap = document.getElementById('confirm-email-field-wrap');
    const preview = document.getElementById('confirm-email-preview');
    const err = document.getElementById('confirm-email-error');
    if (emailInput) emailInput.value = user.email || '';
    wrap?.classList.toggle('hidden', !!user.email);
    preview?.classList.add('hidden');
    err?.classList.add('hidden');
    document.getElementById('modal-confirm-email')?.classList.remove('hidden');
  }

  private openProfileSetupModal(): void {
    const err = document.getElementById('profile-setup-error');
    err?.classList.add('hidden');
    const preview = document.getElementById('profile-avatar-preview') as HTMLImageElement | null;
    if (preview) preview.src = '';
    document.getElementById('modal-profile-setup')?.classList.remove('hidden');
  }

  private syncSettingsMuteLabel(): void {
    const mute = document.getElementById('btn-mute');
    const settingsMute = document.getElementById('btn-settings-mute');
    if (settingsMute) {
      settingsMute.textContent = mute?.textContent === '🔇' ? 'Unmute sound' : 'Mute sound';
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
    // Update left nav active state
    document.querySelectorAll<HTMLButtonElement>('#menu-leftnav .menu-navitem[data-page]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.page === page);
    });

    // P1-1: Load profile data when switching to profile page
    if (page === 'profile') {
      this.renderProfilePage();
    }
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

    // Populate new dashboard panel elements
    this.updateDashboardPanels(save);
  }

  /** Populate the new game-style dashboard topbar and progression panels. */
  private updateDashboardPanels(save: SaveData): void {
    const hero = heroDef(save.hero);
    const xp = getHeroXpState(save, save.hero);
    const tower = getTowerXpState();

    // Topbar
    const setEl = (id: string, val: string) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const setImg = (id: string, src: string) => { const e = document.getElementById(id) as HTMLImageElement | null; if (e) e.src = src; };
    const setStyle = (id: string, prop: string, val: string) => { const e = document.getElementById(id) as HTMLElement | null; if (e) (e.style as unknown as Record<string, string>)[prop] = val; };

    setImg('topbar-avatar', save.avatar);
    setEl('topbar-name', save.nickname);
    setEl('topbar-level', `Level ${xp.level}`);
    setStyle('topbar-xpbar', 'width', `${Math.round(xp.progress * 100)}%`);
    setEl('topbar-xp-val', `Lv ${xp.level}`);
    setEl('topbar-coins-val', save.coins.toLocaleString());
    setEl('topbar-gems-val', (save.gems || 0).toLocaleString());

    // Right panel player card
    setImg('dash-avatar', save.avatar);
    setEl('dash-name', save.nickname);

    // Hero
    setEl('dash-hero', hero.name);
    setEl('dash-hero-level', xp.maxed ? `Lv ${MAX_HERO_LEVEL} MAX` : `Lv ${xp.level}/${MAX_HERO_LEVEL}`);
    setStyle('dash-hero-xpbar', 'width', `${Math.round(xp.progress * 100)}%`);

    // Tower
    setEl('dash-tower', `Base Tower`);
    setEl('dash-tower-level', `Lv ${tower.level}/10`);
    setStyle('dash-tower-xpbar', 'width', `${Math.round(tower.progress * 100)}%`);

    // Career stats
    setEl('dash-best-wave', save.bestWave > 0 ? String(save.bestWave) : '—');
    setEl('dash-high-score', save.highScore > 0 ? save.highScore.toLocaleString() : '—');
    setEl('dash-games-played', String(save.games || 0));
    setEl('dash-coins', save.coins.toLocaleString());

    // Bottombar mode
    const modeEl = document.getElementById('bottombar-mode');
    if (modeEl) modeEl.textContent = `${(save.mode || 'casual').toUpperCase()} · WAVE DEFENCE`;
  }

  async refreshMonthlyRank(): Promise<void> {
    const el = document.getElementById('player-rank');
    const dashRank = document.getElementById('dash-rank');
    const data = await fetchMonthlyRank();
    const fallback = rankFromScore(0, getLiveConfig().ranks);
    const rank = data?.rank || fallback;
    const title = data
      ? `Monthly ${rank.title} · ${data.score.toLocaleString()} pts`
      : `Monthly ${rank.title}`;
    if (el) {
      el.textContent = rank.title;
      el.style.color = rank.color;
      el.style.borderColor = rank.color;
      el.title = title;
    }
    if (dashRank) {
      dashRank.textContent = rank.title;
      dashRank.style.color = rank.color;
      dashRank.title = title;
    }
  }

  /**
   * Hero roster (§4): every hero shows OWNED / LOCKED / PURCHASE state, the
   * unlock requirement, level and XP. Locked heroes cannot be equipped.
   */
  mountHeroes(save: SaveData): void {
    this.heroPick.innerHTML = '';
    for (const status of getAllHeroStatuses(save)) {
      const hero = heroDef(status.heroId);
      const xpState = getHeroXpState(save, status.heroId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.hero = status.heroId;
      btn.className = `hero-btn hero-btn--${status.availability}`;

      const stateLabel =
        status.availability === 'owned'
          ? '<span class="hero-btn__state hero-btn__state--owned">OWNED</span>'
          : status.availability === 'purchasable'
            ? '<span class="hero-btn__state hero-btn__state--buy">PURCHASE ONLY</span>'
            : '<span class="hero-btn__state hero-btn__state--locked">LOCKED</span>';

      const progress = status.owned
        ? `Lv ${xpState.level}/${MAX_HERO_LEVEL}${xpState.maxed ? ' · MAX' : ''} · ${xpState.xp.toLocaleString()} XP`
        : status.requirement;

      const bar = status.owned
        ? `<span class="hero-btn__track"><i style="width:${Math.round(xpState.progress * 100)}%"></i></span>`
        : '';

      btn.innerHTML =
        `<p class="text-sm font-black">${hero.name} ${stateLabel}</p>` +
        `<p class="text-[11px] text-zinc-400">${hero.title} · ${progress}</p>${bar}`;

      btn.addEventListener('click', () => {
        if (status.owned) {
          this.onHero?.(status.heroId);
          return;
        }
        if (status.availability === 'purchasable') {
          this.onHeroPurchase?.(status.heroId);
          return;
        }
        this.onToastRequest?.(`${hero.name} locked — ${status.requirement}`);
      });
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
      const honesty =
        m.id === 'ranked'
          ? '<span class="mode-honesty-badge mode-honesty-badge--live">Ranked live</span>'
          : m.guest
            ? '<span class="mode-honesty-badge mode-honesty-badge--guest">Guest assist</span>'
            : '';
      btn.innerHTML = `<p class="font-black">${m.name}</p>${honesty}<p class="text-[11px] text-zinc-400">${m.blurb}</p>`;
      btn.addEventListener('click', () => this.onMode?.(m.id));
      box.appendChild(btn);
    }
    this.modeLabel.textContent = modeRules(mode).name;
  }

  /**
   * Shop/inventory ITEM rendering moved to the dedicated screens (§6/§7).
   * This only refreshes the currency + VIP widgets that still live on the
   * lobby page — there is no second item renderer any more (§12).
   */
  mountShop(save: SaveData): void {
    const coinEl = document.getElementById('shop-coins');
    if (coinEl) coinEl.textContent = `${save.coins} coins`;
    const gemEl = document.getElementById('shop-gems');
    if (gemEl) gemEl.textContent = `💎 ${save.gems || 0} gems`;
    this.updateVIPStatus(save);
  }

  // P1-2: VIP System
  private updateVIPStatus(save: SaveData): void {
    const statusEl = document.getElementById('vip-current-status');
    const vipStatus = save.vipStatus || 'none';
    const statusText: Record<string, string> = {
      none: 'Status: Free Player',
      bronze: 'Status: Bronze VIP ⭐',
      silver: 'Status: Silver VIP ⭐⭐',
      gold: 'Status: Gold VIP ⭐⭐⭐',
    };
    if (statusEl) statusEl.textContent = statusText[vipStatus];
    
    // Disable already-purchased tiers
    const bronzeBtn = document.getElementById('btn-vip-bronze') as HTMLButtonElement | null;
    const silverBtn = document.getElementById('btn-vip-silver') as HTMLButtonElement | null;
    const goldBtn = document.getElementById('btn-vip-gold') as HTMLButtonElement | null;
    
    if (bronzeBtn) bronzeBtn.disabled = vipStatus !== 'none';
    if (silverBtn) silverBtn.disabled = vipStatus === 'silver' || vipStatus === 'gold';
    if (goldBtn) goldBtn.disabled = vipStatus === 'gold';
  }


  private isSuperPanelHidden(): boolean {
    const wrap = document.getElementById('super-wrap');
    if (!wrap) return true;
    if (wrap.classList.contains('hidden')) return true;
    const title = document.getElementById('title-screen');
    const dash = document.getElementById('hud-start');
    if (title && !title.classList.contains('hidden')) return true;
    if (dash && !dash.classList.contains('hidden')) return true;
    const style = window.getComputedStyle(wrap);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    return false;
  }

  private sizeSuperLiquidCanvas(): void {
    const canvas = this.juiceCanvas;
    if (!canvas) return;
    // Cap DPR at 1 — liquid shimmer does not need retina cost during match
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    const w = Math.max(1, Math.round(48 * dpr));
    const h = Math.max(1, Math.round(240 * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  private drawSuperLiquidFrame(): void {
    const canvas = this.juiceCanvas;
    const ctx = this.juiceCtx;
    if (!canvas || !ctx) return;
    this.juiceT += 0.04;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const juice = Number(document.getElementById('super-fill')?.style.getPropertyValue('--juice') || 0);
    if (juice <= 0.5) return;
    const t = this.juiceT;
    for (let i = 0; i < 3; i++) {
      const y = h * (0.15 + i * 0.22) + Math.sin(t * 1.4 + i * 1.7) * 6;
      const grad = ctx.createLinearGradient(0, y - 8, 0, y + 8);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(255,250,220,${0.18 - i * 0.04})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 2) {
        const yy = y + Math.sin(x * 0.18 + t * 2.2 + i) * (3.5 - i) + Math.cos(x * 0.09 - t + i) * 1.5;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (let b = 0; b < 7; b++) {
      const bx = ((Math.sin(t * 0.7 + b * 1.3) * 0.5 + 0.5) * 0.7 + 0.15) * w;
      const by = h - ((t * 8 + b * 37) % (h * 0.9));
      const r = 1.2 + (b % 3) * 0.7;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.22 + (b % 3) * 0.06})`;
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private stopSuperLiquidLoop(): void {
    if (this.juiceRaf) {
      cancelAnimationFrame(this.juiceRaf);
      this.juiceRaf = 0;
    }
    this.juiceAnimating = false;
  }

  private startSuperLiquidLoop(): void {
    if (this.juiceAnimating) return;
    this.juiceAnimating = true;
    const step = (now: number) => {
      if (!this.juiceAnimating) return;
      const juice = Number(document.getElementById('super-fill')?.style.getPropertyValue('--juice') || 0);
      const idle = now - this.juiceLastChangeMs > 500;
      const hidden = this.isSuperPanelHidden();
      if (idle || hidden || juice <= 0.5) {
        if (!hidden && juice > 0.5) this.drawSuperLiquidFrame();
        this.stopSuperLiquidLoop();
        return;
      }
      this.drawSuperLiquidFrame();
      this.juiceRaf = requestAnimationFrame(step);
    };
    this.juiceRaf = requestAnimationFrame(step);
  }

  /** Resume shimmer when juice changes; idle >0.5s or hidden panel pauses rAF. */
  private nudgeSuperLiquid(juicePct: number): void {
    if (juicePct !== this.lastJuicePct) {
      this.lastJuicePct = juicePct;
      this.juiceLastChangeMs = performance.now();
    }
    if (this.isSuperPanelHidden() || juicePct <= 0.5) {
      this.stopSuperLiquidLoop();
      return;
    }
    if (performance.now() - this.juiceLastChangeMs > 500) return;
    this.startSuperLiquidLoop();
  }

  private bootSuperLiquidCanvas(): void {
    if (this.juiceCanvasBooted) return;
    const canvas = document.getElementById('super-liquid-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    this.juiceCanvasBooted = true;
    this.juiceCanvas = canvas;
    this.juiceCtx = canvas.getContext('2d');
    if (!this.juiceCtx) return;
    this.sizeSuperLiquidCanvas();
    this.juiceLastChangeMs = performance.now();
    // Do not start a forever rAF — sync()/nudge starts it only while juice is changing
  }
  /**
   * The owned-items grid now lives in the Inventory screen (§7).
   * `mountProfileInventory` below still renders the compact profile preview.
   */


  private mountProfileInventory(
    save: SaveData,
    items?: Array<{
      id: string;
      isBlade: boolean;
      isDefault: boolean;
      name: string;
      color: string;
      glow: string;
      eq: boolean;
    }>
  ): void {
    const box = document.getElementById('profile-inventory');
    if (!box) return;
    box.innerHTML = '';

    let list = items;
    if (!list) {
      const allSlicers = getSlicers();
      const lockedDefaults = new Set(['blade-default', 'wall-brick']);
      list = [];
      for (const id of save.ownedSkins) {
        const slicer = findSlicer(allSlicers, id) || findSlicer(getLiveConfig().slicers, id);
        const wall = WALL_SKINS.find((w) => w.id === id);
        if (!slicer && !wall) continue;
        const isBlade = !!slicer;
        list.push({
          id,
          isBlade,
          isDefault: lockedDefaults.has(id),
          name: slicer?.name || wall!.name,
          color: slicer ? slicer.color : `#${wall!.color.toString(16).padStart(6, '0')}`,
          glow: slicer?.glowColor || (slicer ? slicer.color : `#${wall!.color.toString(16).padStart(6, '0')}`),
          eq: isBlade ? save.bladeSkin === id : save.wallSkin === id,
        });
      }
      list.sort((a, b) => Number(a.isDefault) - Number(b.isDefault) || a.name.localeCompare(b.name));
    }

    if (!list.length) {
      box.innerHTML =
        '<p class="text-[12px] text-zinc-500">Inventory empty — open Shop to expand your loadout.</p>';
      return;
    }
    for (const item of list.slice(0, 8)) {
      const row = document.createElement('div');
      row.className = `profile-inv-chip${item.eq ? ' is-on' : ''}`;
      row.innerHTML = `<span class="skin-swatch" style="background:linear-gradient(135deg,${item.color},${item.glow})"></span><span>${item.name}</span>`;
      box.appendChild(row);
    }
    if (list.length > 8) {
      const more = document.createElement('p');
      more.className = 'text-[11px] text-zinc-500';
      more.textContent = `+${list.length - 8} more in Shop → Inventory`;
      box.appendChild(more);
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
    this.mountHeroPerks(save);
  }

  mountHeroPerks(save: SaveData): void {
    const container = document.getElementById('hero-perks-container');
    if (!container) return;
    
    container.innerHTML = '';
    const hero = save.hero;
    const heroXp = save.xp[hero] || 0;
    const perkRanks = save.heroPerkRanks?.[hero] || {};
    
    const availablePoints = getAvailableHeroPerkPoints(hero, heroXp);
    const heroInfo = heroDef(hero);
    
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3';
    header.innerHTML = `
      <p class="text-sm font-bold text-slate-300">${heroInfo.name} Perks</p>
      <p class="text-xs font-bold ${availablePoints > 0 ? 'text-lime-400' : 'text-slate-400'}">
        ${availablePoints} perk point${availablePoints !== 1 ? 's' : ''} available
      </p>
    `;
    container.appendChild(header);
    
    for (const perk of HERO_PERKS) {
      const perkId = String(perk.id);
      const rank = Number((perkRanks as any)[perkId]) || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-btn';
      btn.innerHTML = `
        <p class="font-black">${perk.name}  ${rank}/${perk.maxRank}</p>
        <p class="text-[11px] text-zinc-400">${perk.description}</p>
      `;
      btn.disabled = availablePoints <= 0 || rank >= perk.maxRank;
      btn.addEventListener('click', () => {
        if (upgradeHeroPerk(hero, perk.id, heroXp, availablePoints)) {
          const updatedSave = loadSave();
          this.currentSave = updatedSave;
          this.mountHeroPerks(updatedSave);
        }
      });
      container.appendChild(btn);
    }
  }

  refreshHeroPick(id: HeroId, save: SaveData): void {
    const hero = heroDef(id);
    const xpState = getHeroXpState(save, id);
    this.heroBlurb.innerHTML = `<b>${hero.name}</b> — ${hero.blurb}<br>Mouse: ${hero.mouse}<br>Touch: ${hero.touch}`;
    const levelText = xpState.maxed
      ? `Lv ${MAX_HERO_LEVEL} MAX`
      : `Lv ${xpState.level}/${MAX_HERO_LEVEL}`;
    this.saveLine.textContent =
      `Best ${save.highScore} · wave ${save.bestWave} · ${save.coins.toLocaleString()} coins · ${hero.name} ${levelText}`;
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
    // Central hero XP state — never recomputed locally.
    const xpState = getHeroXpState(this.currentSave ?? loadSave(), state.hero);
    this.hero.innerHTML = xpState.maxed
      ? `${hero.name}  ·  <b>Lv ${MAX_HERO_LEVEL} MAX MASTERY</b>` +
        `<span class="hud-xp-track hud-xp-track--max"><i style="width:100%"></i></span>`
      : `${hero.name}  ·  Lv ${xpState.level}/${MAX_HERO_LEVEL}  ·  ` +
        `XP ${xpState.xpIntoLevel.toLocaleString()}/${xpState.xpForLevel.toLocaleString()}` +
        `<span class="hud-xp-track"><i style="width:${Math.round(xpState.progress * 100)}%"></i></span>`;
    this.hpFill.style.width = `${Math.max(0, (state.lives / Math.max(1, state.maxLives)) * 100)}%`;
    if (state.combo >= 1) {
      this.combo.textContent = `× ${state.combo} COMBO`;
      this.combo.style.display = '';
    } else {
      this.combo.textContent = '';
      this.combo.style.display = 'none';
    }
    const juicePct = Math.min(100, state.superJuice);
    this.superFill.style.height = `${juicePct}%`;
    this.superFill.style.setProperty('--juice', String(juicePct));
    this.superFill.classList.toggle('is-full', juicePct >= 100);
    this.superFill.classList.toggle('is-low', juicePct > 0 && juicePct < 28);
    const wave = document.getElementById('super-wave');
    if (wave) wave.style.setProperty('--juice', String(juicePct));
    this.superBtn.disabled = state.superJuice < 100;
    this.nudgeSuperLiquid(juicePct);
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

    // playActive must include GAME_OVER (isInGame). Using isPlaying alone hid the overlay every frame.
    const showOver = !state.running && playActive;
    this.gameover.classList.toggle('hidden', !showOver);
    this.gameover.classList.toggle('flex', showOver);
    if (showOver) {
      this.finalScore.textContent = `${state.score.toLocaleString()}`;
      if (this.finalWave) this.finalWave.textContent = `Wave ${state.wave}`;
    } else if (!playActive) {
      this.gameover.classList.add('hidden');
      this.gameover.classList.remove('flex');
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
  // P1-1: PROFILE PAGE
  // ══════════════════════════════════════════════════════════════════════════
  private renderProfilePage(): void {
    if (!this.currentSave) return;
    this.mountProfileInventory(this.currentSave);
    
    // Hero info
    const avatar = document.getElementById('profile-hero-avatar') as HTMLImageElement | null;
    const name = document.getElementById('profile-hero-name');
    const rankBadge = document.getElementById('profile-hero-rank');
    const steamBadge = document.getElementById('profile-hero-steam');
    
    if (avatar) avatar.src = this.currentSave.avatar;
    if (name) name.textContent = this.currentSave.nickname;
    
    // Set rank color
    fetchMonthlyRank().then(data => {
      const fallback = rankFromScore(0, getLiveConfig().ranks);
      const rank = data?.rank || fallback;
      if (rankBadge) {
        rankBadge.textContent = rank.title;
        rankBadge.style.backgroundColor = `${rank.color}15`;
        rankBadge.style.borderColor = `${rank.color}35`;
        rankBadge.style.color = rank.color;
      }
    });
    
    // Show steam badge if linked
    const cachedSteam = getCachedSteamState();
    if (steamBadge && cachedSteam.linked) {
      steamBadge.classList.remove('hidden');
    }
    
    // Stats
    const highScore = document.getElementById('profile-high-score');
    const bestWave = document.getElementById('profile-best-wave');
    const gamesPlayed = document.getElementById('profile-games-played');
    const totalCoins = document.getElementById('profile-total-coins');
    
    if (highScore) highScore.textContent = this.currentSave.highScore.toLocaleString();
    if (bestWave) bestWave.textContent = String(this.currentSave.bestWave);
    if (gamesPlayed) gamesPlayed.textContent = String(this.currentSave.games || 0);
    if (totalCoins) totalCoins.textContent = this.currentSave.coins.toLocaleString();
    
    // Badges summary
    this.renderProfileBadgesSummary();
    
    // Rank progress
    this.renderProfileRankProgress();
  }
  
  private async renderProfileBadgesSummary(): Promise<void> {
    const container = document.getElementById('profile-badges-summary');
    if (!container) return;
    
    const [achievementsRes, badgesRes] = await Promise.all([
      fetchAchievements(),
      fetchBadges()
    ]);
    
    container.innerHTML = '';
    
    if (achievementsRes?.achievements) {
      const unlocked = achievementsRes.achievements.filter(a => a.unlocked).slice(0, 5);
      unlocked.forEach(ach => {
        const badge = document.createElement('div');
        badge.className = 'profile-badge-mini';
        badge.innerHTML = `<span>${ach.icon}</span><span>${ach.title}</span>`;
        container.appendChild(badge);
      });
    }
    
    if (badgesRes?.badges) {
      const unlocked = badgesRes.badges.filter(b => b.unlocked).slice(0, 5);
      unlocked.forEach(badge => {
        const el = document.createElement('div');
        el.className = 'profile-badge-mini';
        el.innerHTML = `<span>${badge.icon}</span><span>${badge.title}</span>`;
        container.appendChild(el);
      });
    }
    
    if (!container.children.length) {
      container.innerHTML = '<p class="text-sm text-slate-400">Play matches to unlock achievements and badges!</p>';
    }
  }
  
  private async renderProfileRankProgress(): Promise<void> {
    const container = document.getElementById('profile-rank-progress');
    if (!container) return;
    
    const rank = await fetchMonthlyRank();
    const tiers = [...(getLiveConfig().ranks || [])].sort((a, b) => a.minScore - b.minScore);
    const current = rank?.rank || rankFromScore(0, tiers);
    const next = rank?.next || tiers.find((t) => t.minScore > current.minScore) || null;
    const score = rank?.score || 0;
    const span = next ? Math.max(1, next.minScore - current.minScore) : 1;
    const into = next ? Math.min(span, Math.max(0, score - current.minScore)) : span;
    const pct = next ? Math.min(100, (into / span) * 100) : 100;
    
    container.innerHTML = `
      <div class="rank-now-icon" style="color:${current.color};border-color:${current.color};font-size:2rem;margin-bottom:0.5rem">${current.icon}</div>
      <div>
        <p class="rank-now-title" style="color:${current.color};font-size:1.25rem;font-weight:900;margin:0">${current.title}</p>
        <p class="text-sm text-slate-400" style="margin:0.25rem 0">${score.toLocaleString()} seasonal points</p>
        <div class="bar-track" style="margin-top:0.5rem"><div class="bar-fill" style="width:${pct}%;background:${current.color}"></div></div>
        <p class="text-xs text-slate-400 font-bold mt-1">${
          next ? `${into.toLocaleString()} / ${span.toLocaleString()} to ${next.title}` : 'Top monthly tier reached!'
        }</p>
      </div>
    `;
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
  // AUTH + STEAM
  // ══════════════════════════════════════════════════════════════════════════
  private async initSteamIntegration(): Promise<void> {
    const cb = consumeAuthCallbackParams();
    if (cb.error) {
      showAchievementToast('Steam login failed', cb.error, '⚠️');
    }
    if (cb.bonus) {
      applySteamBonusIfNeeded(true);
      showAchievementToast('Steam Connected!', 'Welcome bonus', '🎮', '500 Coins + 1 SP');
      void reportGameEvent({ type: 'steam_link' });
    }

    const user = await fetchMe();
    if (user) {
      this.applyUserToHud(user);
      if (cb.token || cb.steam) {
        await this.gateAfterAuth(user);
      } else if (this.canEnterDashboard()) {
        setSessionAuthed(true);
      } else {
        setSessionAuthed(false);
      }
    } else {
      setSessionAuthed(false);
      await syncSteamState();
    }

    if (getCachedSteamState().linked && this.steamBadge) {
      this.steamBadge.classList.remove('hidden');
    }
    this.returnToTitle();
    this.refreshTitleButtons();
  }

  private openSteamModal(mode: 'login' | 'register' | 'link' = 'link'): void {
    this.steamModalMode = mode;
    this.authMode = mode === 'register' ? 'register' : 'login';
    const modal = document.getElementById('modal-steam');
    const steamState = getCachedSteamState();
    const profileCard = document.getElementById('steam-profile-card');
    const form = document.getElementById('steam-link-form');
    const errEl = document.getElementById('steam-link-error');
    const title = document.getElementById('steam-modal-title');
    const sub = document.getElementById('steam-modal-sub');
    const submit = document.getElementById('btn-submit-steam');

    if (title) {
      title.textContent =
        mode === 'login' ? 'Steam Login' : mode === 'register' ? 'Register with Steam' : 'Link Steam Account';
    }
    if (sub) {
      sub.textContent =
        'Press the button to open Steam. After you approve, we load your Steam name and avatar into Fruit TD.';
    }
    if (submit) {
      submit.textContent = mode === 'link' ? 'Link with Steam' : 'Login with Steam';
    }

    errEl?.classList.add('hidden');
    modal?.classList.remove('hidden');

    if (steamState.linked && mode === 'link') {
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

  private profileAvatarData = '';

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL EVENT LISTENERS
  // ══════════════════════════════════════════════════════════════════════════
  private initModals(): void {
    this.installModalDismissGestures();
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
        // P1-2: Add gems from daily rewards
        if (res.reward.gems) {
          this.currentSave.gems = (this.currentSave.gems || 0) + res.reward.gems;
        }
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

    document.getElementById('btn-close-auth')?.addEventListener('click', () => {
      document.getElementById('modal-auth')?.classList.add('hidden');
    });
    document.getElementById('btn-auth-switch')?.addEventListener('click', () => {
      const submit = document.getElementById('btn-auth-email-submit') as HTMLButtonElement | null;
      if (!submit?.disabled) this.openAuthModal(this.authMode === 'login' ? 'register' : 'login');
    });
    document.getElementById('btn-auth-open-steam')?.addEventListener('click', () => {
      document.getElementById('modal-auth')?.classList.add('hidden');
      this.openSteamModal(this.authMode);
    });
    document.getElementById('auth-email-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('auth-email') as HTMLInputElement | null)?.value.trim() || '';
      const password = (document.getElementById('auth-password') as HTMLInputElement | null)?.value || '';
      const errEl = document.getElementById('auth-email-error');
      const btn = document.getElementById('btn-auth-email-submit') as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Please wait…';
      }
      const res =
        this.authMode === 'register'
          ? await registerWithEmail(email, password)
          : await loginWithEmail(email, password);
      if (btn) {
        btn.disabled = false;
        btn.textContent = this.authMode === 'login' ? 'Login with email' : 'Register with email';
      }
      if (!res.success || !res.user) {
        if (errEl) {
          errEl.textContent = res.error || 'Could not sign in.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      document.getElementById('modal-auth')?.classList.add('hidden');
      if (res.previewCode) {
        const preview = document.getElementById('confirm-email-preview');
        if (preview) {
          preview.textContent = `Dev code (email preview): ${res.previewCode}`;
          preview.classList.remove('hidden');
        }
      }
      await this.gateAfterAuth(res.user);
    });

    document.getElementById('btn-close-confirm-email')?.addEventListener('click', () => {
      document.getElementById('modal-confirm-email')?.classList.add('hidden');
    });
    document.getElementById('btn-send-confirm-code')?.addEventListener('click', async () => {
      const email = (document.getElementById('confirm-email-input') as HTMLInputElement | null)?.value.trim();
      const errEl = document.getElementById('confirm-email-error');
      const preview = document.getElementById('confirm-email-preview');
      const user = getCachedAuthUser();
      const res = user?.email
        ? await resendVerifyCode(email || user.email)
        : await setEmailForConfirm(email || '');
      if (!res.success) {
        if (errEl) {
          errEl.textContent = res.error || 'Could not send code.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      errEl?.classList.add('hidden');
      if (preview) {
        preview.textContent = res.previewCode
          ? `Code sent (preview): ${res.previewCode}`
          : `Code sent to ${email || user?.email || 'your inbox'}.`;
        preview.classList.remove('hidden');
      }
    });
    document.getElementById('btn-submit-confirm-code')?.addEventListener('click', async () => {
      const code =
        (document.getElementById('confirm-code-input') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
      const errEl = document.getElementById('confirm-email-error');
      const res = await verifyEmailCode(code);
      if (!res.success || !res.user) {
        if (errEl) {
          errEl.textContent = res.error || 'Invalid code.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      document.getElementById('modal-confirm-email')?.classList.add('hidden');
      await this.gateAfterAuth(res.user);
    });

    document.getElementById('btn-close-profile-setup')?.addEventListener('click', () => {
      document.getElementById('modal-profile-setup')?.classList.add('hidden');
    });
    document.getElementById('profile-avatar-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 600_000) {
        const errEl = document.getElementById('profile-setup-error');
        if (errEl) {
          errEl.textContent = 'Image too large. Use one under ~600KB.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.profileAvatarData = String(reader.result || '');
        const preview = document.getElementById('profile-avatar-preview') as HTMLImageElement | null;
        if (preview) preview.src = this.profileAvatarData;
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('btn-submit-profile-setup')?.addEventListener('click', async () => {
      const username = (document.getElementById('profile-username-input') as HTMLInputElement | null)?.value || '';
      const errEl = document.getElementById('profile-setup-error');
      if (!this.profileAvatarData) {
        if (errEl) {
          errEl.textContent = 'Upload an avatar first.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      const res = await completeProfile(username, this.profileAvatarData);
      if (!res.success || !res.user) {
        if (errEl) {
          errEl.textContent = res.error || 'Could not save profile.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      document.getElementById('modal-profile-setup')?.classList.add('hidden');
      await this.gateAfterAuth(res.user);
    });

    // Steam Modal Triggers
    document.getElementById('btn-steam-chip')?.addEventListener('click', () => this.openSteamModal('link'));
    document.getElementById('btn-open-steam-shop')?.addEventListener('click', () => this.openSteamModal('link'));
    document.getElementById('btn-close-steam')?.addEventListener('click', () => {
      document.getElementById('modal-steam')?.classList.add('hidden');
    });

    document.getElementById('btn-submit-steam')?.addEventListener('click', () => {
      startSteamLogin(this.steamModalMode);
    });

    // P1-2: VIP purchase buttons
    document.getElementById('btn-vip-bronze')?.addEventListener('click', () => this.onBuyVIP?.('bronze'));
    document.getElementById('btn-vip-silver')?.addEventListener('click', () => this.onBuyVIP?.('silver'));
    document.getElementById('btn-vip-gold')?.addEventListener('click', () => this.onBuyVIP?.('gold'));
  }

  /** One outside-click/swipe dismissal path for every markup-backed popup. */
  private installModalDismissGestures(): void {
    const dismiss = (modal: HTMLElement) => {
      if (modal.classList.contains('hidden') || modal.classList.contains('is-dismissing')) return;
      modal.classList.add('is-dismissing');
      this.sfx?.rotate();
      window.setTimeout(() => {
        if (modal.id === 'modal-daily') this.stopDailyCountdown();
        modal.classList.remove('is-dismissing');
        modal.classList.add('hidden');
      }, 150);
    };

    document.querySelectorAll<HTMLElement>('.hud-modal-backdrop').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) dismiss(modal);
      });
      modal.addEventListener('pointerdown', (event) => {
        if (event.target !== modal) return;
        this.modalPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, modal };
        modal.setPointerCapture?.(event.pointerId);
      });
      modal.addEventListener('pointerup', (event) => {
        const start = this.modalPointer;
        this.modalPointer = null;
        if (!start || start.id !== event.pointerId || start.modal !== modal) return;
        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (distance >= 70) dismiss(modal);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = [...document.querySelectorAll<HTMLElement>('.hud-modal-backdrop')]
        .reverse()
        .find((entry) => !entry.classList.contains('hidden'));
      if (!modal) return;
      event.preventDefault();
      dismiss(modal);
    });
  }
}
