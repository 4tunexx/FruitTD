import { normalizeCoopConfig } from '../game/onlineCoop';
import { renderConfigForm } from './admin/configForm';
import { loadStudioStore } from './adminMediaStudio';
import { renderPvpEditor, disposePvpEditor } from './admin/pvpEditor';
import { beginLoading } from './components/loading';
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
import { DEFAULT_CAMPAIGN_STORIES } from '../game/campaignStory';
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
import { installBattleMapEditor } from './admin/battleMapEditor';

type AdminTab = 'landscape' | 'design' | 'daily' | 'vip' | 'missions' | 'achievements' | 'badges' | 'ranks' | 'slicers' | 'maps' | 'sprites' | 'branding' | 'economy' | 'pvp' | 'content' | 'leaderboard';
const ADMIN_TABS: readonly AdminTab[] = ['daily', 'vip', 'missions', 'achievements', 'badges', 'ranks', 'slicers', 'maps', 'sprites', 'branding', 'landscape', 'economy', 'pvp', 'content', 'leaderboard', 'design'];
let sliderOutputId = 0;

function syncRangeOutput(input: HTMLInputElement | null): void {
  if (!input?.dataset.valueOutput) return;
  const output = document.getElementById(input.dataset.valueOutput);
  if (output) { output.textContent = input.value; if (output instanceof HTMLOutputElement) output.value = input.value; }
}

export class AdminController {
  private modal = document.getElementById('modal-admin') as HTMLElement | null;
  private config: AdminConfig | null = null;
  private activeTab: AdminTab = 'daily';
  private onConfigSaved: ((config: AdminConfig) => void) | null = null;
  private onDailyReset: (() => void) | null = null;
  private leaderboardRequest = 0;

