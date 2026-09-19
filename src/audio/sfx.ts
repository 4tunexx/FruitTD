import type { FruitKind } from '../game/fruits';

const wavLoaders = import.meta.glob('../../Sound/*.wav', {
  query: '?url',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function fileKey(path: string): string {
  const slash = path.replace(/\\/g, '/');
  const name = slash.slice(slash.lastIndexOf('/') + 1);
  return name.replace(/\.wav$/i, '').toLowerCase();
}

const loaderByName = new Map<string, () => Promise<string>>();
for (const [path, loader] of Object.entries(wavLoaders)) {
  loaderByName.set(fileKey(path), loader);
}

function names(...list: string[]): string[] {
  return list.filter((n) => loaderByName.has(n.toLowerCase()));
}

const BANKS = {
  swipe: names(
    'Sword-swipe-1',
    'Sword-swipe-2',
    'Sword-swipe-3',
    'Sword-swipe-4',
    'Sword-swipe-5',
    'Sword-swipe-6',
    'Sword-swipe-7',
    'bamboo-swipe-1',
    'bamboo-swipe-2',
    'bamboo-swipe-3',
    'bamboo-swipe-4',
    'pixel-swipe-1',
    'pixel-swipe-2',
    'pixel-swipe-3',
    'pixel-swipe-4',
  ),
  swipeBlitz: names(
    'blade-rainbow-1',
    'blade-rainbow-2',
    'blade-rainbow-3',
    'blade-rainbow-4',
    'blade-rainbow-5',
    'blade-lightning-1',
    'blade-lightning-2',
    'blade-lightning-3',
  ),
  cleanSlice: names('Clean-Slice-1', 'Clean-Slice-2', 'Clean-Slice-3'),
  lemonImpact: names(
    'Impact-Orange',
    'Impact-Banana',
    'Impact-Apple',
    'Impact-Pineapple',
    'bamboo-impact-1',
    'bamboo-impact-2',
    'bamboo-impact-3',
    'bamboo-impact-4',
  ),
  berryImpact: names(
    'Impact-Strawberry',
    'Impact-Plum',
    'Impact-kiwifruit',
    'Impact-Apple',
    'pixel-impact-1',
    'pixel-impact-2',
    'pixel-impact-3',
    'pixel-impact-4',
    'pixel-impact-5',
  ),
  melonImpact: names(
    'Impact-Watermelon',
    'Impact-Coconut',
    'Impact-Coconut-More-Attack',
    'dragonfruit',
    'Critical',
    'Visceral-impact-1',
    'Visceral-impact-2',
    'Visceral-impact-3',
  ),
  waterBlade: names('blade-water-1', 'blade-water-2', 'blade-water-3', 'blade-water-4', 'blade-water-5'),
  waterImpact: names('blade-water-impact-1', 'blade-water-impact-2', 'blade-water-impact-3'),
  inkBlade: names('blade-ink-1', 'blade-ink-2', 'blade-ink-3', 'blade-ink-4', 'blade-ink-5'),
  blossom: names(
    'blade-cherry-blossom-1-1',
    'blade-cherry-blossom-1-2',
    'blade-cherry-blossom-1-3',
    'blade-cherry-blossom-1-4',
  ),
  cloud: names('blade-cloud-1-1', 'blade-cloud-1-2', 'blade-cloud-1-3', 'blade-cloud-1-4'),
  dragonSwipe: names(
    'blade-dragon-swipe-1',
    'blade-dragon-swipe-2',
    'blade-dragon-swipe-3',
    'blade-dragon-swipe-4',
    'blade-dragon-swipe-5',
    'blade-dragon-swipe-6',
    'blade-dragon-swipe-7',
    'blade-dragon-swipe-8',
  ),
  dragonImpact: names('blade-dragon-impact-1', 'blade-dragon-impact-2', 'blade-dragon-impact-3'),
  pomeSlice: names('pome-slice-1', 'pome-slice-2', 'pome-slice-3'),
  splatterSmall: names('Splatter-Small-1', 'Splatter-Small-2'),
  splatterMed: names('Splatter-Medium-1', 'Splatter-Medium-2'),
  pulp: names('Pulp-drip-1', 'Pulp-drip-2'),
  combo: names('combo-1', 'combo-2', 'combo-3', 'combo-4', 'combo-5', 'Combo-6', 'Combo-7', 'Combo-8'),
  comboAngel: names('angel-combo-1', 'angel-combo-2', 'angel-combo-3', 'angel-combo-4', 'angel-combo-5'),
  comboBlitzHit: names(
    'combo-blitz-1',
    'combo-blitz-2',
    'combo-blitz-3',
    'combo-blitz-4',
    'combo-blitz-5',
    'combo-blitz-6',
  ),
  comboSting: names('Combo'),
  impactMusic: names(
    'impact-music-1',
    'impact-music-2',
    'impact-music-3',
    'impact-music-4',
    'impact-music-5',
    'impact-music-6',
    'impact-music-7',
  ),
  bombExplode: names('Bomb-explode', 'Bonus-Explosion-1', 'Bonus-Explosion-3', 'Bonus-Explosion-5'),
  firecrackerSlice: names('firecracker-blade-slice-1', 'firecracker-blade-slice-2', 'firecracker-blade-slice-3'),
  firecrackerSwipe: names(
    'firecracker-blade-swipe-1',
    'firecracker-blade-swipe-2',
    'firecracker-blade-swipe-3',
    'firecracker-blade-swipe-4',
    'firecracker-blade-swipe-5',
  ),
  weaponLaunch: names('Bonus-Firework-Launch', 'player-bomb-launch', 'blade-lightning-4', 'blade-lightning-5'),
  weaponBoom: names('Bonus-Firework-Explode', 'Bonus-Explosion-1', 'gutsus-shop-impact'),
  shopTap: names('gutsus-shop-button-tap', 'ui-button-push', 'store-fruit-slice', 'Next-screen-button'),
  shopMove: names('equip-screen-move-1', 'equip-screen-move-2', 'equip-screen-move-3', 'gutsus-shop-scroll'),
  shopChop: names('gutsus-shop-crate-chop', 'gutsus-shop-impact'),
  shopEnter: names('gutsus-shop-section-enter', 'popup-1', 'ui-screen-whoosh'),
  popups: names('popup-1', 'popup-2', 'popup-3', 'popup-4', 'popup-5', 'popup-6', 'popup-7', 'popup-8'),
  tick: names('Time-tick', 'Time-tock', 'time-beep', 'progress-count', 'Bonus-count-up'),
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly inflight = new Map<string, Promise<AudioBuffer | null>>();
  /** Admin Media Studio sound-bank overrides keyed by BANKS array identity. */
  private readonly studioByBank = new WeakMap<string[], string>();
  private readonly loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private lastSwipeAt = 0;
  private lastDripAt = 0;
  private lastMoveAt = 0;
  private lastTickAt = 0;
  private lastFireAt = 0;
  private lastSliceAt = 0;
  private lastAnyAt = 0;
  private voices = 0;
  private current: AudioBufferSourceNode | null = null;
  private muted = false;
  ready = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.45;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 18;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;
      this.ctx = ctx;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  async unlock(): Promise<void> {
    this.ensure();
    const priority = [
      'Game-start',
      'Game-over',
      'Pause',
      'Unpause',
      'Sword-swipe-1',
      'Sword-swipe-2',
      'Sword-swipe-3',
      'Clean-Slice-1',
      'Clean-Slice-2',
      'Clean-Slice-3',
      'combo-1',
      'combo-2',
      'combo-3',
      'combo-4',
      'combo-5',
      'Critical',
      'Bomb-explode',
      'gutsus-shop-button-tap',
      'gutsus-shop-crate-chop',
      'equip-unlock',
      'equip-locked',
      'item-increment',
      'gank',
    ];
    await this.preload(priority);
    this.ready = true;
    void this.loadStudioSoundBank();
  }

  /** Optional: prefer admin Media Studio dataURL replacements for matching BANKS slots. */
  private async loadStudioSoundBank(): Promise<void> {
    try {
      const { loadSoundBank, SOUND_BANK_SLOTS } = await import('../ui/adminMediaStudio');
      const store = loadSoundBank();
      const bankMap = BANKS as Record<string, string[]>;
      for (const slot of SOUND_BANK_SLOTS) {
        const dataUrl = store.replacements[slot.id];
        if (!dataUrl) continue;
        const bank = bankMap[slot.id];
        if (!bank) continue;
        const buf = await this.decodeDataUrl(dataUrl);
        if (!buf) continue;
        const key = `studio:${slot.id}`;
        this.buffers.set(key, buf);
        this.studioByBank.set(bank, key);
      }
    } catch {
      /* studio sound bank is optional */
    }
  }

  private async decodeDataUrl(dataUrl: string): Promise<AudioBuffer | null> {
    try {
      const ctx = this.ensure();
      const res = await fetch(dataUrl);
      const raw = await res.arrayBuffer();
      return await ctx.decodeAudioData(raw.slice(0));
    } catch {
      return null;
    }
  }

  async preload(list: string[]): Promise<void> {
    const unique = [...new Set(list.map((n) => n.toLowerCase()))];
    const queue = unique.filter((n) => loaderByName.has(n) && !this.buffers.has(n));
    const workers = 4;
    let i = 0;
    await Promise.all(
      Array.from({ length: workers }, async () => {
        while (i < queue.length) {
          const name = queue[i++];
          await this.decode(name);
        }
      }),
    );
  }

  private async decode(name: string): Promise<AudioBuffer | null> {
    const key = name.toLowerCase();
    const hit = this.buffers.get(key);
    if (hit) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const loader = loaderByName.get(key);
    if (!loader) return null;
    const work = (async () => {
      try {
        const url = await loader();
        const ctx = this.ensure();
        const res = await fetch(url);
        const raw = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(key, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, work);
    return work;
  }

  private pick(bank: string[]): string | null {
    if (!bank.length) return null;
    return bank[(Math.random() * bank.length) | 0];
  }

  play(name: string | null, opts: { volume?: number; rate?: number; interrupt?: boolean; ui?: boolean } = {}): void {
    if (!name || !this.ready) return;
    const now = performance.now();
    const cap = opts.ui ? 3 : 2;
    const gap = opts.ui ? 40 : 48;
    if (!opts.interrupt && (this.voices >= cap || now - this.lastAnyAt < gap)) return;
    const key = name.toLowerCase();
    const buf = this.buffers.get(key);
    if (!buf || !this.master) return;
    const ctx = this.ensure();
    if (opts.interrupt && this.current) {
      try {
        this.current.stop();
      } catch {
        /* already stopped */
      }
      this.current = null;
      this.voices = 0;
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const vol = Math.min(0.5, opts.volume ?? 0.35);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    src.connect(gain);
    gain.connect(this.master);
    this.voices = 1;
    this.lastAnyAt = now;
    this.current = src;
    src.onended = () => {
      if (this.current === src) this.current = null;
      this.voices = Math.max(0, this.voices - 1);
    };
    src.start();
  }

  playBank(bank: string[], opts?: { volume?: number; rate?: number; interrupt?: boolean; ui?: boolean }): void {
    const studioKey = this.studioByBank.get(bank);
    if (studioKey) {
      this.play(studioKey, opts);
      return;
    }
    this.play(this.pick(bank), opts);
  }

  /** Play a Creator Hub / sound-bank slot by id (custom override or BANKS fallback). */
  playStudioSlot(slotId: string, opts?: { volume?: number; rate?: number; interrupt?: boolean; ui?: boolean }): void {
    if (!slotId) return;
    const studioKey = `studio:${slotId}`;
    if (this.buffers.has(studioKey)) {
      this.play(studioKey, opts ?? { volume: 0.35 });
      return;
    }
    const bankMap = BANKS as Record<string, string[]>;
    const bank = bankMap[slotId];
    if (bank) {
      this.playBank(bank, opts ?? { volume: 0.35 });
      return;
    }
    // One-shot filenames used by SOUND_BANK_SLOTS (gameStart, gameOver, critical, …).
    const oneShots: Record<string, string> = {
      gameStart: 'Game-start',
      gameOver: 'Game-over',
      critical: 'Critical',
    };
    const name = oneShots[slotId];
    if (name) this.play(name, opts ?? { volume: 0.35 });
  }

  startLoop(_id: string, _name: string, _volume = 0.55): void {}

  stopLoop(id: string, fade = 0.18): void {
    const loop = this.loops.get(id);
    if (!loop || !this.ctx) return;
    const now = this.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
    loop.src.stop(now + fade + 0.02);
    this.loops.delete(id);
  }

  stopAllLoops(): void {
    for (const id of [...this.loops.keys()]) this.stopLoop(id, 0.08);
  }

  gameStart(): void {
    this.play('Game-start', { volume: 0.4 });
  }

  gameOver(): void {
    this.stopAllLoops();
    this.play('Game-over', { volume: 0.55, interrupt: true });
  }

  pause(): void {
    this.play('Pause', { volume: 0.8 });
  }

  unpause(): void {
    this.play('Unpause', { volume: 0.8 });
  }

  swipe(blitz: boolean): void {
    const now = performance.now();
    if (now - this.lastSwipeAt < 70) return;
    this.lastSwipeAt = now;
    if (blitz) this.playBank(BANKS.swipeBlitz, { volume: 0.55 });
    else this.playBank(BANKS.swipe, { volume: 0.42, rate: 0.94 + Math.random() * 0.12 });
  }

  slice(_kind: FruitKind, _combo: number, _blitz = false): void {
    const now = performance.now();
    if (now - this.lastSliceAt < 100) return;
    this.lastSliceAt = now;
    this.playBank(BANKS.cleanSlice, { volume: 0.42, rate: 0.97 + Math.random() * 0.06, interrupt: true });
  }

  combo(combo: number, _blitz = false): void {
    if (combo < 2) return;
    const idx = Math.min(BANKS.combo.length - 1, combo - 2);
    this.play(BANKS.combo[idx], { volume: 0.42, interrupt: true });
  }

  bombExplode(): void {
    this.playBank(BANKS.bombExplode, { volume: 0.4 });
  }

  bombParry(): void {
    this.play('powerup-deflect', { volume: 0.4 });
  }

  /** Distinct callout when a dangerous special enemy spawns (§7). */
  enemyWarning(): void {
    this.play('time-beep', { volume: 0.32, interrupt: true });
  }

  bombFuse(_active: boolean): void {}

  throwFruit(): void {}

  throwBomb(): void {}

  leak(): void {
    this.play('gank', { volume: 0.35 });
  }

  drip(): void {
    const now = performance.now();
    if (now - this.lastDripAt < 280) return;
    this.lastDripAt = now;
    this.playBank(BANKS.pulp, { volume: 0.22 });
  }

  blitzStart(): void {
    this.play('Bonus-Banana-Frenzy', { volume: 0.4, interrupt: true });
  }

  blitzEnd(): void {
    this.stopAllLoops();
  }

  freeze(): void {
    this.play('Bonus-Banana-Freeze', { volume: 0.7 });
  }

  boost(): void {
    this.play('powerup-starfruit', { volume: 0.4, interrupt: true });
  }

  stopBoost(): void {
    this.stopLoop('boostBurn', 0.2);
  }

  fire(_blitz = false): void {
    const now = performance.now();
    if (now - this.lastFireAt < 160) return;
    this.lastFireAt = now;
    this.playBank(BANKS.weaponLaunch, { volume: 0.18 });
  }

  place(): void {
    this.playBank(BANKS.shopChop, { volume: 0.55 });
  }

  scrap(): void {
    this.play('gutsus-shop-impact', { volume: 0.4 });
  }

  select(): void {
    this.playBank(BANKS.shopTap, { volume: 0.4, ui: true });
  }

  denied(): void {
    this.play('equip-locked', { volume: 0.65 });
  }

  unlockItem(): void {
    this.play('equip-unlock', { volume: 0.35 });
  }

  cursorMove(): void {
    const now = performance.now();
    if (now - this.lastMoveAt < 55) return;
    this.lastMoveAt = now;
    this.playBank(BANKS.shopMove, { volume: 0.28 });
  }

  rotate(): void {
    this.play('ui-screen-whoosh', { volume: 0.3 });
  }

  toast(): void {}

  wave(): void {
    this.play('item-increment', { volume: 0.3 });
  }

  extraLife(): void {
    this.play('extra-life', { volume: 0.45, interrupt: true });
  }

  bestScore(): void {
    this.play('New-best-score', { volume: 0.5, interrupt: true });
  }

  dangerTick(): void {
    const now = performance.now();
    if (now - this.lastTickAt < 520) return;
    this.lastTickAt = now;
    this.playBank(BANKS.tick, { volume: 0.32 });
  }

  timeUp(): void {
    this.play('time-up', { volume: 0.7 });
  }

  shopHover(): void {
    this.playBank(BANKS.shopEnter, { volume: 0.25 });
  }

  /** Toggle mute; returns true if now muted. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) {
      const ctx = this.ensure();
      this.master.gain.setValueAtTime(this.muted ? 0.0001 : 0.45, ctx.currentTime);
    }
    return this.muted;
  }
}
