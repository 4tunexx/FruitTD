let iconSeq = 0;

function uniquifySvg(svg: string): string {
  const n = ++iconSeq;
  return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`);
}

const RAW = {
  coin: `<svg class="w-10 h-10 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="url(#coin_gold)" stroke="#F59E0B" stroke-width="3"/>
    <circle cx="32" cy="32" r="22" stroke="#FDE68A" stroke-width="2" stroke-dasharray="4 2"/>
    <circle cx="32" cy="32" r="17" fill="#FBBF24"/>
    <path d="M32 20V44M26 25C26 22.5 28.5 22 32 22C35.5 22 37.5 23.5 37.5 26C37.5 30 26 30 26 34.5C26 37 28 38.5 32 38.5C36 38.5 38 37.5 38 35" stroke="#78350F" stroke-width="3.5" stroke-linecap="round"/>
    <defs>
      <linearGradient id="coin_gold" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FDE68A"/>
        <stop offset="0.5" stop-color="#F59E0B"/>
        <stop offset="1" stop-color="#D97706"/>
      </linearGradient>
    </defs>
  </svg>`,

  gem: `<svg class="w-10 h-10 drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 14L42 14L54 26L32 52L10 26L22 14Z" fill="url(#gem_cyan)" stroke="#38BDF8" stroke-width="2.5"/>
    <path d="M22 14L32 26L42 14" stroke="#E0F2FE" stroke-width="2"/>
    <path d="M10 26L32 26L54 26" stroke="#BAE6FD" stroke-width="2"/>
    <path d="M32 26L32 52" stroke="#BAE6FD" stroke-width="2"/>
    <defs>
      <linearGradient id="gem_cyan" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7DD3FC"/>
        <stop offset="0.5" stop-color="#0284C7"/>
        <stop offset="1" stop-color="#0369A1"/>
      </linearGradient>
    </defs>
  </svg>`,

  chest: `<svg class="w-10 h-10 drop-shadow-[0_0_16px_rgba(245,158,11,0.8)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="24" width="48" height="28" rx="6" fill="url(#chest_gold)" stroke="#F59E0B" stroke-width="2.5"/>
    <path d="M8 26C8 17.5 18 14 32 14C46 14 56 17.5 56 26H8Z" fill="url(#chest_top)" stroke="#F59E0B" stroke-width="2.5"/>
    <rect x="28" y="24" width="8" height="12" rx="3" fill="#FEF3C7" stroke="#92400E" stroke-width="2"/>
    <circle cx="32" cy="29" r="2" fill="#78350F"/>
    <defs>
      <linearGradient id="chest_gold" x1="10" y1="24" x2="54" y2="52" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F59E0B"/>
        <stop offset="1" stop-color="#B45309"/>
      </linearGradient>
      <linearGradient id="chest_top" x1="10" y1="14" x2="54" y2="26" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FDE68A"/>
        <stop offset="1" stop-color="#F59E0B"/>
      </linearGradient>
    </defs>
  </svg>`,

  blade: `<svg class="w-10 h-10 drop-shadow-[0_0_18px_rgba(244,114,182,0.85)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M48 10C48 10 38 18 30 32C24 42 20 48 20 48L16 44C16 44 22 38 32 30C42 20 48 10 48 10Z" fill="url(#blade_glow)" stroke="#F472B6" stroke-width="2.5"/>
    <path d="M14 46L18 50L12 56L8 52L14 46Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
    <circle cx="16" cy="48" r="3" fill="#F43F5E"/>
    <defs>
      <linearGradient id="blade_glow" x1="20" y1="12" x2="48" y2="40" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FDE047"/>
        <stop offset="0.4" stop-color="#F472B6"/>
        <stop offset="1" stop-color="#8B5CF6"/>
      </linearGradient>
    </defs>
  </svg>`,

  check: `<svg class="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
  </svg>`,

  lock: `<svg class="w-5 h-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
  </svg>`,
};

export const ICONS = {
  get coin() {
    return uniquifySvg(RAW.coin);
  },
  get gem() {
    return uniquifySvg(RAW.gem);
  },
  get chest() {
    return uniquifySvg(RAW.chest);
  },
  get blade() {
    return uniquifySvg(RAW.blade);
  },
  check: RAW.check,
  lock: RAW.lock,
};

export function getRewardSvg(type?: 'coin' | 'gem' | 'chest' | 'blade', fallbackCoins = 0): string {
  if (type === 'blade') return ICONS.blade;
  if (type === 'chest') return ICONS.chest;
  if (type === 'gem') return ICONS.gem;
  if (type === 'coin') return ICONS.coin;
  if (fallbackCoins >= 1000) return ICONS.blade;
  if (fallbackCoins >= 400) return ICONS.chest;
  if (fallbackCoins > 0 && fallbackCoins < 150) return ICONS.coin;
  return ICONS.coin;
}
