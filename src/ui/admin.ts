import {
  fetchAdminConfig,
  saveAdminConfig,
  adminResetDailyStreak,
  adminFetchLeaderboards,
  adminDeleteScore,
  adminWipeLeaderboardMode,
  isUserAdmin,
  setAdminPin,
  ADMIN_STEAM_ID,
  DEFAULT_ADMIN_CONFIG,
  type AdminConfig,
} from '../services/admin';
import { getUserId } from '../services/api';
import { setLiveConfig } from '../services/liveConfig';
import {
  addAchievement,
  addBadge,
  addMission,
  addRank,
  addSlicer,
  renderAchievementEditor,
  renderBadgeEditor,
  renderMissionEditor,
  renderRankEditor,
  renderSlicerEditor,
} from './adminCatalog';
import { installSpriteUploads } from './adminSprites';

type AdminTab = 'daily' | 'missions' | 'achievements' | 'badges' | 'ranks' | 'slicers' | 'sprites' | 'branding' | 'economy' | 'leaderboard';

export class AdminController {
  private modal = document.getElementById('modal-admin') as HTMLElement | null;
  private config: AdminConfig | null = null;
  private activeTab: AdminTab = 'daily';
  private onConfigSaved: ((config: AdminConfig) => void) | null = null;
  private onDailyReset: (() => void) | null = null;

  constructor(onConfigSaved?: (config: AdminConfig) => void, onDailyReset?: () => void) {
    this.onConfigSaved = onConfigSaved || null;
    this.onDailyReset = onDailyReset || null;
    this.initListeners();
    this.checkAdminPrivileges();
  }

  checkAdminPrivileges(): void {
    const adminBtn = document.getElementById('btn-admin');
    if (adminBtn) {
      // Admin button is only in dashboard, visibility managed by dashboard state
      // No longer forcing visibility here
      if (isUserAdmin()) {
        adminBtn.classList.add('is-active-admin');
        adminBtn.title = `Admin Active (Steam ID: ${ADMIN_STEAM_ID})`;
      } else {
        adminBtn.classList.remove('is-active-admin');
        adminBtn.title = 'Click to open Admin Control Center';
      }
    }
  }

  async open(): Promise<void> {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.renderTabs();
    await this.loadConfig();
    this.renderActiveTab();
    installSpriteUploads();
  }

  close(): void {
    this.modal?.classList.add('hidden');
  }

