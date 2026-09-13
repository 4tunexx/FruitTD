/**
 * Phase 1 presentation/runtime glue.
 * Keeps the existing game systems usable while upgrading the shell into a game-first
 * experience: persistent progression is surfaced, navigation is obvious, and mobile
 * controls get a safer viewport without replacing the actual game loop.
 */

const SAVE_KEY = 'fruit-td-save-v1';
const HERO_LEVELS: Record<string, number> = { jiju: 1, topfu: 10, lagen: 25, tripos: 50, ki: 75 };
const HERO_NAMES: Record<string, string> = {
  jiju: 'Master Jiju', topfu: 'Topfu', lagen: 'Lagen', tripos: 'Tripos', ki: 'Master Ki',
};

function readSave(): any | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function heroLevel(save: any, id: string): number {
  const xp = Math.max(0, Number(save?.xp?.[id]) || 0);
  let low = 1, high = 100;
  const xpFor = (lv: number) => lv === 1 ? 0 : Math.floor(35 * Math.pow(lv - 1, 1.58) + 20 * (lv - 1));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (xpFor(mid) <= xp) low = mid; else high = mid - 1;
  }
  return low;
}

function ensureProgressPanel(): void {
  if (typeof document === 'undefined' || document.getElementById('phase1-progress-panel')) return;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const panel = document.createElement('section');
  panel.id = 'phase1-progress-panel';
  panel.setAttribute('aria-label', 'Persistent progression');
  panel.innerHTML = `
    <div class="phase1-progress-head"><span>PROGRESSION</span><b id="phase1-hero-level">HERO LV 1/100</b></div>
    <div class="phase1-progress-row"><span id="phase1-hero-name">Master Jiju</span><span id="phase1-hero-xp">0 XP</span></div>
    <div class="phase1-progress-track"><i id="phase1-hero-fill"></i></div>
    <div class="phase1-progress-row"><span>MAIN TOWER</span><b id="phase1-tower-level">LV 1/10</b></div>
    <div class="phase1-progress-track"><i id="phase1-tower-fill"></i></div>
  `;
  sidebar.insertBefore(panel, sidebar.querySelector('#hud-shop') || sidebar.firstChild);
}

function updateProgressPanel(): void {
  if (typeof document === 'undefined') return;
  const save = readSave();
  if (!save) return;
  const hero = String(save.hero || 'jiju');
  const lv = heroLevel(save, hero);
  const xp = Math.max(0, Number(save.xp?.[hero]) || 0);
  const xpFor = (level: number) => level === 1 ? 0 : Math.floor(35 * Math.pow(level - 1, 1.58) + 20 * (level - 1));
  const current = xpFor(lv);
  const next = lv >= 100 ? current : Math.floor(35 * Math.pow(lv, 1.58) + 20 * lv);
  const heroPct = lv >= 100 ? 100 : Math.max(0, Math.min(100, ((xp - current) / Math.max(1, next - current)) * 100));
  const towerXp = Math.max(0, Number(save.towerXp) || 0);
  const towerThresholds = [0, 120, 300, 560, 900, 1320, 1820, 2400, 3060, 3800];
  let tl = 1;
  for (let i = 1; i < towerThresholds.length; i++) if (towerXp >= towerThresholds[i]) tl = i + 1;
  const towerCurrent = towerThresholds[Math.min(tl - 1, towerThresholds.length - 1)] || 0;
  const towerNext = tl >= 10 ? towerCurrent : towerThresholds[tl];
  const towerPct = tl >= 10 ? 100 : Math.max(0, Math.min(100, ((towerXp - towerCurrent) / Math.max(1, towerNext - towerCurrent)) * 100));
  const heroLevelEl = document.getElementById('phase1-hero-level');
  const heroNameEl = document.getElementById('phase1-hero-name');
  const heroXpEl = document.getElementById('phase1-hero-xp');
  const heroFill = document.getElementById('phase1-hero-fill') as HTMLElement | null;
  const towerLevelEl = document.getElementById('phase1-tower-level');
  const towerFill = document.getElementById('phase1-tower-fill') as HTMLElement | null;
  if (heroLevelEl) heroLevelEl.textContent = `HERO LV ${lv}/100${lv >= 100 ? ' · MAX' : ''}`;
  if (heroNameEl) heroNameEl.textContent = HERO_NAMES[hero] || 'Master Jiju';
  if (heroXpEl) heroXpEl.textContent = `${xp.toLocaleString()} XP`;
  if (heroFill) heroFill.style.width = `${heroPct}%`;
  if (towerLevelEl) towerLevelEl.textContent = `LV ${tl}/10${tl >= 10 ? ' · MAX' : ''}`;
  if (towerFill) towerFill.style.width = `${towerPct}%`;
}

