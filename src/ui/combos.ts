import './gameFeel.css';
import './slicerPreview';

const STREAKS: { n: number; title: string; color: string }[] = [
  { n: 2, title: 'DOUBLE SLICE!', color: '#60a5fa' },
  { n: 3, title: 'TRIPLE SLICE!', color: '#34d399' },
  { n: 5, title: 'MULTISLICER!', color: '#fbbf24' },
  { n: 8, title: 'ULTRASLICE!', color: '#fb7185' },
  { n: 15, title: 'UNSTOPPABLE!', color: '#c084fc' },
  { n: 20, title: 'MEGASLICER!', color: '#f97316' },
  { n: 30, title: 'MONSTERSLICER!', color: '#ef4444' },
];

type Slot = 'hit' | 'streak' | 'reslice';

export class ComboFx {
  private readonly layer: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly avEl: HTMLImageElement;
  private readonly slots: Record<Slot, HTMLElement | null> = { hit: null, streak: null, reslice: null };
  private window = 0;
  private kills = 0;
  private lastTier = 0;

  constructor() {
    this.layer = document.getElementById('combo-layer')!;
    this.nameEl = document.getElementById('player-name')!;
    this.avEl = document.getElementById('player-avatar') as HTMLImageElement;
  }

  setPlayer(name: string, avatar: string): void { this.nameEl.textContent = name; this.avEl.src = avatar; }
  reset(): void {
    this.window = 0; this.kills = 0; this.lastTier = 0;
    for (const el of Object.values(this.slots)) { if (!el) continue; el.classList.remove('is-live','is-swap'); el.textContent=''; }
  }
  update(dt: number): void { if (this.window > 0) { this.window -= dt; if (this.window <= 0) { this.kills=0; this.lastTier=0; } } }
  onHits(n: number, combo: number): void { if (n > 0) this.show('hit',`x${combo}`,comboColor(combo),'hit-pop'); }
  onReslice(n: number,nx?: number,ny?: number): void { if (n > 0) this.show('reslice',`RESLICE x${n}`,n>=2?'#4ade80':'#86efac','reslice-pop',nx,ny); }
  onKills(n: number): void {
    if (n <= 0) return;
    this.window=1.7; this.kills+=n;
    let title='',color='#fff',tier=0;
    for (const s of STREAKS) if (this.kills>=s.n) { title=s.title;color=s.color;tier=s.n; }
    if (title && tier>this.lastTier) { this.lastTier=tier; this.show('streak',title,color,'streak-pop'); }
  }
  private show(slot: Slot,text:string,color:string,cls:string,nx?:number,ny?:number): void {
    let el=this.slots[slot];
    if(!el){el=document.createElement('div');this.layer.appendChild(el);this.slots[slot]=el;}
    const replacing=el.classList.contains('is-live')&&el.textContent!=='';
    el.className=cls;el.textContent=text;el.style.color=color;
    if(nx!=null&&ny!=null){el.style.left=`${nx}%`;el.style.top=`${ny}%`;}else{el.style.removeProperty('left');el.style.removeProperty('top');}
    el.classList.remove('is-live','is-swap');void el.offsetWidth;el.classList.add('is-live');if(replacing)el.classList.add('is-swap');
  }
}
function comboColor(n:number):string{if(n>=12)return'#ef4444';if(n>=8)return'#f97316';if(n>=5)return'#fbbf24';if(n>=3)return'#34d399';return'#93c5fd';}