  private initListeners(): void {
    document.getElementById('btn-admin')?.addEventListener('click', () => this.open());
    document.getElementById('btn-close-admin')?.addEventListener('click', () => this.close());

    // Hotkey F2 or Ctrl+Shift+A opens admin
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'A')) {
        e.preventDefault();
        this.open();
      }
    });

    // Tab buttons
    document.querySelectorAll<HTMLButtonElement>('.admin-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as any;
        if (tab) {
          this.activeTab = tab;
          this.renderTabs();
          this.renderActiveTab();
        }
      });
    });

    // Save Config Button
    document.getElementById('btn-admin-save')?.addEventListener('click', () => this.saveCurrentConfig());

    // Reset Daily Button
    document.getElementById('btn-admin-reset-daily')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-admin-reset-daily') as HTMLButtonElement | null;
      const statusEl = document.getElementById('admin-save-status');
      if (btn) btn.disabled = true;
      const res = await adminResetDailyStreak(getUserId());
      if (statusEl) {
        statusEl.textContent = res.message || res.error || 'Streak reset!';
        statusEl.className = res.success ? 'admin-status-ok' : 'admin-status-err';
      }
      if (res.success) this.onDailyReset?.();
      if (btn) btn.disabled = false;
    });

    document.getElementById('btn-admin-wipe-mode')?.addEventListener('click', async () => {
      const select = document.getElementById('admin-lb-wipe-mode') as HTMLSelectElement | null;
      const mode = select?.value || 'ranked';
      const ok = confirm(`Wipe ALL ${mode} leaderboard scores from MongoDB Atlas? This cannot be undone.`);
      if (!ok) return;
      const statusEl = document.getElementById('admin-save-status');
      const res = await adminWipeLeaderboardMode(mode);
      if (statusEl) {
        statusEl.textContent = res.message || res.error || 'Mode wiped.';
        statusEl.className = res.success ? 'admin-status-ok' : 'admin-status-err';
      }
      if (res.success) this.renderLeaderboardManager();
    });

    document.getElementById('btn-admin-login-pin')?.addEventListener('click', () => this.submitAdminPin());
    document.getElementById('admin-pin-input')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.submitAdminPin();
    });

    document.getElementById('btn-admin-add-mission')?.addEventListener('click', () => {
      if (!this.config) return;
      addMission(this.config.missions);
      this.renderCatalogEditors();
    });
    document.getElementById('btn-admin-add-achievement')?.addEventListener('click', () => {
      if (!this.config) return;
      addAchievement(this.config.achievements);
      this.renderCatalogEditors();
    });
    document.getElementById('btn-admin-add-badge')?.addEventListener('click', () => {
      if (!this.config) return;
      addBadge(this.config.badges);
      this.renderCatalogEditors();
    });
    document.getElementById('btn-admin-add-rank')?.addEventListener('click', () => {
      if (!this.config) return;
      addRank(this.config.ranks);
      this.renderCatalogEditors();
    });
    document.getElementById('btn-admin-add-slicer')?.addEventListener('click', () => {
      if (!this.config) return;
      addSlicer(this.config.slicers);
      this.renderCatalogEditors();
    });
  }

  private submitAdminPin(): void {
    const input = document.getElementById('admin-pin-input') as HTMLInputElement | null;
    const pinMsg = document.getElementById('admin-pin-msg');
    if (input && input.value.trim() === '1337') {
      setAdminPin('1337');
      this.checkAdminPrivileges();
      if (pinMsg) {
        pinMsg.textContent = 'Admin privileges unlocked';
        pinMsg.className = 'admin-status-ok';
      }
    } else if (pinMsg) {
      pinMsg.textContent = 'Invalid Admin PIN';
      pinMsg.className = 'admin-status-err';
    }
  }

  private renderTabs(): void {
    document.querySelectorAll<HTMLButtonElement>('.admin-tab-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === this.activeTab);
    });
    for (const el of document.querySelectorAll('.admin-panel-tab')) {
      el.classList.add('hidden');
    }
    document.getElementById(`admin-tab-${this.activeTab}`)?.classList.remove('hidden');
  }

  private async loadConfig(): Promise<void> {
    this.config = structuredClone((await fetchAdminConfig()) ?? DEFAULT_ADMIN_CONFIG);
    this.renderBrandingEditor();
    this.renderEconomyEditor();
    this.renderCatalogEditors();
  }

  private renderCatalogEditors(): void {
    if (!this.config) return;
    const missions = document.getElementById('admin-missions-list');
    const achievements = document.getElementById('admin-achievements-list');
    const badges = document.getElementById('admin-badges-list');
    const ranks = document.getElementById('admin-ranks-list');
    const slicers = document.getElementById('admin-slicers-list');
    if (missions) renderMissionEditor(missions, this.config.missions);
    if (achievements) renderAchievementEditor(achievements, this.config.achievements);
    if (badges) renderBadgeEditor(badges, this.config.badges);
    if (ranks) renderRankEditor(ranks, this.config.ranks);
    if (slicers) renderSlicerEditor(slicers, this.config.slicers);
  }

  private renderActiveTab(): void {
    if (!this.config) return;

    if (this.activeTab === 'daily') {
      this.renderDailyEditor();
    } else if (
      this.activeTab === 'missions' ||
      this.activeTab === 'achievements' ||
      this.activeTab === 'badges' ||
      this.activeTab === 'ranks' ||
      this.activeTab === 'slicers'
    ) {
      this.renderCatalogEditors();
    } else if (this.activeTab === 'branding') {
      this.renderBrandingEditor();
    } else if (this.activeTab === 'economy') {
      this.renderEconomyEditor();
    } else if (this.activeTab === 'leaderboard') {
      this.renderLeaderboardManager();
    }
  }

  // 1. Daily Rewards Editor
  private renderDailyEditor(): void {
    const container = document.getElementById('admin-daily-list');
    if (!container || !this.config) return;
    container.innerHTML = '';

    this.config.dailyRewards.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-reward-row';
      card.innerHTML = `
        <div class="admin-reward-day">Day ${r.day}</div>
        <div class="admin-reward-inputs">
          <label>
            <span>Coins</span>
            <input type="number" class="admin-in-coins" data-idx="${idx}" value="${r.coins}" min="0" step="50" />
          </label>
          <label>
            <span>Skill Pts</span>
            <input type="number" class="admin-in-sp" data-idx="${idx}" value="${r.skillPoints}" min="0" max="10" />
          </label>
          <label>
            <span>Icon</span>
            <select class="admin-in-icon" data-idx="${idx}">
              <option value="coin" ${r.iconType === 'coin' ? 'selected' : ''}>Gold Coin</option>
              <option value="gem" ${r.iconType === 'gem' ? 'selected' : ''}>Skill Crystal</option>
              <option value="chest" ${r.iconType === 'chest' ? 'selected' : ''}>Treasure Chest</option>
              <option value="blade" ${r.iconType === 'blade' ? 'selected' : ''}>Legendary Blade</option>
            </select>
          </label>
          <label class="flex-1">
            <span>Label</span>
            <input type="text" class="admin-in-label" data-idx="${idx}" value="${this.escapeAttr(r.label)}" />
          </label>
          <label class="flex-1">
            <span>Item Unlock</span>
            <input type="text" class="admin-in-item" data-idx="${idx}" value="${this.escapeAttr(r.skinUnlock || '')}" placeholder="e.g. blade-gold" />
          </label>
        </div>
      `;

      card.querySelector('.admin-in-coins')?.addEventListener('change', (e) => {
        this.config!.dailyRewards[idx].coins = Number((e.target as HTMLInputElement).value);
      });
      card.querySelector('.admin-in-sp')?.addEventListener('change', (e) => {
        this.config!.dailyRewards[idx].skillPoints = Number((e.target as HTMLInputElement).value);
      });
      card.querySelector('.admin-in-icon')?.addEventListener('change', (e) => {
        this.config!.dailyRewards[idx].iconType = (e.target as HTMLSelectElement).value as any;
      });
      card.querySelector('.admin-in-label')?.addEventListener('change', (e) => {
        this.config!.dailyRewards[idx].label = (e.target as HTMLInputElement).value;
      });
      card.querySelector('.admin-in-item')?.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value.trim();
        if (value) this.config!.dailyRewards[idx].skinUnlock = value;
        else delete this.config!.dailyRewards[idx].skinUnlock;
      });

      container.appendChild(card);
    });
  }

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // 2. Branding Editor
  private renderBrandingEditor(): void {
    if (!this.config) return;
    const { menuConfig } = this.config;

    const inEyebrow = document.getElementById('admin-in-eyebrow') as HTMLInputElement | null;
    const inTitle = document.getElementById('admin-in-title') as HTMLTextAreaElement | null;
    const inSubtitle = document.getElementById('admin-in-subtitle') as HTMLInputElement | null;
    const inAnnouncement = document.getElementById('admin-in-announcement') as HTMLInputElement | null;
    const inTheme = document.getElementById('admin-in-theme') as HTMLInputElement | null;

    if (inEyebrow) inEyebrow.value = menuConfig.eyebrow;
    if (inTitle) inTitle.value = menuConfig.title;
    if (inSubtitle) inSubtitle.value = menuConfig.subtitle;
    if (inAnnouncement) inAnnouncement.value = menuConfig.announcement;
    if (inTheme) inTheme.value = menuConfig.themeColor || '#a3e635';
  }

  // 3. Economy Editor
  private renderEconomyEditor(): void {
    if (!this.config) return;
    const { gameplayConfig } = this.config;

    const inMoney = document.getElementById('admin-in-money') as HTMLInputElement | null;
    const inLives = document.getElementById('admin-in-lives') as HTMLInputElement | null;
    const inScoreMul = document.getElementById('admin-in-scoremul') as HTMLInputElement | null;
    const inSuperMul = document.getElementById('admin-in-supermul') as HTMLInputElement | null;

    if (inMoney) inMoney.value = String(gameplayConfig.startMoney);
    if (inLives) inLives.value = String(gameplayConfig.startLives);
    if (inScoreMul) inScoreMul.value = String(gameplayConfig.scoreMultiplier);
    if (inSuperMul) inSuperMul.value = String(gameplayConfig.superChargeMultiplier);
  }

  // 4. Leaderboard Manager
  private async renderLeaderboardManager(): Promise<void> {
    const listEl = document.getElementById('admin-lb-table');
    if (!listEl) return;
    listEl.innerHTML = '<div class="text-xs text-slate-400 p-4 text-center">Loading MongoDB scores...</div>';

    const entries = await adminFetchLeaderboards();
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-slate-400 p-4 text-center">No scores found in MongoDB.</div>';
      return;
    }

    listEl.innerHTML = '';
    entries.forEach((e: any) => {
      const row = document.createElement('div');
      row.className = 'admin-lb-row';
      row.innerHTML = `
        <span class="font-bold text-white text-xs w-28 truncate">${e.steamPersona || e.nickname}</span>
        <span class="text-xs text-slate-300 w-16 uppercase">${e.mode}</span>
        <span class="text-xs text-lime-400 font-bold w-20">${e.score?.toLocaleString()}</span>
        <span class="text-xs text-slate-400 w-14">W${e.wave}</span>
        <span class="text-[10px] text-slate-500 flex-1 truncate">${e._id}</span>
        <button class="admin-del-btn" data-id="${e._id}">Delete</button>
      `;

      row.querySelector('.admin-del-btn')?.addEventListener('click', async () => {
        const ok = confirm(`Delete score for ${e.nickname} (${e.score} pts)?`);
        if (ok) {
          await adminDeleteScore(e._id);
          this.renderLeaderboardManager();
        }
      });

      listEl.appendChild(row);
    });
  }

  private async saveCurrentConfig(): Promise<void> {
    if (!this.config) return;
    const statusEl = document.getElementById('admin-save-status');
    const saveBtn = document.getElementById('btn-admin-save') as HTMLButtonElement | null;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving to Atlas...';
    }

    // Pull branding fields
    const inEyebrow = document.getElementById('admin-in-eyebrow') as HTMLInputElement | null;
    const inTitle = document.getElementById('admin-in-title') as HTMLTextAreaElement | null;
    const inSubtitle = document.getElementById('admin-in-subtitle') as HTMLInputElement | null;
    const inAnnouncement = document.getElementById('admin-in-announcement') as HTMLInputElement | null;
    const inTheme = document.getElementById('admin-in-theme') as HTMLInputElement | null;

    if (inEyebrow) this.config.menuConfig.eyebrow = inEyebrow.value;
    if (inTitle) this.config.menuConfig.title = inTitle.value;
    if (inSubtitle) this.config.menuConfig.subtitle = inSubtitle.value;
    if (inAnnouncement) this.config.menuConfig.announcement = inAnnouncement.value;
    if (inTheme) this.config.menuConfig.themeColor = inTheme.value;

    // Pull economy fields
    const inMoney = document.getElementById('admin-in-money') as HTMLInputElement | null;
    const inLives = document.getElementById('admin-in-lives') as HTMLInputElement | null;
    const inScoreMul = document.getElementById('admin-in-scoremul') as HTMLInputElement | null;
    const inSuperMul = document.getElementById('admin-in-supermul') as HTMLInputElement | null;

    if (inMoney) this.config.gameplayConfig.startMoney = Number(inMoney.value);
    if (inLives) this.config.gameplayConfig.startLives = Number(inLives.value);
    if (inScoreMul) this.config.gameplayConfig.scoreMultiplier = Number(inScoreMul.value);
    if (inSuperMul) this.config.gameplayConfig.superChargeMultiplier = Number(inSuperMul.value);

    const res = await saveAdminConfig(this.config);

    if (statusEl) {
      statusEl.textContent = res.message || res.error || 'Saved!';
      statusEl.className = res.success ? 'admin-status-ok' : 'admin-status-err';
    }

    if (res.success) {
      setLiveConfig(this.config);
      this.onConfigSaved?.(this.config);
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to MongoDB Atlas';
    }
  }
}
