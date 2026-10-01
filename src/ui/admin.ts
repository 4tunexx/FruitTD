import {
  fetchAdminConfig,
  saveAdminConfig,
  adminResetDailyStreak,
  adminFetchLeaderboards,
  adminDeleteScore,
  adminWipeLeaderboardMode,
  isUserAdmin,
  DEFAULT_ADMIN_CONFIG,
  type AdminConfig,
} from '../services/admin';
import { getUserId } from '../services/api';
import { setLiveConfig, writeLocalBranding, applyMenuAppearance } from '../services/liveConfig';
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
import { installMediaStudio } from './adminMediaStudio';
import { installCreatorWaveBoard } from './creatorWaveBoard';
import { installCreatorSlicerVfx } from './creatorSlicerVfx';
import { openDesignMode } from './design/designMode';
import { renderThemeEditor } from './design/themeEditor';
import { confirmModal, GameToast } from './components/surface';
import { campaignBoss, campaignWaves, defaultCampaignBoss } from '../game/campaign';

type AdminTab = 'design' | 'daily' | 'vip' | 'missions' | 'achievements' | 'badges' | 'ranks' | 'enemies' | 'slicers' | 'sprites' | 'studio' | 'branding' | 'economy' | 'content' | 'leaderboard';

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
      if (isUserAdmin()) {
        adminBtn.classList.add('is-active-admin');
        adminBtn.title = 'Admin Active (authenticated Steam account)';
      } else {
        adminBtn.classList.remove('is-active-admin');
        adminBtn.title = 'Admin Control Center (Steam auth required)';
      }
    }
  }

  async open(): Promise<void> {
    if (!isUserAdmin()) return;
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.renderTabs();
    await this.loadConfig();
    this.renderActiveTab();
    installSpriteUploads();
    installMediaStudio();
    installCreatorWaveBoard();
    installCreatorSlicerVfx();
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

    // DESIGN tab → shared theme system (no second design system)
    document.getElementById('btn-admin-open-design')?.addEventListener('click', () => openDesignMode());

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
      const ok = await confirmModal({
        title: 'Wipe leaderboard scores?',
        message: `Delete every ${mode} score from the leaderboard? This cannot be undone.`,
        confirmLabel: 'Wipe scores',
        tone: 'danger',
      });
      if (!ok) return;
      const statusEl = document.getElementById('admin-save-status');
      const res = await adminWipeLeaderboardMode(mode);
      if (statusEl) {
        statusEl.textContent = res.message || res.error || 'Mode wiped.';
        statusEl.className = res.success ? 'admin-status-ok' : 'admin-status-err';
      }
      if (res.success) this.renderLeaderboardManager();
    });

    document.getElementById('btn-admin-add-mission')?.addEventListener('click', () => {
      if (!this.config) return;
      addMission(this.config.missions, 'main');
      this.renderCatalogEditors();
    });
    document.getElementById('btn-admin-add-daily-mission')?.addEventListener('click', () => {
      if (!this.config) return;
      addMission(this.config.missions, 'daily');
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

    // Main (PR#6): Content editing handlers
    document.getElementById('btn-save-boss-names')?.addEventListener('click', () => this.saveBossNames());
    document.getElementById('admin-campaign-boss-stage')?.addEventListener('change', () => this.renderContentEditor());
    document.getElementById('admin-campaign-boss-image')?.addEventListener('change', (event) => void this.readCampaignBossImage(event));
    for (const id of ['admin-campaign-boss-name', 'admin-campaign-boss-title', 'admin-campaign-boss-description', 'admin-campaign-boss-difficulty', 'admin-campaign-boss-coins', 'admin-campaign-boss-gems']) {
      document.getElementById(id)?.addEventListener('input', () => this.previewCampaignBoss());
    }
    document.getElementById('btn-save-fruits')?.addEventListener('click', () => this.saveContent('fruits'));
    document.getElementById('btn-save-enemies')?.addEventListener('click', () => this.saveContent('enemies'));
    document.getElementById('btn-save-waves')?.addEventListener('click', () => this.saveContent('waves'));

    window.addEventListener('fruittd-waves-published', ((e: CustomEvent) => {
      if (!this.config) return;
      (this.config as AdminConfig & { waves?: unknown }).waves = e.detail;
    }) as EventListener);
  }

  private renderTabs(): void {
    document.querySelectorAll<HTMLButtonElement>('.admin-tab-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === this.activeTab);
    });
    for (const el of document.querySelectorAll('.admin-panel-tab')) {
      el.classList.add('hidden');
    }
    document.getElementById(`admin-tab-${this.activeTab}`)?.classList.remove('hidden');
    if (this.activeTab === 'design') this.renderDesignTab();
  }

  /** Embeds the live Theme Editor inside Admin → Design. */
  private renderDesignTab(): void {
    const host = document.getElementById('admin-design-inline');
    if (!host || host.dataset.ready === '1') return;
    host.dataset.ready = '1';
    host.appendChild(renderThemeEditor());
  }

  private async loadConfig(): Promise<void> {
    const liveConfig = await fetchAdminConfig();
    this.config = structuredClone(liveConfig ?? DEFAULT_ADMIN_CONFIG);
    this.renderLiveStats(Boolean(liveConfig));
    this.renderBrandingEditor();
    this.renderEconomyEditor();
    this.renderCatalogEditors();
  }

  private renderLiveStats(isLive: boolean): void {
    if (!this.config) return;
    const values: Record<string, string> = {
      'admin-stat-status': isLive ? 'LIVE CONFIG' : 'LOCAL FALLBACK',
      'admin-stat-missions': String(this.config.missions.length),
      'admin-stat-slicers': String(this.config.slicers.length),
      'admin-stat-enemies': String(this.config.enemies.length),
      'admin-stat-ranks': String(this.config.ranks.length),
    };
    for (const [id, value] of Object.entries(values)) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
    document.getElementById('admin-stat-status')?.classList.toggle('is-fallback', !isLive);
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
    } else if (this.activeTab === 'vip') {
      this.renderVipEditor();
    } else if (
      this.activeTab === 'missions' ||
      this.activeTab === 'achievements' ||
      this.activeTab === 'badges' ||
      this.activeTab === 'ranks' ||
      this.activeTab === 'slicers'
    ) {
      this.renderCatalogEditors();
    } else if (this.activeTab === 'sprites' || this.activeTab === 'studio') {
      installMediaStudio();
    } else if (this.activeTab === 'branding') {
      this.renderBrandingEditor();
    } else if (this.activeTab === 'economy') {
      this.renderEconomyEditor();
    } else if (this.activeTab === 'content') {
      this.renderContentEditor();
    } else if (this.activeTab === 'leaderboard') {
      this.renderLeaderboardManager();
    }
  }

  // VIP Tiers Editor (PR7)
  private renderVipEditor(): void {
    const container = document.getElementById('admin-vip-list');
    if (!container || !this.config) return;
    container.innerHTML = '';

    this.config.vipTiers.forEach((vip) => {
      const card = document.createElement('div');
      card.className = 'admin-reward-row';
      const tierColor = vip.tier === 'gold' ? '#f5c542' : vip.tier === 'silver' ? '#c0c0c0' : '#cd7f32';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="font-size:1.5rem;color:${tierColor}">◆</span>
          <strong style="color:${tierColor}">${vip.title}</strong>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;">
          <label class="admin-label">
            Price (coins)
            <input type="number" class="admin-input" data-vip="${vip.tier}" data-field="price" value="${vip.price}" min="0" />
          </label>
          <label class="admin-label">
            Coin Bonus (%)
            <input type="number" class="admin-input" data-vip="${vip.tier}" data-field="coinBonus" value="${vip.coinBonus}" min="0" max="100" />
          </label>
          <label class="admin-label">
            XP Bonus (%)
            <input type="number" class="admin-input" data-vip="${vip.tier}" data-field="xpBonus" value="${vip.xpBonus}" min="0" max="100" />
          </label>
          <label class="admin-label">
            Daily Coins
            <input type="number" class="admin-input" data-vip="${vip.tier}" data-field="dailyCoins" value="${vip.dailyCoins}" min="0" />
          </label>
          <label class="admin-label">
            Daily SP
            <input type="number" class="admin-input" data-vip="${vip.tier}" data-field="dailySp" value="${vip.dailySp}" min="0" />
          </label>
          <label class="admin-label">
            Exclusive Skins (comma-separated IDs)
            <input type="text" class="admin-input" data-vip="${vip.tier}" data-field="exclusiveSkins" value="${vip.exclusiveSkins.join(',')}" />
          </label>
        </div>
        <label class="admin-label">
          Description
          <input type="text" class="admin-input" data-vip="${vip.tier}" data-field="description" value="${this.escapeAttr(vip.description)}" />
        </label>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        const tier = (input as HTMLInputElement).dataset.vip as 'bronze' | 'silver' | 'gold';
        const field = (input as HTMLInputElement).dataset.field;
        const vipObj = this.config!.vipTiers.find((v) => v.tier === tier);
        if (!vipObj || !field) return;
        
        const value = (input as HTMLInputElement).value;
        if (field === 'exclusiveSkins') {
          vipObj.exclusiveSkins = value.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (field === 'description' || field === 'title') {
          (vipObj as any)[field] = value;
        } else {
          (vipObj as any)[field] = parseFloat(value) || 0;
        }
      });
    });
  }

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

  private renderBrandingEditor(): void {
    if (!this.config) return;
    const { menuConfig } = this.config;

    const inEyebrow = document.getElementById('admin-in-eyebrow') as HTMLInputElement | null;
    const inTitle = document.getElementById('admin-in-title') as HTMLTextAreaElement | null;
    const inSubtitle = document.getElementById('admin-in-subtitle') as HTMLInputElement | null;
    const inAnnouncement = document.getElementById('admin-in-announcement') as HTMLInputElement | null;
    const inTheme = document.getElementById('admin-in-theme') as HTMLInputElement | null;
    const inBg = document.getElementById('admin-in-bg-image') as HTMLInputElement | null;
    const inLogo = document.getElementById('admin-in-logo-image') as HTMLInputElement | null;
    const inFavicon = document.getElementById('admin-in-favicon') as HTMLInputElement | null;
    const uploadBg = document.getElementById('admin-upload-bg-image') as HTMLInputElement | null;
    const uploadLogo = document.getElementById('admin-upload-logo-image') as HTMLInputElement | null;
    const uploadFavicon = document.getElementById('admin-upload-favicon') as HTMLInputElement | null;

    if (inEyebrow) inEyebrow.value = menuConfig.eyebrow;
    if (inTitle) inTitle.value = menuConfig.title;
    if (inSubtitle) inSubtitle.value = menuConfig.subtitle;
    if (inAnnouncement) inAnnouncement.value = menuConfig.announcement;
    if (inTheme) inTheme.value = menuConfig.themeColor || '#a3e635';
    if (inBg) inBg.value = menuConfig.backgroundImage || '';
    if (inLogo) inLogo.value = menuConfig.logoImage || '';
    if (inFavicon) inFavicon.value = menuConfig.faviconImage || '';
    this.refreshBrandingPreview(
      menuConfig.backgroundImage || '',
      menuConfig.logoImage || '',
      menuConfig.faviconImage || ''
    );

    type BrandField = 'backgroundImage' | 'logoImage' | 'faviconImage';
    const urlInputs: Record<BrandField, HTMLInputElement | null> = {
      backgroundImage: inBg,
      logoImage: inLogo,
      faviconImage: inFavicon,
    };

    const syncPreview = () => {
      if (!this.config) return;
      this.refreshBrandingPreview(
        this.config.menuConfig.backgroundImage || '',
        this.config.menuConfig.logoImage || '',
        this.config.menuConfig.faviconImage || ''
      );
    };

    const wireUpload = (input: HTMLInputElement | null, field: BrandField) => {
      if (!input || input.dataset.wired === '1') return;
      input.dataset.wired = '1';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file || !this.config) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          if (!dataUrl) return;
          this.config!.menuConfig[field] = dataUrl;
          const urlInput = urlInputs[field];
          if (urlInput) urlInput.value = dataUrl.slice(0, 120) + (dataUrl.length > 120 ? '…' : '');
          writeLocalBranding({ [field]: dataUrl });
          applyMenuAppearance(this.config!);
          syncPreview();
        };
        reader.readAsDataURL(file);
      });
    };
    wireUpload(uploadBg, 'backgroundImage');
    wireUpload(uploadLogo, 'logoImage');
    wireUpload(uploadFavicon, 'faviconImage');

    const wireUrl = (input: HTMLInputElement | null, field: BrandField) => {
      if (!input || input.dataset.wired === '1') return;
      input.dataset.wired = '1';
      input.addEventListener('change', () => {
        if (!this.config) return;
        const value = input.value.trim();
        if (value.endsWith('…')) return; // truncated data-URL preview
        this.config.menuConfig[field] = value;
        writeLocalBranding({ [field]: value });
        applyMenuAppearance(this.config);
        syncPreview();
      });
    };
    wireUrl(inBg, 'backgroundImage');
    wireUrl(inLogo, 'logoImage');
    wireUrl(inFavicon, 'faviconImage');
  }

  private refreshBrandingPreview(bg: string, logo: string, favicon = ''): void {
    const preview = document.querySelector<HTMLElement>('[data-branding-preview]');
    const logoImg = document.getElementById('admin-logo-preview') as HTMLImageElement | null;
    const favImg = document.getElementById('admin-favicon-preview') as HTMLImageElement | null;
    if (preview) {
      preview.style.backgroundImage = bg ? `url("${bg.replace(/"/g, '\\"')}")` : '';
    }
    if (logoImg) {
      if (logo) {
        logoImg.src = logo;
        logoImg.style.display = 'block';
      } else {
        logoImg.removeAttribute('src');
        logoImg.style.display = 'none';
      }
    }
    if (favImg) {
      if (favicon) {
        favImg.src = favicon;
        favImg.style.display = 'block';
      } else {
        favImg.removeAttribute('src');
        favImg.style.display = 'none';
      }
    }
  }

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
        const ok = await confirmModal({
          title: 'Delete leaderboard score?',
          message: `Remove ${e.nickname}'s score of ${e.score} points?`,
          confirmLabel: 'Delete score',
          tone: 'danger',
        });
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

    const inBg = document.getElementById('admin-in-bg-image') as HTMLInputElement | null;
    const inLogo = document.getElementById('admin-in-logo-image') as HTMLInputElement | null;
    const inFavicon = document.getElementById('admin-in-favicon') as HTMLInputElement | null;
    // Prefer already-set data URLs from uploads; URL inputs only overwrite when they look like real URLs (not truncated preview).
    if (inBg && inBg.value && !inBg.value.endsWith('…') && !inBg.value.startsWith('data:')) {
      this.config.menuConfig.backgroundImage = inBg.value.trim();
    }
    if (inLogo && inLogo.value && !inLogo.value.endsWith('…') && !inLogo.value.startsWith('data:')) {
      this.config.menuConfig.logoImage = inLogo.value.trim();
    }
    if (inFavicon && inFavicon.value && !inFavicon.value.endsWith('…') && !inFavicon.value.startsWith('data:')) {
      this.config.menuConfig.faviconImage = inFavicon.value.trim();
    }
    writeLocalBranding({
      backgroundImage: this.config.menuConfig.backgroundImage || '',
      logoImage: this.config.menuConfig.logoImage || '',
      faviconImage: this.config.menuConfig.faviconImage || '',
    });

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

  // Main content editor (kept from post-PR#6)
  private campaignRevealImage = '';

  private async readCampaignBossImage(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { GameToast('Choose a PNG, JPEG, or WebP image.', 'warning'); return; }
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = imageUrl; await image.decode();
      const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.86;
      do { this.campaignRevealImage = canvas.toDataURL('image/webp', quality); quality -= 0.12; } while (this.campaignRevealImage.length > 28_000 && quality >= 0.2);
      if (this.campaignRevealImage.length > 30_000) { this.campaignRevealImage = ''; GameToast('Image is too detailed. Use a smaller PNG (320×320 recommended).', 'warning'); return; }
      const preview = document.getElementById('admin-campaign-boss-preview') as HTMLImageElement | null;
      if (preview) { preview.src = this.campaignRevealImage; preview.classList.remove('hidden'); }
      this.previewCampaignBoss();
    } catch { GameToast('Could not read that image.', 'danger'); }
    finally { URL.revokeObjectURL(imageUrl); }
  }

  private async saveBossNames(): Promise<void> {
    const stageEl = document.getElementById('admin-campaign-boss-stage') as HTMLSelectElement | null;
    if (!stageEl || !this.config) return;
    const index = Number(stageEl.value) - 1;
    const existing = this.config.campaignBosses?.[index] ?? campaignBoss(index + 1);
    const value = {
      ...existing,
      name: (document.getElementById('admin-campaign-boss-name') as HTMLInputElement).value.trim(),
      title: (document.getElementById('admin-campaign-boss-title') as HTMLInputElement).value.trim(),
      description: (document.getElementById('admin-campaign-boss-description') as HTMLTextAreaElement).value.trim(),
      difficulty: Math.min(8, Math.max(1, Number((document.getElementById('admin-campaign-boss-difficulty') as HTMLInputElement).value) || 1)),
      rewardCoins: Math.min(100_000, Math.max(0, Math.floor(Number((document.getElementById('admin-campaign-boss-coins') as HTMLInputElement).value) || 0))),
      rewardGems: Math.min(1000, Math.max(0, Math.floor(Number((document.getElementById('admin-campaign-boss-gems') as HTMLInputElement).value) || 0))),
      revealImage: this.campaignRevealImage || existing.revealImage,
    };
    if (!value.name || !value.title || !value.description) { GameToast('Name, title and description are required.', 'warning'); return; }
    const roster = Array.from({ length: 100 }, (_, i) => this.config!.campaignBosses?.[i] ?? defaultCampaignBoss(i + 1)); roster[index] = value;
    const updated = { ...this.config, campaignBosses: roster };
    const result = await saveAdminConfig(updated);
    const statusEl = document.getElementById('admin-save-status');
    if (!result.success) { GameToast(result.error || 'Could not save boss.', 'danger'); return; }
    this.config = updated; setLiveConfig(updated); this.onConfigSaved?.(updated); this.campaignRevealImage = '';
    if (statusEl) { statusEl.textContent = `Stage ${index + 1} boss saved to shared admin config.`; statusEl.className = 'admin-status-ok'; }
  }

  private saveContent(type: 'fruits' | 'enemies' | 'waves'): void {
    const textarea = document.getElementById(`admin-${type}-json`) as HTMLTextAreaElement | null;
    if (!textarea) return;
    
    try {
      const data = JSON.parse(textarea.value);
      localStorage.setItem(`admin-${type}-config`, JSON.stringify(data));
      const statusEl = document.getElementById('admin-save-status');
      if (statusEl) {
        statusEl.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} config saved to localStorage.`;
        statusEl.className = 'admin-status-ok';
      }
    } catch (e: any) {
      GameToast(`Invalid JSON for ${type}: ${e instanceof Error ? e.message : 'Check the format.'}`, 'danger', 4500, { title: 'Could not save content' });
    }
  }

  private renderContentEditor(): void {
    const stageSelect = document.getElementById('admin-campaign-boss-stage') as HTMLSelectElement | null;
    if (stageSelect && !stageSelect.options.length) for (let stage = 1; stage <= 100; stage++) stageSelect.add(new Option(`Stage ${String(stage).padStart(2, '0')}`, String(stage)));
    if (stageSelect) {
      const boss = this.config?.campaignBosses?.[Number(stageSelect.value || 1) - 1] ?? defaultCampaignBoss(Number(stageSelect.value || 1));
      (document.getElementById('admin-campaign-boss-name') as HTMLInputElement | null)?.setAttribute('value', boss.name);
      const nameInput = document.getElementById('admin-campaign-boss-name') as HTMLInputElement | null; if (nameInput) nameInput.value = boss.name;
      const titleInput = document.getElementById('admin-campaign-boss-title') as HTMLInputElement | null; if (titleInput) titleInput.value = boss.title;
      const descInput = document.getElementById('admin-campaign-boss-description') as HTMLTextAreaElement | null; if (descInput) descInput.value = boss.description;
      const difficultyInput = document.getElementById('admin-campaign-boss-difficulty') as HTMLInputElement | null; if (difficultyInput) difficultyInput.value = String(boss.difficulty);
      const coinsInput = document.getElementById('admin-campaign-boss-coins') as HTMLInputElement | null; if (coinsInput) coinsInput.value = String(boss.rewardCoins);
      if (coinsInput) coinsInput.max = String(Math.floor((campaignWaves(Number(stageSelect.value)) + 1) * 100 / 1.5));
      const gemsInput = document.getElementById('admin-campaign-boss-gems') as HTMLInputElement | null; if (gemsInput) gemsInput.value = String(boss.rewardGems);
      if (gemsInput) gemsInput.max = String(Math.floor((campaignWaves(Number(stageSelect.value)) + 1) / 5));
      const preview = document.getElementById('admin-campaign-boss-preview') as HTMLImageElement | null;
      if (preview) { preview.src = boss.revealImage || ''; preview.classList.toggle('hidden', !boss.revealImage); }
      this.campaignRevealImage = '';
      this.previewCampaignBoss();
    }
    
    const fruitsTextarea = document.getElementById('admin-fruits-json') as HTMLTextAreaElement | null;
    const enemiesTextarea = document.getElementById('admin-enemies-json') as HTMLTextAreaElement | null;
    const wavesTextarea = document.getElementById('admin-waves-json') as HTMLTextAreaElement | null;
    
    if (fruitsTextarea) {
      const stored = localStorage.getItem('admin-fruits-config');
      if (stored) fruitsTextarea.value = stored;
    }
    if (enemiesTextarea) {
      const stored = localStorage.getItem('admin-enemies-config');
      if (stored) enemiesTextarea.value = stored;
    }
    if (wavesTextarea) {
      const stored = localStorage.getItem('admin-waves-config');
      if (stored) wavesTextarea.value = stored;
    }
  }

  private previewCampaignBoss(): void {
    const stage = (document.getElementById('admin-campaign-boss-stage') as HTMLSelectElement | null)?.value || '1';
    const name = (document.getElementById('admin-campaign-boss-name') as HTMLInputElement | null)?.value || 'UNKNOWN OVERLORD';
    const title = (document.getElementById('admin-campaign-boss-title') as HTMLInputElement | null)?.value || `Campaign Overlord · Stage ${stage}`;
    const description = (document.getElementById('admin-campaign-boss-description') as HTMLTextAreaElement | null)?.value || '';
    const difficulty = (document.getElementById('admin-campaign-boss-difficulty') as HTMLInputElement | null)?.value || '1';
    const coins = (document.getElementById('admin-campaign-boss-coins') as HTMLInputElement | null)?.value || '0';
    const gems = (document.getElementById('admin-campaign-boss-gems') as HTMLInputElement | null)?.value || '0';
    const set = (id: string, value: string) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set('admin-campaign-boss-preview-title', title);
    set('admin-campaign-boss-preview-name', name);
    set('admin-campaign-boss-preview-description', description);
    set('admin-campaign-boss-preview-stats', `${campaignWaves(Number(stage))} WAVES · THREAT ×${Number(difficulty).toFixed(1)} · ${Number(coins).toLocaleString()} COINS · ${gems} GEMS`);
  }
}
