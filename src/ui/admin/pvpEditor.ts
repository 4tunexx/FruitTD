import {HERO_ABILITIES} from '../../game/heroAbilities';
import {powerStats} from '../../game/powerCombat';
import { loadSave } from '../../game/save';
import { PVP_MAX_TOWER_LEVEL, pvpBuildCellAllowed, siegeBuildCells, type PvpConfig } from '../../game/pvp';
import { PvpBattlefield } from '../screens/pvpBattlefield';
import { renderConfigForm } from './configForm';
import { el } from '../components/dom';

const disposers = new WeakMap<HTMLElement, () => void>();
/** Actual game scene plus connected-route painter for the seven veto maps. */
export function renderPvpEditor(host: HTMLElement, config: PvpConfig): void {
  disposers.get(host)?.(); host.replaceChildren();
  const header = el('header', { class: 'admin-preview-heading' }, [el('h3', { text: 'Arena / Ranked workshop' }), el('p', { text: 'Preview both keeps, edit defensive pads and tune the match. Save changes to publish.' })]);
  const layout = el('div', { class: 'admin-pvp-workshop' });
  const controls = el('div'); const preview = el('aside', { class: 'admin-pvp-preview' });
  layout.append(controls, preview); host.append(header, layout);
  let showUnits=true,sharedPreview=false,previewLevel=1;
  let selected = 0; let paintingPads = false;
  const select = el('select', { class: 'admin-input', 'aria-label': 'Preview map' });
  config.maps.forEach((map, index) => select.append(new Option(map.name, String(index))));
  const name = el('input', { class: 'admin-input', 'aria-label': 'Map name' });
  const grid = el('div', { class: 'admin-route-grid', role: 'group', 'aria-label': 'Defensive build pads beside the straight road' });
  const notice = el('p', { role: 'status' });
  const map = () => config.maps[selected]!;
  const snapshot = () => {
    const save=loadSave();
    const previewMap=sharedPreview?{id:'coop-orchard',name:'Shared Orchard',width:10,height:14,pathCells:[] as number[],buildCells:Array.from({length:8},(_,i)=>121+i)}:map();
    return {id:'admin-preview',map:previewMap,yourSide:'blue',shared:sharedPreview,players:(sharedPreview?['blue']:['blue','red']).map((side)=>({
      userId:side,side,name:side==='blue'?save.nickname||'Your defender':'Rival defender',hero:save.hero,wallSkin:save.wallSkin,wallHealth:config.wallHealth*(sharedPreview?1:1+(previewLevel-1)*.25),wallMaxHealth:config.wallHealth*(sharedPreview?1:1+(previewLevel-1)*.25),mainLevel:previewLevel,
      towers:showUnits?previewMap.buildCells.slice(0,6).map((cell,index)=>({id:`${side}-preview-${index}`,cell,type:Object.keys(config.towers).filter(id=>id!=='catcher')[index%6]||'guillotine',level:Math.min(PVP_MAX_TOWER_LEVEL,previewLevel)})):[],
      attackers:showUnits?Object.keys(config.attacks).slice(0,5).map((type,index)=>({id:`${side}-fruit-${index}`,type,progress:Math.floor((index+1)*previewMap.height/6),...(sharedPreview?{x:2+index*1.4,y:2+index*1.8}:{}),hp:config.attacks[type]!.health*(index===0?1:.7),maxHp:config.attacks[type]!.health})):[],
    }))};
  };
  let scene: PvpBattlefield | null = null;
  try { scene = new PvpBattlefield(snapshot(), config, () => {}); preview.append(scene.element); }
  catch { preview.append(el('p', { role: 'alert', text: '3D preview is unavailable on this device. Route editing is still available.' })); }
  const refreshPreview = () => scene?.update(snapshot(), config);
  const previewControls=el('div',{class:'admin-route-actions'});
  const previewMode=el('select',{class:'admin-input','aria-label':'Live preview mode'},[el('option',{value:'pvp',text:'Arena / Ranked · two keeps'}),el('option',{value:'coop',text:'Online Co-op · shared wall'})]);
  const level=el('select',{class:'admin-input','aria-label':'Preview main tower level'},Array.from({length:PVP_MAX_TOWER_LEVEL},(_,i)=>el('option',{value:String(i+1),text:`Level ${i+1}`})));
  const units=el('button',{type:'button',class:'studio-btn',text:'Hide sample units'});
  previewControls.append(previewMode,level,units);preview.prepend(previewControls);
  previewMode.addEventListener('change',()=>{
    sharedPreview=previewMode.value==='coop';
    const maxLevel=sharedPreview?10:PVP_MAX_TOWER_LEVEL;
    previewLevel=Math.min(previewLevel,maxLevel);
    level.replaceChildren(...Array.from({length:maxLevel},(_,i)=>el('option',{value:String(i+1),text:`Level ${i+1}`,selected:i+1===previewLevel})));
    refreshPreview();
  });
  level.addEventListener('change',()=>{previewLevel=Number(level.value)||1;refreshPreview();});
  units.addEventListener('click',()=>{showUnits=!showUnits;units.textContent=showUnits?'Hide sample units':'Show sample units';refreshPreview();});

  const paint = () => {
    const current = map(); name.value = current.name;
    grid.style.gridTemplateColumns = `repeat(${current.width}, 1fr)`; grid.replaceChildren();
    const path = current.pathCells;
    for (let cell = 0; cell < current.width * current.height; cell++) {
      const button = el('button', { type: 'button', class: path.includes(cell) ? 'is-path' : pvpBuildCellAllowed(current,cell) ? 'is-pad' : Math.floor(cell/current.width)<Math.ceil(current.height/2) ? 'is-forbidden' : '', 'aria-label': `Column ${cell % current.width + 1}, row ${Math.floor(cell / current.width) + 1}`, 'aria-pressed': String(current.buildCells.includes(cell)) });
      if (current.buildCells.includes(cell)) button.textContent = '+';
      if (cell === path[0]) button.textContent = 'IN';
      if (cell === path.at(-1)) button.textContent = 'END';
      button.addEventListener('click', () => {
        if (paintingPads) {
          if (Math.floor(cell/current.width)<Math.ceil(current.height/2)) { notice.textContent='Build pads belong in the back half of your lane.'; return; }
          if (path.includes(cell)) { notice.textContent = 'Keep the road clear.'; return; }
          if (current.buildCells.includes(cell)) current.buildCells = current.buildCells.filter(value => value !== cell);
          else if (current.buildCells.length < 10) current.buildCells.push(cell);
          else { notice.textContent = 'Ten pads maximum. Remove a pad before moving it.'; return; }
          if (config.map.id === current.id) config.map = structuredClone(current);
          notice.textContent = `${current.buildCells.length}/10 pads. Choose ten before publishing.`; paint(); refreshPreview(); return;
        }

      });
      grid.append(button);
    }
  };
  const button = (text: string, fn: () => void) => { const node = el('button', { type: 'button', class: 'studio-btn', text }); node.addEventListener('click', fn); return node; };
  controls.append(el('h4', { text: 'Map and paths' }), select, name, el('p', { text: 'Ten pads per player, in the defensive half only. Select Edit build pads to move them.' }), grid,
    el('div', { class: 'admin-route-actions' }, [
      button('Restore defensive pads',()=>{const current=map();current.buildCells=siegeBuildCells(current.width,current.height).filter(cell=>!current.pathCells.includes(cell));if(config.map.id===current.id)config.map=structuredClone(current);paint();refreshPreview();}),
      button('Edit build pads', () => { paintingPads = !paintingPads; notice.textContent = paintingPads ? 'Tap a gold + to remove it; tap landscape to place it. Choose ten pads.' : 'Pad editing finished.'; paint(); }),
      button('Straight road',()=>{const current=map();current.pathCells=Array.from({length:current.height},(_,row)=>row*current.width+Math.max(0,Math.floor(current.width/2)-1));current.buildCells=siegeBuildCells(current.width,current.height).filter(cell=>!current.pathCells.includes(cell));if(config.map.id===current.id)config.map=structuredClone(current);notice.textContent='Straight road and defensive pads applied. Save to publish.';paint();refreshPreview();}),
    ]), notice);
  select.addEventListener('change', () => { selected = Number(select.value); paint(); refreshPreview(); });
  name.addEventListener('input', () => { map().name = name.value; select.options[selected]!.textContent = name.value; if (config.map.id === map().id) config.map.name = name.value; });
  controls.append(el('details',{class:'admin-power-rules'},[
    el('summary',{text:'Hero power balance · live rules'}),
    el('p',{text:'Offensive powers target only inside the main tower’s current radius. Damage falls from full strength near the tower to 35% at the edge. Each rank adds 20% base damage and reduces the base cooldown by 5%; stronger slows and guard healing also scale. Tower upgrades extend range. Slice-only enemies resist all powers.'}),
    ...HERO_ABILITIES.map(ability=>{const base=powerStats(ability,1),max=powerStats(ability,5);return el('p',{text:`${ability.name}: rank 1 ${Math.round(base.damage)} damage / ${base.cooldownMs/1000}s → rank 5 ${Math.round(max.damage)} damage / ${max.cooldownMs/1000}s.`});}),
  ]));
  const fields = el('div'); controls.append(fields);
  const { map: _map, maps: _maps, ...balance } = config;
  // Nested records share draft references; scalar updates are copied back explicitly.
  renderConfigForm(fields, balance, () => { Object.assign(config, balance); refreshPreview(); });
  paint(); disposers.set(host, () => scene?.dispose());
}
export function disposePvpEditor(host: HTMLElement): void { disposers.get(host)?.(); disposers.delete(host); }