  private bindDraftInput(input: HTMLInputElement | HTMLTextAreaElement | null, update: (value: string) => void): void {
    if (!input || input.dataset.draftWired === '1') return;
    input.dataset.draftWired = '1';
    input.addEventListener('input', () => update(input.value));
  }

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
    const endLoading = this.modal ? beginLoading(this.modal, 'Loading your admin workspace…') : () => {};
    try { await this.loadConfig(); } finally { endLoading(); }
    this.renderActiveTab();
    installSpriteUploads();
    installMediaStudio();
    installCreatorWaveBoard();
    installCreatorSlicerVfx();
    installBattleMapEditor();
  }

  close(): void {
    const editor = document.getElementById('admin-pvp-config'); if (editor) disposePvpEditor(editor);
    this.modal?.classList.add('hidden');
  }

  private initListeners(): void {
    this.modal?.addEventListener('input', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'range' || !input.dataset.valueOutput) return;
      syncRangeOutput(input);
    });
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
    this.modal?.querySelectorAll<HTMLButtonElement>('.admin-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as AdminTab | undefined;
        if (tab && ADMIN_TABS.includes(tab)) {
          if (this.activeTab === 'pvp' && tab !== 'pvp') { const editor = document.getElementById('admin-pvp-config'); if (editor) disposePvpEditor(editor); }
          this.activeTab = tab;
          this.renderTabs();
          this.renderActiveTab();
          const workspace = this.modal?.querySelector<HTMLElement>('.modal-card--admin');
          if (workspace) workspace.scrollTop = 0;
        }
      });
    });
    this.modal?.querySelector('.admin-tabs-nav')?.addEventListener('keydown', (event) => {
      const keyboard = event as KeyboardEvent;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboard.key)) return;
      const buttons = [...(this.modal?.querySelectorAll<HTMLButtonElement>('.admin-tab-btn') ?? [])];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0 || !buttons.length) return;
      keyboard.preventDefault();
      const next = keyboard.key === 'Home' ? 0 : keyboard.key === 'End' ? buttons.length - 1 : (current + (keyboard.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
      buttons[next]?.click();
    });

    // DESIGN tab → shared theme system (no second design system)
    document.getElementById('btn-admin-open-design')?.addEventListener('click', () => openDesignMode());

    document.getElementById('studio-publish')?.addEventListener('click', async () => {
      if (!this.config) return;
      document.getElementById('studio-save')?.click();
      const button = document.getElementById('studio-publish') as HTMLButtonElement;
      button.disabled = true;
      const host = document.getElementById('studio-status')!;
      const endLoading = beginLoading(host, 'Publishing animations…');
      try {
        const media = loadStudioStore(); const result = await saveAdminConfig({ creatorMedia: media });
        if (!result.success) { GameToast(result.error || 'Could not publish animations.', 'danger'); return; }
        this.config.creatorMedia = media; setLiveConfig(this.config);
        host.textContent = 'Published. Players receive these animations with the game configuration.';
      } finally { endLoading(); button.disabled = false; }
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
    document.getElementById('admin-campaign-story-chapter')?.addEventListener('change', () => this.renderContentEditor());
    document.getElementById('btn-save-campaign-story')?.addEventListener('click', () => void this.saveCampaignStory());
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
    const nav = this.modal?.querySelector<HTMLElement>('.admin-tabs-nav');
    nav?.setAttribute('role', 'tablist');
    nav?.setAttribute('aria-label', 'Admin workspace sections');
    nav?.querySelectorAll<HTMLButtonElement>('.admin-tab-btn').forEach((btn) => {
      const active = btn.dataset.tab === this.activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(active));
      if (btn.dataset.tab) btn.setAttribute('aria-controls', `admin-tab-${btn.dataset.tab}`);
      btn.tabIndex = active ? 0 : -1;
    });
    for (const panel of this.modal?.querySelectorAll<HTMLElement>('.admin-panel-tab') ?? []) {
      const active = panel.id === `admin-tab-${this.activeTab}`;
      panel.classList.toggle('hidden', !active);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-hidden', String(!active));
      if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
    }
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

  private renderCatalogEditors(tab?: AdminTab): void {
    if (!this.config) return;
    const missions = document.getElementById('admin-missions-list');
    const achievements = document.getElementById('admin-achievements-list');
    const badges = document.getElementById('admin-badges-list');
    const ranks = document.getElementById('admin-ranks-list');
    const slicers = document.getElementById('admin-slicers-list');
    if (missions && (!tab || tab === 'missions')) renderMissionEditor(missions, this.config.missions);
    if (achievements && (!tab || tab === 'achievements')) renderAchievementEditor(achievements, this.config.achievements);
    if (badges && (!tab || tab === 'badges')) renderBadgeEditor(badges, this.config.badges);
    if (ranks && (!tab || tab === 'ranks')) renderRankEditor(ranks, this.config.ranks);
    if (slicers && (!tab || tab === 'slicers')) renderSlicerEditor(slicers, this.config.slicers);
    this.enhanceNumericControls();
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
      this.renderCatalogEditors(this.activeTab);
    } else if (this.activeTab === 'sprites') {
      installMediaStudio();
    } else if (this.activeTab === 'landscape') {
      this.renderLandscapeEditor();
    } else if (this.activeTab === 'branding') {
      this.renderBrandingEditor();
    } else if (this.activeTab === 'economy' || this.activeTab === 'pvp') {
      this.renderEconomyEditor();
    } else if (this.activeTab === 'content') {
      this.renderContentEditor();
    } else if (this.activeTab === 'leaderboard') {
      this.renderLeaderboardManager();
    }
    this.enhanceNumericControls();
  }

  private enhanceNumericControls(): void {
    const tab = document.getElementById(`admin-tab-${this.activeTab}`);
    if (!tab) return;
    for (const input of tab.querySelectorAll<HTMLInputElement>('input[type="number"]')) {
      if (input.classList.contains('studio-input') || input.value.trim() === '') continue;
      const value = Number(input.value);
      if (!Number.isFinite(value)) continue;
      const min = input.min === '' ? 0 : Number(input.min);
      const max = input.max === '' ? Math.max(min + 100, value * 2, 100) : Number(input.max);
      input.min = String(Math.min(min, value));
      input.max = String(Math.max(max, value));
      if (!input.step || input.step === 'any') input.step = Number.isInteger(value) ? '1' : '0.1';
      input.type = 'range';
      const output = document.createElement('output');
      output.className = 'admin-range-value';
      output.id = `admin-range-value-${++sliderOutputId}`;
      output.value = input.value;
      output.textContent = input.value;
      input.dataset.valueOutput = output.id;
      input.setAttribute('aria-valuetext', input.value);
      input.insertAdjacentElement('afterend', output);
    }
  }

  // VIP Tiers Editor (PR7)
  private renderVipEditor(): void {
    const container = document.getElementById('admin-vip-list');
    if (!container || !this.config) return;
    container.replaceChildren();

    const colors = { bronze: '#d89a57', silver: '#c3ccd8', gold: '#f5c542' } as const;
    const fields: Array<{ key: keyof AdminConfig['vipTiers'][number]; label: string; type: 'text' | 'number' | 'textarea'; min?: number; max?: number }> = [
      { key: 'title', label: 'Tier name', type: 'text' },
      { key: 'price', label: 'Price (coins)', type: 'number', min: 0 },
      { key: 'coinBonus', label: 'Coin bonus (%)', type: 'number', min: 0, max: 100 },
      { key: 'xpBonus', label: 'XP bonus (%)', type: 'number', min: 0, max: 100 },
      { key: 'dailyCoins', label: 'Daily coins', type: 'number', min: 0 },
      { key: 'dailySp', label: 'Daily skill points', type: 'number', min: 0 },
      { key: 'exclusiveSkins', label: 'Exclusive skin IDs', type: 'text' },
      { key: 'description', label: 'Player-facing benefits', type: 'textarea' },
    ];
    for (const vip of this.config.vipTiers) {
      const card = document.createElement('section');
      card.className = 'admin-card admin-vip-card';
      const header = document.createElement('header');
      header.className = 'admin-vip-card__header';
      const mark = document.createElement('span');
      mark.className = 'admin-vip-card__mark';
      mark.style.color = colors[vip.tier] ?? colors.bronze;
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '◆';
      const title = document.createElement('strong');
      title.textContent = vip.title;
      const tier = document.createElement('span');
      tier.className = 'admin-vip-card__tier';
      tier.textContent = vip.tier;
      header.append(mark, title, tier);

      const form = document.createElement('div');
      form.className = 'admin-vip-card__fields';
      for (const field of fields) {
        const label = document.createElement('label');
        label.className = 'admin-label';
        const caption = document.createElement('span');
        caption.textContent = field.label;
        let input: HTMLInputElement | HTMLTextAreaElement;
        if (field.type === 'textarea') input = document.createElement('textarea');
        else { input = document.createElement('input'); input.type = field.type; }
        input.className = 'admin-input';
        input.dataset.vip = vip.tier;
        input.dataset.field = String(field.key);
        const current = vip[field.key];
        input.value = Array.isArray(current) ? current.join(', ') : String(current ?? '');
        if (input instanceof HTMLTextAreaElement) { input.rows = 3; input.maxLength = 240; }
        if (input instanceof HTMLInputElement) {
          if (field.min !== undefined) input.min = String(field.min);
          if (field.max !== undefined) input.max = String(field.max);
          if (field.type === 'number') input.step = '1';
        }
        label.append(caption, input);
        form.appendChild(label);

        input.addEventListener('input', () => {
          const vipObj = this.config?.vipTiers.find((entry) => entry.tier === vip.tier);
          if (!vipObj) return;
          if (field.key === 'exclusiveSkins') {
            vipObj.exclusiveSkins = input.value.split(',').map((skin) => skin.trim()).filter(Boolean);
          } else if (field.type !== 'number') {
            (vipObj[field.key] as string) = input.value;
            if (field.key === 'title') title.textContent = input.value || 'Untitled tier';
          } else {
            const parsed = Number(input.value);
            const bounded = Number.isFinite(parsed) ? Math.max(field.min ?? 0, Math.min(field.max ?? Number.MAX_SAFE_INTEGER, parsed)) : 0;
            (vipObj[field.key] as number) = bounded;
          }
        });
      }
      card.append(header, form);
      container.appendChild(card);
    }
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
            <span>Gems</span>
            <input type="number" class="admin-in-gems" data-idx="${idx}" value="${r.gems ?? 0}" min="0" step="1" />
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

      card.querySelector('.admin-in-coins')?.addEventListener('input', (e) => {
        this.config!.dailyRewards[idx].coins = Number((e.target as HTMLInputElement).value);
      });
      card.querySelector('.admin-in-gems')?.addEventListener('input', (e) => {
        this.config!.dailyRewards[idx].gems = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0));
      });
      card.querySelector('.admin-in-sp')?.addEventListener('input', (e) => {
        this.config!.dailyRewards[idx].skillPoints = Number((e.target as HTMLInputElement).value);
      });
      card.querySelector('.admin-in-icon')?.addEventListener('change', (e) => {
        this.config!.dailyRewards[idx].iconType = (e.target as HTMLSelectElement).value as any;
      });
      card.querySelector('.admin-in-label')?.addEventListener('input', (e) => {
        this.config!.dailyRewards[idx].label = (e.target as HTMLInputElement).value;
      });
      card.querySelector('.admin-in-item')?.addEventListener('input', (e) => {
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
    if (inTheme) inTheme.value = menuConfig.themeColor || '#ffca28';
    this.bindDraftInput(inEyebrow, value => { if (this.config) this.config.menuConfig.eyebrow = value; });
    this.bindDraftInput(inTitle, value => { if (this.config) this.config.menuConfig.title = value; });
    this.bindDraftInput(inSubtitle, value => { if (this.config) this.config.menuConfig.subtitle = value; });
    this.bindDraftInput(inAnnouncement, value => { if (this.config) this.config.menuConfig.announcement = value; });
    this.bindDraftInput(inTheme, value => { if (this.config) this.config.menuConfig.themeColor = value; });
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

  private renderLandscapeEditor(): void {
    if (!this.config) return;
    const host = document.getElementById('admin-landscape-config');
    if (!host) return;
    renderConfigForm(host, this.config.landscapeConfig, () => {
      window.dispatchEvent(new CustomEvent('fruit-td-landscape-update', { detail: this.config?.landscapeConfig }));
    });
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
    [inMoney, inLives, inScoreMul, inSuperMul].forEach(syncRangeOutput);
    const bindNumber = (input: HTMLInputElement | null, field: keyof AdminConfig['gameplayConfig']) => {
      this.bindDraftInput(input, value => {
        if (!this.config || !value.trim()) return;
        const number = Number(value);
        if (Number.isFinite(number)) this.config.gameplayConfig[field] = number;
      });
    };
    bindNumber(inMoney, 'startMoney');
    bindNumber(inLives, 'startLives');
    bindNumber(inScoreMul, 'scoreMultiplier');
    bindNumber(inSuperMul, 'superChargeMultiplier');
    const pvpEditor = document.getElementById('admin-pvp-config');
    if (pvpEditor && this.activeTab === 'pvp') {
      renderPvpEditor(pvpEditor, this.config.pvpConfig);
      this.config.coopConfig = normalizeCoopConfig(this.config.coopConfig);
      const team = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = 'Online Co-op: waves, bosses and equal rewards';
      const fields = document.createElement('div'); team.append(heading, fields); pvpEditor.append(team);
      renderConfigForm(fields, this.config.coopConfig);
    }
  }

  private async renderLeaderboardManager(): Promise<void> {
    const listEl = document.getElementById('admin-lb-table');
    if (!listEl) return;
    const requestId = ++this.leaderboardRequest;
    const loading = document.createElement('p');
    loading.className = 'admin-empty-state';
    loading.textContent = 'Loading leaderboard scores…';
    listEl.replaceChildren(loading);

    let entries: any[];
    try {
      entries = await adminFetchLeaderboards();
    } catch {
      if (requestId !== this.leaderboardRequest) return;
      const message = document.createElement('p');
      message.className = 'admin-empty-state admin-empty-state--error';
      message.textContent = 'Could not load leaderboard scores.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'admin-btn-action';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => { void this.renderLeaderboardManager(); });
      listEl.replaceChildren(message, retry);
      return;
    }
    if (requestId !== this.leaderboardRequest) return;
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty-state';
      empty.textContent = 'No scores found.';
      listEl.replaceChildren(empty);
      return;
    }

    listEl.replaceChildren();
    entries.forEach((e: any) => {
      const row = document.createElement('div');
      row.className = 'admin-lb-row';
      const cells: Array<[string, string]> = [
        ['font-bold text-white text-xs w-28 truncate', String(e.steamPersona || e.nickname || 'Player')],
        ['text-xs text-slate-300 w-16 uppercase', String(e.mode || '')],
        ['text-xs text-lime-400 font-bold w-20', Number(e.score || 0).toLocaleString()],
        ['text-xs text-slate-400 w-14', `W${e.wave ?? 0}`],
        ['text-[10px] text-slate-500 flex-1 truncate', String(e._id || '')],
      ];
      for (const [className, text] of cells) {
        const cell = document.createElement('span'); cell.className = className; cell.textContent = text; row.appendChild(cell);
      }
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button'; deleteButton.className = 'admin-del-btn'; deleteButton.dataset.id = String(e._id || ''); deleteButton.textContent = 'Delete';
      row.appendChild(deleteButton);

      row.querySelector('.admin-del-btn')?.addEventListener('click', async () => {
        const ok = await confirmModal({
          title: 'Delete leaderboard score?',
          message: `Remove ${e.nickname}'s score of ${e.score} points?`,
          confirmLabel: 'Delete score',
          tone: 'danger',
        });
        if (ok) {
          if (!await adminDeleteScore(e._id)) { GameToast('Could not delete this score. Try again.', 'danger'); return; }
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


    const published = structuredClone(this.config);
    const res = await saveAdminConfig(published);

    if (statusEl) {
      statusEl.textContent = res.message || res.error || 'Saved!';
      statusEl.className = res.success ? 'admin-status-ok' : 'admin-status-err';
    }

    if (res.success) {
      setLiveConfig(published);
      this.onConfigSaved?.(published);
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

  private async saveCampaignStory(): Promise<void> {
    if (!this.config) return;
    const chapter = Number((document.getElementById('admin-campaign-story-chapter') as HTMLSelectElement | null)?.value);
    const title = (document.getElementById('admin-campaign-story-title') as HTMLInputElement | null)?.value.trim() || '';
    const text = (document.getElementById('admin-campaign-story-text') as HTMLTextAreaElement | null)?.value.trim() || '';
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 20 || !title || !text || title.length > 80 || text.length > 900) {
      GameToast('Choose a chapter and enter a title and story.', 'warning'); return;
    }
    const stories = DEFAULT_CAMPAIGN_STORIES.map((fallback) => this.config?.campaignStories?.[fallback.chapter - 1] ?? fallback);
    stories[chapter - 1] = { chapter, title, text };
    const updated = { ...this.config, campaignStories: stories };
    const result = await saveAdminConfig(updated);
    if (!result.success) { GameToast(result.error || 'Could not save chapter.', 'danger'); return; }
    this.config = updated; setLiveConfig(updated); this.onConfigSaved?.(updated);
    const status = document.getElementById('admin-save-status');
    if (status) { status.textContent = `Chapter ${chapter} saved to MongoDB.`; status.className = 'admin-status-ok'; }
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
    const storySelect = document.getElementById('admin-campaign-story-chapter') as HTMLSelectElement | null;
    if (storySelect && !storySelect.options.length) for (let chapter = 1; chapter <= 20; chapter++) storySelect.add(new Option(`Chapter ${String(chapter).padStart(2, '0')} · Stage ${chapter * 5}`, String(chapter)));
    if (storySelect) {
      const story = this.config?.campaignStories?.[Number(storySelect.value || 1) - 1] ?? DEFAULT_CAMPAIGN_STORIES[Number(storySelect.value || 1) - 1];
      const title = document.getElementById('admin-campaign-story-title') as HTMLInputElement | null;
      const text = document.getElementById('admin-campaign-story-text') as HTMLTextAreaElement | null;
      if (title) title.value = story?.title || '';
      if (text) text.value = story?.text || '';
    }
    const stageSelect = document.getElementById('admin-campaign-boss-stage') as HTMLSelectElement | null;
    if (stageSelect && !stageSelect.options.length) for (let stage = 1; stage <= 100; stage++) stageSelect.add(new Option(`Stage ${String(stage).padStart(2, '0')}`, String(stage)));
    if (stageSelect) {
      const boss = this.config?.campaignBosses?.[Number(stageSelect.value || 1) - 1] ?? defaultCampaignBoss(Number(stageSelect.value || 1));
      (document.getElementById('admin-campaign-boss-name') as HTMLInputElement | null)?.setAttribute('value', boss.name);
      const nameInput = document.getElementById('admin-campaign-boss-name') as HTMLInputElement | null; if (nameInput) nameInput.value = boss.name;
      const titleInput = document.getElementById('admin-campaign-boss-title') as HTMLInputElement | null; if (titleInput) titleInput.value = boss.title;
      const descInput = document.getElementById('admin-campaign-boss-description') as HTMLTextAreaElement | null; if (descInput) descInput.value = boss.description;
      const difficultyInput = document.getElementById('admin-campaign-boss-difficulty') as HTMLInputElement | null; if (difficultyInput) difficultyInput.value = String(boss.difficulty);
      syncRangeOutput(difficultyInput);
      const coinsInput = document.getElementById('admin-campaign-boss-coins') as HTMLInputElement | null; if (coinsInput) coinsInput.value = String(boss.rewardCoins);
      if (coinsInput) coinsInput.max = String(Math.floor((campaignWaves(Number(stageSelect.value)) + 1) * 100 / 1.5));
      syncRangeOutput(coinsInput);
      const gemsInput = document.getElementById('admin-campaign-boss-gems') as HTMLInputElement | null; if (gemsInput) gemsInput.value = String(boss.rewardGems);
      if (gemsInput) gemsInput.max = String(Math.floor((campaignWaves(Number(stageSelect.value)) + 1) / 5));
      syncRangeOutput(gemsInput);
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
