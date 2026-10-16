import { setPublishedCreatorMedia } from '../game/creatorMedia';
import { DEFAULT_ADMIN_CONFIG, fetchAdminConfig, mergeAdminConfig, type AdminConfig } from './admin';
import { setLiveWavesConfig } from '../game/creatorWaves';

const BASE_START_LIVES = DEFAULT_ADMIN_CONFIG.gameplayConfig.startLives;

let cached: AdminConfig = mergeAdminConfig(DEFAULT_ADMIN_CONFIG);
let loadPromise: Promise<AdminConfig> | null = null;

// Prefer published AdminConfig.waves when planning waves.
setLiveWavesConfig(cached.waves);

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getLiveConfig(): AdminConfig {
  return cached;
}

function imageValue(url = ''): string {
  return url.trim() ? `url("${url.trim().replace(/"/g, '\\"')}")` : 'none';
}

/** Keep the selected hub page and Home mode's artwork in sync with published branding. */
export function applyPanelOneAppearance(root: HTMLElement, page: string, mode = '', config: AdminConfig = cached): void {
  root.dataset.panelPage = page;
  root.dataset.panelMode = mode;
  const images = config.menuConfig.panelBackgrounds || {};
  root.style.setProperty('--panel-one-image', imageValue((mode && page === 'MAIN_MENU' ? images[mode] : '') || images[page]));
  root.classList.toggle('has-panel-one-image', !!((mode && page === 'MAIN_MENU' ? images[mode] : '') || images[page]));
}

function applyFavicon(href: string): void {
  const link =
    (document.getElementById('app-favicon') as HTMLLinkElement | null) ||
    (document.querySelector('link[rel="icon"]') as HTMLLinkElement | null);
  if (!href) {
    document.documentElement.setAttribute('data-menu-favicon', 'default');
    return;
  }
  let el = link;
  if (!el) {
    el = document.createElement('link');
    el.id = 'app-favicon';
    el.rel = 'icon';
    document.head.appendChild(el);
  }
  el.id = 'app-favicon';
  el.rel = 'icon';
  // Bust cache so live uploads show immediately
  const bust = href.startsWith('data:') ? href : `${href}${href.includes('?') ? '&' : '?'}v=${Date.now()}`;
  el.href = bust;
  if (href.startsWith('data:image/svg')) el.type = 'image/svg+xml';
  else if (href.startsWith('data:image/png') || href.endsWith('.png')) el.type = 'image/png';
  else if (href.endsWith('.ico')) el.type = 'image/x-icon';
  else el.removeAttribute('type');
  document.documentElement.setAttribute('data-menu-favicon', 'custom');
  document.documentElement.style.setProperty('--menu-favicon-image', href.startsWith('data:') || href.startsWith('http') || href.startsWith('/')
    ? `url("${href.replace(/"/g, '\\"')}")`
    : 'none');
}

