/**
 * Theme asset system.
 *
 * Controlled replacement of a fixed set of visual slots. Arbitrary paths can
 * never be injected: uploads become validated data URLs, and URL entries must
 * pass `sanitizeAssetUrl` (http(s), root-relative or data:image only).
 *
 * Storage reuses the project's existing client-side branding/localStorage
 * approach — no new storage backend is introduced. When an asset CDN is added
 * later, only `uploadThemeAsset` needs to change.
 */
import { themeStore } from './themeStore';
import type { ThemeAssets } from './types';
import { sanitizeAssetUrl } from './validate';

export type ThemeAssetSlot = keyof ThemeAssets;

export const THEME_ASSET_SLOTS: { slot: ThemeAssetSlot; label: string }[] = [
  { slot: 'logo', label: 'Logo' },
  { slot: 'background', label: 'Background' },
  { slot: 'panelBackground', label: 'Panel background' },
  { slot: 'buttonImage', label: 'Button image' },
  { slot: 'heroArtwork', label: 'Hero artwork' },
  { slot: 'menuArtwork', label: 'Menu artwork' },
  { slot: 'favicon', label: 'Favicon' },
  { slot: 'decor', label: 'Decorative asset' },
];

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024;

export function isThemeAssetSlot(value: string): value is ThemeAssetSlot {
  return THEME_ASSET_SLOTS.some((a) => a.slot === value);
}

export interface AssetResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Reads an uploaded file into a validated data URL and assigns it to a slot. */
export function uploadThemeAsset(slot: ThemeAssetSlot, file: File): Promise<AssetResult> {
  return new Promise((resolve) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      resolve({ ok: false, error: `Unsupported file type: ${file.type || 'unknown'}` });
      return;
    }
    if (file.size > MAX_BYTES) {
      resolve({ ok: false, error: 'File too large (max 2 MB)' });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: 'Could not read file' });
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const safe = sanitizeAssetUrl(url);
      if (!safe) {
        resolve({ ok: false, error: 'File did not produce a safe image URL' });
        return;
      }
      setThemeAsset(slot, safe);
      resolve({ ok: true, url: safe });
    };
    reader.readAsDataURL(file);
  });
}

/** Sets a slot from a URL string. Rejects unsafe values. */
export function setThemeAsset(slot: ThemeAssetSlot, url: string): AssetResult {
  const safe = sanitizeAssetUrl(url);
  if (safe === null) return { ok: false, error: 'Unsafe or malformed URL' };
  themeStore.patch({ assets: { [slot]: safe } });
  if (slot === 'favicon') applyFavicon(safe);
  return { ok: true, url: safe };
}

export function clearThemeAsset(slot: ThemeAssetSlot): void {
  themeStore.patch({ assets: { [slot]: '' } });
  if (slot === 'favicon') applyFavicon('');
}

export function getThemeAsset(slot: ThemeAssetSlot): string {
  return themeStore.get().assets[slot];
}

function applyFavicon(href: string): void {
  if (typeof document === 'undefined' || !href) return;
  let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
