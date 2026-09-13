import {
  REQ_CATEGORIES,
  REQUIREMENT_TYPES,
  newCatalogId,
  requirementById,
  type CatalogAchievement,
  type CatalogBadge,
  type CatalogMission,
  type RankTier,
  type Requirement,
} from '../game/requirements';
import { createEmptySlicer, type CatalogSlicer, type SlicerFxStyle, type SlicerRarity } from '../game/slicers';

function escapeAttr(value: string): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function reqFields(req: Requirement, prefix: string): string {
  const def = requirementById(req.type);
  const category = def?.category || 'slicing';
  const types = REQUIREMENT_TYPES.filter((t) => t.category === category);
  const typeOpts = types.map((t) => `<option value="${t.id}" ${t.id === req.type ? 'selected' : ''}>${t.label}</option>`).join('');
  const catOpts = REQ_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === category ? 'selected' : ''}>${c.label}</option>`).join('');
  return `
    <label><span>Category</span>
      <select class="${prefix}-cat admin-input">${catOpts}</select>
    </label>
    <label class="flex-1"><span>Requirement</span>
      <select class="${prefix}-type admin-input">${typeOpts}</select>
    </label>
    <label><span>Goal / Value</span>
      <input type="number" class="${prefix}-goal admin-input" min="1" value="${req.goal || 1}" />
    </label>
    <label><span>Min Combo / Filter</span>
      <input type="number" class="${prefix}-min admin-input" min="0" value="${req.minValue ?? ''}" placeholder="optional" />
    </label>
    <label><span>Mode filter</span>
      <select class="${prefix}-mode admin-input">
        <option value="" ${!req.mode ? 'selected' : ''}>Any mode</option>
        <option value="casual" ${req.mode === 'casual' ? 'selected' : ''}>Casual</option>
        <option value="ranked" ${req.mode === 'ranked' ? 'selected' : ''}>Ranked</option>
        <option value="arena" ${req.mode === 'arena' ? 'selected' : ''}>Arena</option>
        <option value="coop" ${req.mode === 'coop' ? 'selected' : ''}>Co-op</option>
      </select>
    </label>
    <label><span>Hero filter</span>
      <select class="${prefix}-hero admin-input">
        <option value="" ${!req.hero ? 'selected' : ''}>Any hero</option>
        <option value="jiju" ${req.hero === 'jiju' ? 'selected' : ''}>Master Jiju</option>
        <option value="topfu" ${req.hero === 'topfu' ? 'selected' : ''}>Topfu</option>
        <option value="lagen" ${req.hero === 'lagen' ? 'selected' : ''}>Lagen</option>
        <option value="tripos" ${req.hero === 'tripos' ? 'selected' : ''}>Tripos</option>
        <option value="ki" ${req.hero === 'ki' ? 'selected' : ''}>Master Ki</option>
      </select>
    </label>
    <p class="admin-req-hint">${def?.hint || ''}</p>
  `;
}

function bindReq(root: HTMLElement, prefix: string, getReq: () => Requirement): void {
  const cat = root.querySelector(`.${prefix}-cat`) as HTMLSelectElement | null;
  const type = root.querySelector(`.${prefix}-type`) as HTMLSelectElement | null;
  const goal = root.querySelector(`.${prefix}-goal`) as HTMLInputElement | null;
  const min = root.querySelector(`.${prefix}-min`) as HTMLInputElement | null;
  const mode = root.querySelector(`.${prefix}-mode`) as HTMLSelectElement | null;
  const hero = root.querySelector(`.${prefix}-hero`) as HTMLSelectElement | null;
  const hint = root.querySelector('.admin-req-hint');

  cat?.addEventListener('change', () => {
    const list = REQUIREMENT_TYPES.filter((t) => t.category === cat.value);
    if (type) {
      type.innerHTML = list.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
      if (list[0]) {
        getReq().type = list[0].id;
        if (hint) hint.textContent = list[0].hint;
      }
    }
  });
  type?.addEventListener('change', () => {
    getReq().type = type.value;
    const def = requirementById(type.value);
    if (hint) hint.textContent = def?.hint || '';
  });
  goal?.addEventListener('change', () => {
    getReq().goal = Math.max(1, Number(goal.value) || 1);
  });
  min?.addEventListener('change', () => {
    const n = Number(min.value);
    if (Number.isFinite(n) && n > 0) getReq().minValue = n;
    else delete getReq().minValue;
  });
  mode?.addEventListener('change', () => {
    if (mode.value) getReq().mode = mode.value;
    else delete getReq().mode;
  });
  hero?.addEventListener('change', () => {
    if (hero.value) getReq().hero = hero.value;
    else delete getReq().hero;
  });
}

export function renderMissionEditor(container: HTMLElement, items: CatalogMission[]): void {
  container.innerHTML = '';
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'admin-catalog-card';
    card.innerHTML = `
      <div class="admin-catalog-head">
        <strong>${escapeAttr(item.title) || 'Untitled mission'}</strong>
        <label class="admin-toggle"><input type="checkbox" class="m-on" ${item.enabled ? 'checked' : ''}/> Enabled</label>
        <button type="button" class="admin-del-btn m-del">Remove</button>
      </div>
      <div class="admin-reward-inputs">
        <label><span>Title</span><input class="admin-input m-title" value="${escapeAttr(item.title)}" /></label>
        <label class="flex-1"><span>Description</span><input class="admin-input m-desc" value="${escapeAttr(item.desc)}" /></label>
        <label><span>Icon</span><input class="admin-input m-icon" value="${escapeAttr(item.icon)}" maxlength="4" /></label>
        <label><span>Period</span>
          <select class="admin-input m-period">
            <option value="daily" ${item.type === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${item.type === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${item.type === 'monthly' ? 'selected' : ''}>Monthly</option>
          </select>
        </label>
        <label><span>Coins</span><input type="number" class="admin-input m-coins" value="${item.rewardCoins}" min="0" /></label>
        <label><span>Skill Pts</span><input type="number" class="admin-input m-sp" value="${item.rewardSp}" min="0" /></label>
        <label><span>Badge ID</span><input class="admin-input m-badge" value="${escapeAttr(item.rewardBadge || '')}" placeholder="optional" /></label>
      </div>
      <div class="admin-req-grid">${reqFields(item.requirement, 'm')}</div>
    `;
    card.querySelector('.m-title')?.addEventListener('change', (e) => {
      item.title = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.m-desc')?.addEventListener('change', (e) => {
      item.desc = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.m-icon')?.addEventListener('change', (e) => {
      item.icon = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.m-period')?.addEventListener('change', (e) => {
      item.type = (e.target as HTMLSelectElement).value as CatalogMission['type'];
    });
    card.querySelector('.m-coins')?.addEventListener('change', (e) => {
      item.rewardCoins = Number((e.target as HTMLInputElement).value) || 0;
    });
    card.querySelector('.m-sp')?.addEventListener('change', (e) => {
      item.rewardSp = Number((e.target as HTMLInputElement).value) || 0;
    });
    card.querySelector('.m-badge')?.addEventListener('change', (e) => {
      item.rewardBadge = (e.target as HTMLInputElement).value.trim() || undefined;
    });
    card.querySelector('.m-on')?.addEventListener('change', (e) => {
      item.enabled = (e.target as HTMLInputElement).checked;
    });
    card.querySelector('.m-del')?.addEventListener('click', () => {
      items.splice(idx, 1);
      renderMissionEditor(container, items);
    });
    bindReq(card, 'm', () => item.requirement);
    container.appendChild(card);
  });
}

export function addMission(items: CatalogMission[]): void {
  items.push({
    id: newCatalogId('mission'),
    type: 'daily',
    title: 'New Mission',
    desc: 'Describe what the player must do',
    icon: 'M',
    enabled: true,
    requirement: { type: 'slice_any', goal: 10 },
    rewardCoins: 100,
    rewardSp: 0,
  });
}

export function renderAchievementEditor(container: HTMLElement, items: CatalogAchievement[]): void {
  container.innerHTML = '';
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'admin-catalog-card';
    card.innerHTML = `
      <div class="admin-catalog-head">
        <strong>${escapeAttr(item.title) || 'Untitled achievement'}</strong>
        <label class="admin-toggle"><input type="checkbox" class="a-on" ${item.enabled ? 'checked' : ''}/> Enabled</label>
        <button type="button" class="admin-del-btn a-del">Remove</button>
      </div>
      <div class="admin-reward-inputs">
        <label><span>Title</span><input class="admin-input a-title" value="${escapeAttr(item.title)}" /></label>
        <label class="flex-1"><span>Description</span><input class="admin-input a-desc" value="${escapeAttr(item.desc)}" /></label>
        <label><span>Icon</span><input class="admin-input a-icon" value="${escapeAttr(item.icon)}" maxlength="4" /></label>
        <label><span>Coins</span><input type="number" class="admin-input a-coins" value="${item.rewardCoins}" min="0" /></label>
        <label><span>Skill Pts</span><input type="number" class="admin-input a-sp" value="${item.rewardSp}" min="0" /></label>
        <label><span>Badge ID</span><input class="admin-input a-badge" value="${escapeAttr(item.rewardBadge || '')}" /></label>
      </div>
      <div class="admin-req-grid">${reqFields(item.requirement, 'a')}</div>
    `;
    card.querySelector('.a-title')?.addEventListener('change', (e) => {
      item.title = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.a-desc')?.addEventListener('change', (e) => {
      item.desc = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.a-icon')?.addEventListener('change', (e) => {
      item.icon = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.a-coins')?.addEventListener('change', (e) => {
      item.rewardCoins = Number((e.target as HTMLInputElement).value) || 0;
    });
    card.querySelector('.a-sp')?.addEventListener('change', (e) => {
      item.rewardSp = Number((e.target as HTMLInputElement).value) || 0;
    });
    card.querySelector('.a-badge')?.addEventListener('change', (e) => {
      item.rewardBadge = (e.target as HTMLInputElement).value.trim() || undefined;
    });
    card.querySelector('.a-on')?.addEventListener('change', (e) => {
      item.enabled = (e.target as HTMLInputElement).checked;
    });
    card.querySelector('.a-del')?.addEventListener('click', () => {
      items.splice(idx, 1);
      renderAchievementEditor(container, items);
    });
    bindReq(card, 'a', () => item.requirement);
    container.appendChild(card);
  });
}

export function addAchievement(items: CatalogAchievement[]): void {
  items.push({
    id: newCatalogId('ach'),
    title: 'New Achievement',
    desc: 'What the player must accomplish',
    icon: 'A',
    enabled: true,
    requirement: { type: 'slice_any', goal: 25 },
    rewardCoins: 150,
    rewardSp: 0,
  });
}

export function renderBadgeEditor(container: HTMLElement, items: CatalogBadge[]): void {
  container.innerHTML = '';
  items.forEach((item, idx) => {
    if (!item.requirement) item.requirement = { type: 'slice_any', goal: 1 };
    const card = document.createElement('div');
    card.className = 'admin-catalog-card';
    card.innerHTML = `
      <div class="admin-catalog-head">
        <strong>${escapeAttr(item.title) || 'Untitled badge'}</strong>
        <label class="admin-toggle"><input type="checkbox" class="b-on" ${item.enabled ? 'checked' : ''}/> Enabled</label>
        <button type="button" class="admin-del-btn b-del">Remove</button>
      </div>
      <div class="admin-reward-inputs">
        <label><span>Title</span><input class="admin-input b-title" value="${escapeAttr(item.title)}" /></label>
        <label class="flex-1"><span>Description</span><input class="admin-input b-desc" value="${escapeAttr(item.desc)}" /></label>
        <label><span>Icon</span><input class="admin-input b-icon" value="${escapeAttr(item.icon)}" maxlength="4" /></label>
        <label><span>ID</span><input class="admin-input b-id" value="${escapeAttr(item.id)}" /></label>
        <label><span>Rarity</span>
          <select class="admin-input b-rarity">
            <option value="common" ${item.rarity === 'common' ? 'selected' : ''}>Common</option>
            <option value="rare" ${item.rarity === 'rare' ? 'selected' : ''}>Rare</option>
            <option value="epic" ${item.rarity === 'epic' ? 'selected' : ''}>Epic</option>
            <option value="legendary" ${item.rarity === 'legendary' ? 'selected' : ''}>Legendary</option>
          </select>
        </label>
      </div>
      <div class="admin-req-grid">${reqFields(item.requirement, 'b')}</div>
    `;
    card.querySelector('.b-title')?.addEventListener('change', (e) => {
      item.title = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.b-desc')?.addEventListener('change', (e) => {
      item.desc = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.b-icon')?.addEventListener('change', (e) => {
      item.icon = (e.target as HTMLInputElement).value;
    });
    card.querySelector('.b-id')?.addEventListener('change', (e) => {
      item.id = (e.target as HTMLInputElement).value.trim() || item.id;
    });
    card.querySelector('.b-rarity')?.addEventListener('change', (e) => {
      item.rarity = (e.target as HTMLSelectElement).value as CatalogBadge['rarity'];
    });
    card.querySelector('.b-on')?.addEventListener('change', (e) => {
      item.enabled = (e.target as HTMLInputElement).checked;
    });
    card.querySelector('.b-del')?.addEventListener('click', () => {
      items.splice(idx, 1);
      renderBadgeEditor(container, items);
    });
    bindReq(card, 'b', () => item.requirement!);
    container.appendChild(card);
  });
}

export function addBadge(items: CatalogBadge[]): void {
  items.push({
    id: newCatalogId('badge'),
    title: 'New Badge',
    desc: 'Earned by completing the requirement',
    icon: 'B',
    rarity: 'common',
    enabled: true,
    requirement: { type: 'slice_any', goal: 1 },
  });
}

export function renderRankEditor(container: HTMLElement, items: RankTier[]): void {
  container.innerHTML = '';
  items
    .slice()
    .sort((a, b) => a.minScore - b.minScore)
    .forEach((item) => {
      const idx = items.indexOf(item);
      const card = document.createElement('div');
      card.className = 'admin-catalog-card admin-rank-card';
      card.innerHTML = `
        <div class="admin-catalog-head">
          <strong style="color:${escapeAttr(item.color)}">${escapeAttr(item.title)}</strong>
          <button type="button" class="admin-del-btn r-del">Remove</button>
        </div>
        <div class="admin-reward-inputs">
          <label><span>ID</span><input class="admin-input r-id" value="${escapeAttr(item.id)}" /></label>
          <label><span>Title</span><input class="admin-input r-title" value="${escapeAttr(item.title)}" /></label>
          <label><span>Min monthly score</span><input type="number" class="admin-input r-score" value="${item.minScore}" min="0" /></label>
          <label><span>Color</span><input type="color" class="admin-input admin-color r-color" value="${escapeAttr(item.color)}" /></label>
          <label><span>Icon</span><input class="admin-input r-icon" value="${escapeAttr(item.icon)}" maxlength="3" /></label>
        </div>
      `;
      card.querySelector('.r-id')?.addEventListener('change', (e) => {
        item.id = (e.target as HTMLInputElement).value.trim() || item.id;
      });
      card.querySelector('.r-title')?.addEventListener('change', (e) => {
        item.title = (e.target as HTMLInputElement).value;
      });
      card.querySelector('.r-score')?.addEventListener('change', (e) => {
        item.minScore = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
      });
      card.querySelector('.r-color')?.addEventListener('change', (e) => {
        item.color = (e.target as HTMLInputElement).value;
      });
      card.querySelector('.r-icon')?.addEventListener('change', (e) => {
        item.icon = (e.target as HTMLInputElement).value;
      });
      card.querySelector('.r-del')?.addEventListener('click', () => {
        items.splice(idx, 1);
        renderRankEditor(container, items);
      });
      container.appendChild(card);
    });
}

export function addRank(items: RankTier[]): void {
  items.push({ id: newCatalogId('rank'), title: 'New Rank', minScore: 1000, color: '#a3e635', icon: 'R' });
}

function sliderField(
  cls: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  hint: string
): string {
  return `<label class="admin-slider-field">
    <span>${label} <em class="s-val">${value}</em></span>
    <input type="range" class="admin-input ${cls}" min="${min}" max="${max}" step="${step}" value="${value}" />
    <small>${hint}</small>
  </label>`;
}

export function renderSlicerEditor(container: HTMLElement, items: CatalogSlicer[]): void {
  container.innerHTML = '';
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'admin-catalog-card admin-slicer-card';
    const preview = `linear-gradient(90deg, ${escapeAttr(item.color)}, ${escapeAttr(item.glowColor)})`;
    card.innerHTML = `
      <div class="admin-catalog-head">
        <strong>${escapeAttr(item.name) || 'Untitled slicer'}</strong>
        <span class="admin-slicer-swatch" style="background:${preview}"></span>
        <label class="admin-toggle"><input type="checkbox" class="sl-on" ${item.enabled ? 'checked' : ''}/> In shop</label>
        <button type="button" class="admin-del-btn sl-del">Remove</button>
      </div>
      <div class="admin-reward-inputs">
        <label><span>ID</span><input class="admin-input sl-id" value="${escapeAttr(item.id)}" /></label>
        <label><span>Name</span><input class="admin-input sl-name" value="${escapeAttr(item.name)}" /></label>
        <label class="flex-1"><span>Shop blurb</span><input class="admin-input sl-blurb" value="${escapeAttr(item.blurb)}" /></label>
        <label><span>Rarity</span>
          <select class="admin-input sl-rarity">
            ${(['common', 'rare', 'epic', 'legendary'] as SlicerRarity[])
              .map((r) => `<option value="${r}" ${item.rarity === r ? 'selected' : ''}>${r}</option>`)
              .join('')}
          </select>
        </label>
        <label><span>Cost</span><input type="number" class="admin-input sl-cost" value="${item.cost}" min="0" /></label>
        <label><span>Sell value</span><input type="number" class="admin-input sl-sell" value="${item.sellValue}" min="0" /></label>
        <label><span>Trail color</span><input type="color" class="admin-input admin-color sl-color" value="${escapeAttr(item.color)}" /></label>
        <label><span>Glow color</span><input type="color" class="admin-input admin-color sl-glowc" value="${escapeAttr(item.glowColor)}" /></label>
        <label><span>FX style</span>
          <select class="admin-input sl-fx">
            ${(['solid', 'spark', 'plasma', 'ember', 'frost'] as SlicerFxStyle[])
              .map((f) => `<option value="${f}" ${item.fxStyle === f ? 'selected' : ''}>${f}</option>`)
              .join('')}
          </select>
        </label>
      </div>
      <div class="admin-slicer-sliders">
        ${sliderField('sl-width', 'Trail width', item.trailWidth, 0.5, 3, 0.05, 'How thick the slash line looks')}
        ${sliderField('sl-glow', 'Glow', item.glow, 0, 1, 0.05, 'Soft halo behind the trail')}
        ${sliderField('sl-glint', 'Glint / sparks', item.glint, 0, 1, 0.05, 'Sparkles while swiping mouse or finger')}
        ${sliderField('sl-dmg', 'Damage ×', item.damageMul, 0.5, 2, 0.01, 'Slash damage multiplier vs fruits')}
        ${sliderField('sl-juice', 'Juice ×', item.juiceMul, 0.5, 2, 0.01, 'Juice bank gain on kills')}
        ${sliderField('sl-brittle', 'Brittle bonus (s)', item.brittleBonus, 0, 3, 0.1, 'Extra brittle time applied on hit')}
      </div>
      <p class="admin-slicer-fx-note">Effects on fruit: damage ×${item.damageMul.toFixed(2)}, juice ×${item.juiceMul.toFixed(2)}, brittle +${item.brittleBonus.toFixed(1)}s · look: ${escapeAttr(item.fxStyle)}</p>
    `;

    const bindText = (sel: string, apply: (v: string) => void) => {
      card.querySelector(sel)?.addEventListener('change', (e) => apply((e.target as HTMLInputElement).value));
    };
    const bindNum = (sel: string, apply: (v: number) => void) => {
      card.querySelector(sel)?.addEventListener('change', (e) => apply(Number((e.target as HTMLInputElement).value) || 0));
    };
    const bindRange = (sel: string, apply: (v: number) => void) => {
      const input = card.querySelector(sel) as HTMLInputElement | null;
      const valEl = input?.closest('label')?.querySelector('.s-val');
      const sync = () => {
        if (!input) return;
        const v = Number(input.value);
        if (valEl) valEl.textContent = String(v);
        apply(v);
        const note = card.querySelector('.admin-slicer-fx-note');
        if (note) {
          note.textContent = `Effects on fruit: damage ×${item.damageMul.toFixed(2)}, juice ×${item.juiceMul.toFixed(2)}, brittle +${item.brittleBonus.toFixed(1)}s · look: ${item.fxStyle}`;
        }
        const swatch = card.querySelector('.admin-slicer-swatch') as HTMLElement | null;
        if (swatch) swatch.style.background = `linear-gradient(90deg, ${item.color}, ${item.glowColor})`;
      };
      input?.addEventListener('input', sync);
      input?.addEventListener('change', sync);
    };

    bindText('.sl-id', (v) => {
      item.id = v.trim() || item.id;
    });
    bindText('.sl-name', (v) => {
      item.name = v;
    });
    bindText('.sl-blurb', (v) => {
      item.blurb = v;
    });
    card.querySelector('.sl-rarity')?.addEventListener('change', (e) => {
      item.rarity = (e.target as HTMLSelectElement).value as SlicerRarity;
    });
    bindNum('.sl-cost', (v) => {
      item.cost = Math.max(0, v);
    });
    bindNum('.sl-sell', (v) => {
      item.sellValue = Math.max(0, v);
    });
    bindText('.sl-color', (v) => {
      item.color = v;
      const swatch = card.querySelector('.admin-slicer-swatch') as HTMLElement | null;
      if (swatch) swatch.style.background = `linear-gradient(90deg, ${item.color}, ${item.glowColor})`;
    });
    bindText('.sl-glowc', (v) => {
      item.glowColor = v;
      const swatch = card.querySelector('.admin-slicer-swatch') as HTMLElement | null;
      if (swatch) swatch.style.background = `linear-gradient(90deg, ${item.color}, ${item.glowColor})`;
    });
    card.querySelector('.sl-fx')?.addEventListener('change', (e) => {
      item.fxStyle = (e.target as HTMLSelectElement).value as SlicerFxStyle;
      const note = card.querySelector('.admin-slicer-fx-note');
      if (note) {
        note.textContent = `Effects on fruit: damage ×${item.damageMul.toFixed(2)}, juice ×${item.juiceMul.toFixed(2)}, brittle +${item.brittleBonus.toFixed(1)}s · look: ${item.fxStyle}`;
      }
    });
    bindRange('.sl-width', (v) => {
      item.trailWidth = v;
    });
    bindRange('.sl-glow', (v) => {
      item.glow = v;
    });
    bindRange('.sl-glint', (v) => {
      item.glint = v;
    });
    bindRange('.sl-dmg', (v) => {
      item.damageMul = v;
    });
    bindRange('.sl-juice', (v) => {
      item.juiceMul = v;
    });
    bindRange('.sl-brittle', (v) => {
      item.brittleBonus = v;
    });
    card.querySelector('.sl-on')?.addEventListener('change', (e) => {
      item.enabled = (e.target as HTMLInputElement).checked;
    });
    card.querySelector('.sl-del')?.addEventListener('click', () => {
      items.splice(idx, 1);
      renderSlicerEditor(container, items);
    });
    container.appendChild(card);
  });
}

export function addSlicer(items: CatalogSlicer[]): void {
  items.push(createEmptySlicer());
}
