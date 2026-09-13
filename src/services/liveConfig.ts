import { DEFAULT_ADMIN_CONFIG, fetchAdminConfig, mergeAdminConfig, type AdminConfig } from './admin';

const BASE_START_MONEY = DEFAULT_ADMIN_CONFIG.gameplayConfig.startMoney;
const BASE_START_LIVES = DEFAULT_ADMIN_CONFIG.gameplayConfig.startLives;

let cached: AdminConfig = mergeAdminConfig(DEFAULT_ADMIN_CONFIG);
let loadPromise: Promise<AdminConfig> | null = null;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getLiveConfig(): AdminConfig {
  return cached;
}

export function applyMenuAppearance(config: AdminConfig = cached): void {
  const { eyebrow, title, subtitle, announcement, themeColor } = config.menuConfig;
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
}

export function setLiveConfig(config: AdminConfig): void {
  cached = config;
  applyMenuAppearance(config);
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