export function applyMenuAppearance(config: AdminConfig = cached): void {
  const { eyebrow, title, subtitle, announcement, themeColor } = config.menuConfig;
  const backgroundImage = (config.menuConfig.backgroundImage || '').trim();
  const logoImage = (config.menuConfig.logoImage || '').trim();
  const faviconImage = (config.menuConfig.faviconImage || '').trim();
  const authLogoImage = (config.menuConfig.authLogoImage || logoImage).trim();
  const loadingImage = (config.menuConfig.loadingImage || '').trim();
  const loadingBackgroundImage = (config.menuConfig.loadingBackgroundImage || '').trim();
  const eyebrowEl = document.getElementById('menu-eyebrow');
  const titleEl = document.getElementById('menu-title');
  const subtitleEl = document.getElementById('menu-subtitle');
  const announceEl = document.getElementById('menu-announcement');

  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
  if (titleEl) titleEl.innerHTML = escapeHtml(title).replace(/\n/g, '<br>');
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (announceEl) {
    announceEl.textContent = announcement;
    announceEl.classList.toggle('hidden', !announcement.trim());
  }
  const titleEyebrowEl = document.getElementById('title-eyebrow');
  const logoCaptionEl = document.getElementById('title-logo-caption');
  if (titleEyebrowEl) titleEyebrowEl.textContent = config.menuConfig.titleEyebrow;
  if (logoCaptionEl) logoCaptionEl.textContent = config.menuConfig.logoCaption;
  document.querySelector('.title-logo')?.setAttribute('aria-label', `Fruit TD — ${config.menuConfig.logoCaption}`);
  if (themeColor) {
    document.documentElement.style.setProperty('--lime', themeColor);
    document.documentElement.style.setProperty('--border-glow', `${themeColor}66`);
  }

  const bgValue = backgroundImage ? `url("${backgroundImage.replace(/"/g, '\\"')}")` : 'none';
  const logoValue = logoImage ? `url("${logoImage.replace(/"/g, '\\"')}")` : 'none';
  document.documentElement.style.setProperty('--menu-bg-image', bgValue);
  document.documentElement.style.setProperty('--menu-logo-image', logoValue);
  document.documentElement.setAttribute('data-menu-bg', backgroundImage ? 'custom' : 'default');
  document.documentElement.setAttribute('data-menu-logo', logoImage ? 'custom' : 'default');
  document.documentElement.style.setProperty('--auth-logo-image', imageValue(authLogoImage));
  document.documentElement.style.setProperty('--loading-image', imageValue(loadingImage));
  document.documentElement.style.setProperty('--loading-background-image', imageValue(loadingBackgroundImage));
  document.documentElement.classList.toggle('has-auth-logo-image', !!authLogoImage);
  document.documentElement.classList.toggle('has-loading-image', !!loadingImage);
  document.documentElement.classList.toggle('has-loading-background-image', !!loadingBackgroundImage);
  const hub = document.getElementById('screen-hub');
  if (hub) applyPanelOneAppearance(hub, hub.dataset.panelPage || 'MAIN_MENU', hub.dataset.panelMode || '', config);

  document.querySelectorAll<HTMLElement>('[data-branding="menu"]').forEach((el) => {
    el.style.setProperty('--menu-bg-image', bgValue);
    el.style.setProperty('--menu-logo-image', logoValue);
    el.setAttribute('data-bg-custom', backgroundImage ? '1' : '0');
    el.setAttribute('data-logo-custom', logoImage ? '1' : '0');
  });
  document.querySelectorAll<HTMLElement>('[data-branding-logo]').forEach((el) => {
    el.style.backgroundImage = logoValue === 'none' ? '' : logoValue;
    el.classList.toggle('is-visible', !!logoImage);
  });
  document.querySelectorAll<HTMLElement>('.menu-parallax__bg').forEach((el) => {
    el.style.backgroundImage = bgValue === 'none' ? '' : bgValue;
    el.classList.toggle('is-custom', !!backgroundImage);
  });

  applyFavicon(faviconImage);
}

export function setLiveConfig(config: AdminConfig): void {
  cached = config;
  applyMenuAppearance(config);
  setLiveWavesConfig(cached.waves);
  setPublishedCreatorMedia(cached.creatorMedia);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fruit-td-landscape-update', { detail: cached.landscapeConfig }));
}

export async function loadLiveConfig(force = false): Promise<AdminConfig> {
  if (force || !loadPromise) {
    loadPromise = fetchAdminConfig().then((config) => {
      if (config) setLiveConfig(mergeAdminConfig(config));
      return cached;
    });
  }
  return loadPromise;
}

export function getScoreMultiplier(): number {
  const value = Number(cached.gameplayConfig.scoreMultiplier);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getSuperChargeMultiplier(): number {
  const value = Number(cached.gameplayConfig.superChargeMultiplier);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getStartLivesScale(): number {
  const value = Number(cached.gameplayConfig.startLives);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value / BASE_START_LIVES;
}

export function getSlicers() {
  return cached.slicers;
}

export function getEnabledSlicers() {
  return cached.slicers.filter((s) => s.enabled !== false);
}
