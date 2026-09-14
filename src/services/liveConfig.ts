import { DEFAULT_ADMIN_CONFIG, fetchAdminConfig, mergeAdminConfig, type AdminConfig } from './admin';
import { setLiveWavesConfig } from '../game/creatorWaves';

const BASE_START_MONEY = DEFAULT_ADMIN_CONFIG.gameplayConfig.startMoney;
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

const BRANDING_LS_KEY = 'fruit-td-menu-branding-v1';

type LocalBranding = {
  backgroundImage?: string;
  logoImage?: string;
  faviconImage?: string;
};

function readLocalBranding(): LocalBranding {
  try {
    const raw = localStorage.getItem(BRANDING_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalBranding;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalBranding(partial: LocalBranding): void {
  const cur = { ...readLocalBranding(), ...partial };
  localStorage.setItem(BRANDING_LS_KEY, JSON.stringify(cur));
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
  const localBrand = readLocalBranding();
  const backgroundImage = (localBrand.backgroundImage || config.menuConfig.backgroundImage || '').trim();
  const logoImage = (localBrand.logoImage || config.menuConfig.logoImage || '').trim();
  const faviconImage = (localBrand.faviconImage || config.menuConfig.faviconImage || '').trim();
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
}

export async function loadLiveConfig(): Promise<AdminConfig> {
  if (!loadPromise) {
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

export function getStartMoneyScale(): number {
  const value = Number(cached.gameplayConfig.startMoney);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value / BASE_START_MONEY;
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
