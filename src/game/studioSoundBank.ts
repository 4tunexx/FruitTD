import { TURRET_WEAPONS, type WeaponId } from './turretWeapons';
import { getPublishedCreatorMedia } from './creatorMedia';
/** Shared Creator Hub sound-bank data and persistence used by the editor and runtime audio. */
export const SOUND_BANK_STORAGE_KEY = 'admin-media-studio-sfx-v1';

export interface SoundBankStore {
  version: 1;
  replacements: Record<string, string>;
}

/** SFX slots correspond to the named banks in src/audio/sfx.ts. */
export const SOUND_BANK_SLOTS: { id: string; label: string; file: string }[] = [
  ...(['main','guillotine','vortex','laser','railgun','sprinkler','blender'] as const).map((kind,i)=>({id:`turret-${kind}`,label:`${kind==='main'?'Main Tower':TURRET_WEAPONS[kind as WeaponId].name} · fire`,file:['Bonus-Firework-Launch.wav','Sword-swipe-1.wav','blade-lightning-1.wav','blade-rainbow-1.wav','Bonus-Firework-Launch.wav','Impact-Orange.wav','Bonus-Firework-Launch.wav'][i]!})),
  { id: 'swipe', label: 'Swipe', file: 'Sword-swipe-1.wav' },
  { id: 'swipeBlitz', label: 'Swipe Blitz', file: 'blade-rainbow-1.wav' },
  { id: 'cleanSlice', label: 'Clean Slice', file: 'Clean-Slice-1.wav' },
  { id: 'lemonImpact', label: 'Lemon/Citrus Impact', file: 'Impact-Orange.wav' },
  { id: 'berryImpact', label: 'Berry Impact', file: 'Impact-Strawberry.wav' },
  { id: 'melonImpact', label: 'Melon Impact', file: 'Impact-Watermelon.wav' },
  { id: 'bombExplode', label: 'Bomb Explode', file: 'Bomb-explode.wav' },
  { id: 'combo', label: 'Combo', file: 'Combo.wav' },
  { id: 'comboBlitzHit', label: 'Combo Blitz Hit', file: 'combo-blitz-1.wav' },
  { id: 'weaponLaunch', label: 'Weapon Launch', file: 'Bonus-Firework-Launch.wav' },
  { id: 'weaponBoom', label: 'Weapon Boom', file: 'Bonus-Firework-Explode.wav' },
  { id: 'shopTap', label: 'Shop Tap', file: 'ui-button-push.wav' },
  { id: 'shopEnter', label: 'Shop Enter', file: 'ui-screen-whoosh.wav' },
  { id: 'tick', label: 'Tick', file: 'Time-tick.wav' },
  { id: 'gameStart', label: 'Game Start', file: 'Game-start.wav' },
  { id: 'gameOver', label: 'Game Over', file: 'Game-over.wav' },
  { id: 'critical', label: 'Critical', file: 'Critical.wav' },
  { id: 'splatterMed', label: 'Splatter Medium', file: 'Splatter-Medium-1.wav' },
];

export function loadSoundBank(): SoundBankStore {
  const shared=getPublishedCreatorMedia()?.sounds||{};
  try {
    const raw = localStorage.getItem(SOUND_BANK_STORAGE_KEY);
    if (!raw) return { version: 1, replacements: shared };
    const parsed = JSON.parse(raw) as SoundBankStore;
    if (!parsed || parsed.version !== 1 || !parsed.replacements || typeof parsed.replacements !== 'object') {
      return { version: 1, replacements: shared };
    }
    return {...parsed,replacements:{...parsed.replacements,...shared}};
  } catch {
    return { version: 1, replacements: shared };
  }
}

export function saveSoundBank(store: SoundBankStore): void {
  localStorage.setItem(SOUND_BANK_STORAGE_KEY, JSON.stringify(store));
}