function ensureGameHomeButton(): void {
  if (typeof document === 'undefined' || document.getElementById('phase1-home-button')) return;
  const hud = document.getElementById('hud');
  if (!hud) return;
  const button = document.createElement('button');
  button.id = 'phase1-home-button';
  button.type = 'button';
  button.textContent = 'MAIN MENU';
  button.title = 'Return to the Fruit TD main menu';
  button.addEventListener('click', () => {
    const quit = document.getElementById('btn-quit-menu') as HTMLButtonElement | null;
    const over = document.getElementById('btn-over-menu') as HTMLButtonElement | null;
    if (quit && !quit.disabled && !quit.classList.contains('hidden')) quit.click();
    else if (over && !over.disabled && !over.classList.contains('hidden')) over.click();
    else document.getElementById('title-screen')?.classList.remove('hidden');
  });
  hud.appendChild(button);
}

function ensureLoadoutOverlay(): void {
  if (typeof document === 'undefined' || document.getElementById('phase1-loadout')) return;
  const app = document.getElementById('app');
  if (!app) return;
  const panel = document.createElement('section');
  panel.id = 'phase1-loadout';
  panel.className = 'hidden';
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <div class="phase1-loadout-card">
      <div class="phase1-loadout-head"><div><small>PLAYER LOADOUT</small><h2>Heroes & Inventory</h2></div><button id="phase1-loadout-close" type="button">×</button></div>
      <div id="phase1-loadout-body"></div>
    </div>`;
  app.appendChild(panel);
  document.getElementById('phase1-loadout-close')?.addEventListener('click', () => panel.classList.add('hidden'));
}

function renderLoadout(): void {
  if (typeof document === 'undefined') return;
  const body = document.getElementById('phase1-loadout-body');
  if (!body) return;
  const save = readSave();
  if (!save) return;
  const ownedHeroes = new Set<string>(Array.isArray(save.ownedHeroes) ? save.ownedHeroes : ['jiju']);
  const heroCards = Object.keys(HERO_NAMES).map((id) => {
    const level = heroLevel(save, id);
    const owned = ownedHeroes.has(id);
    const required = HERO_LEVELS[id];
    const purchase = id === 'tripos' ? 1800 : id === 'ki' ? 3000 : 0;
    return `<article class="phase1-hero-card ${owned ? '' : 'is-locked'}">
      <div><strong>${HERO_NAMES[id]}</strong><span>LV ${level}/100</span></div>
      <small>${owned ? (id === 'jiju' ? 'Starter hero' : 'Owned') : (purchase ? `Purchase ${purchase.toLocaleString()} coins` : `Unlock at Jiju LV ${required}`)}</small>
    </article>`;
  }).join('');
  const skins = Array.isArray(save.ownedSkins) ? save.ownedSkins : [];
  const inventory = skins.length ? skins.map((id: string) => `<span class="phase1-inventory-item">${id}${id === save.bladeSkin || id === save.wallSkin ? ' · EQUIPPED' : ''}</span>`).join('') : '<span class="phase1-empty">Inventory empty</span>';
  body.innerHTML = `<div class="phase1-loadout-section"><h3>HEROES</h3><div class="phase1-hero-grid">${heroCards}</div></div>
    <div class="phase1-loadout-section"><h3>INVENTORY <small>OWNED ITEMS ONLY</small></h3><div class="phase1-inventory">${inventory}</div></div>`;
}

function installLoadoutButton(): void {
  if (typeof document === 'undefined' || document.getElementById('phase1-loadout-button')) return;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const button = document.createElement('button');
  button.id = 'phase1-loadout-button';
  button.type = 'button';
  button.textContent = 'LOADOUT · HEROES · INVENTORY';
  button.addEventListener('click', () => {
    ensureLoadoutOverlay();
    renderLoadout();
    document.getElementById('phase1-loadout')?.classList.remove('hidden');
  });
  sidebar.appendChild(button);
}

function installMobileSafety(): void {
  if (typeof document === 'undefined') return;
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no');
  document.documentElement.style.setProperty('overscroll-behavior', 'none');
  document.body.style.setProperty('overscroll-behavior', 'none');
}

function installStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('phase1-runtime-style')) return;
  const style = document.createElement('style');
  style.id = 'phase1-runtime-style';
  style.textContent = `
    #phase1-progress-panel{margin:8px 0 10px;padding:10px 11px;border:1px solid rgba(163,230,53,.22);border-radius:12px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(21,32,25,.92));box-shadow:0 10px 28px rgba(0,0,0,.22);font-family:Outfit,system-ui,sans-serif}
    .phase1-progress-head,.phase1-progress-row{display:flex;justify-content:space-between;gap:8px;align-items:center}.phase1-progress-head{font-size:10px;letter-spacing:.14em;color:#a3e635;font-weight:900}.phase1-progress-row{font-size:11px;color:#cbd5e1;margin-top:6px}.phase1-progress-track{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:5px}.phase1-progress-track i{display:block;width:0;height:100%;border-radius:99px;background:#a3e635;box-shadow:0 0 10px rgba(163,230,53,.45);transition:width .25s ease}
    #phase1-home-button,#phase1-loadout-button{font:800 11px Outfit,system-ui,sans-serif;letter-spacing:.08em;color:#e2e8f0;background:rgba(15,23,42,.92);border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:9px 11px;cursor:pointer}#phase1-home-button{position:absolute;left:14px;bottom:14px;z-index:80}#phase1-loadout-button{width:100%;margin-top:8px}#phase1-home-button:hover,#phase1-loadout-button:hover{border-color:#a3e635;color:#a3e635}
    #phase1-loadout{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.72);backdrop-filter:blur(8px)}#phase1-loadout.hidden{display:none}.phase1-loadout-card{width:min(900px,100%);max-height:min(88vh,760px);overflow:auto;border:1px solid rgba(163,230,53,.25);border-radius:18px;background:linear-gradient(145deg,#111827,#172018);box-shadow:0 24px 80px rgba(0,0,0,.5);padding:18px;color:#f8fafc}.phase1-loadout-head{display:flex;justify-content:space-between;align-items:flex-start}.phase1-loadout-head small{font-size:10px;letter-spacing:.18em;color:#a3e635;font-weight:900}.phase1-loadout-head h2{margin:4px 0 0;font-size:24px}.phase1-loadout-head button{border:0;background:transparent;color:#94a3b8;font-size:30px;cursor:pointer}.phase1-loadout-section{margin-top:18px}.phase1-loadout-section h3{font-size:11px;letter-spacing:.15em;color:#a3e635}.phase1-loadout-section h3 small{color:#64748b;letter-spacing:.04em}.phase1-hero-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.phase1-hero-card{padding:12px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}.phase1-hero-card>div{display:flex;flex-direction:column;gap:4px}.phase1-hero-card strong{font-size:13px}.phase1-hero-card span,.phase1-hero-card small{color:#94a3b8;font-size:10px}.phase1-hero-card.is-locked{opacity:.55}.phase1-inventory{display:flex;flex-wrap:wrap;gap:7px}.phase1-inventory-item,.phase1-empty{padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:11px;color:#cbd5e1}
    @media(max-width:860px){#phase1-home-button{left:10px;bottom:max(10px,env(safe-area-inset-bottom))}.phase1-hero-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.phase1-loadout-card{padding:14px;border-radius:14px}.phase1-loadout-head h2{font-size:20px}}
  `;
  document.head.appendChild(style);
}

function install(): void {
  if (typeof document === 'undefined') return;
  installStyles();
  installMobileSafety();
  ensureProgressPanel();
  ensureGameHomeButton();
  installLoadoutButton();
  ensureLoadoutOverlay();
  updateProgressPanel();
  window.setInterval(() => {
    ensureProgressPanel();
    ensureGameHomeButton();
    installLoadoutButton();
    updateProgressPanel();
  }, 1000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
