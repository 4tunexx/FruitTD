import {HERO_ABILITIES} from '../../game/heroAbilities';
import {powerStats} from '../../game/powerCombat';
import { loadSave } from '../../game/save';
import { PVP_MAX_TOWER_LEVEL, type PvpConfig } from '../../game/pvp';
import { arenaMap, arenaLayoutValid } from '../../game/pvpRebuild';
import { PvpBattlefield } from '../screens/pvpBattlefield';
import { renderConfigForm } from './configForm';
import { el } from '../components/dom';

const disposers = new WeakMap<HTMLElement, () => void>();
/** Actual game scene plus connected-route painter for the seven veto maps. */
export function renderPvpEditor(host: HTMLElement, config: PvpConfig): void {
  disposers.get(host)?.(); host.replaceChildren();
  const header = el('header', { class: 'admin-preview-heading' }, [el('h3', { text: 'Arena / Ranked workshop' }), el('p', { text: 'Paint mirrored scenery and hazards, choose legal build hexes, then tune the siege economy. Save changes to publish.' })]);
  const layout = el('div', { class: 'admin-pvp-workshop' });
  const controls = el('div'); const preview = el('aside', { class: 'admin-pvp-preview' });
  layout.append(controls, preview); host.append(header, layout);
  let showUnits=true,sharedPreview=false,previewLevel=1;
  let selected = 0; let brush: 'build'|'solid'|'slow'|'damage'|'erase' = 'build';
  const select = el('select', { class: 'admin-input', 'aria-label': 'Preview map' });
  config.maps.forEach((map, index) => select.append(new Option(map.name, String(index))));
  const name = el('input', { class: 'admin-input', 'aria-label': 'Map name' });
  const grid = el('div', { class: 'admin-route-grid', role: 'group', 'aria-label': 'Mirrored battlefield terrain and legal build hexes' });
  const notice = el('p', { role: 'status' });
  const map = () => config.maps[selected]!;
  const snapshot = () => {
    const save=loadSave();
    const previewMap=sharedPreview?{id:'coop-orchard',name:'Shared Orchard',width:10,height:14,pathCells:[] as number[],buildCells:Array.from({length:8},(_,i)=>121+i)}:map();
    return {id:'admin-preview',rulesVersion:sharedPreview?undefined:2,phase:'siege',map:previewMap,yourSide:'blue',shared:sharedPreview,players:(sharedPreview?['blue']:['blue','red']).map((side)=>({
      userId:side,side,name:side==='blue'?save.nickname||'Your defender':'Rival defender',hero:save.hero,wallSkin:save.wallSkin,wallHealth:config.wallHealth*(sharedPreview?1:1+(previewLevel-1)*.25),wallMaxHealth:config.wallHealth*(sharedPreview?1:1+(previewLevel-1)*.25),mainLevel:previewLevel,
      towers:showUnits?previewMap.buildCells.slice(0,6).map((cell,index)=>({id:`${side}-preview-${index}`,cell,type:Object.keys(config.towers).filter(id=>id!=='catcher')[index%6]||'guillotine',level:Math.min(PVP_MAX_TOWER_LEVEL,previewLevel)})):[],
      attackers:showUnits?Object.keys(config.attacks).slice(0,5).map((type,index)=>({id:`${side}-fruit-${index}`,type,progress:Math.floor((index+1)*previewMap.height/6),x:2+index*1.4,y:sharedPreview?2+index*1.8:side==='blue'?12+index*1.8:-12-index*1.8,hp:config.attacks[type]!.health*(index===0?1:.7),maxHp:config.attacks[type]!.health})):[],
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
    for (let cell = 0; cell < current.width * current.height; cell++) {
      const hazard=current.hazards?.find(item=>item.cell===cell);
      const solid=current.solidCells?.includes(cell);
      const build=current.buildCells.includes(cell);
      const button = el('button', { type: 'button', class: solid ? 'is-solid' : hazard ? `is-${hazard.kind}` : build ? 'is-pad' : Math.floor(cell/current.width)<Math.ceil(current.height/2) ? 'is-forbidden' : '', 'aria-label': `Column ${cell % current.width + 1}, row ${Math.floor(cell / current.width) + 1}: ${solid?'solid':hazard?.kind??(build?'build hex':'open')}`, 'aria-pressed': String(build || solid || Boolean(hazard)) });
      button.textContent=solid?'■':hazard?.kind==='slow'?'≈':hazard?.kind==='damage'?'◆':build?'+':'';
      button.addEventListener('click', () => {
        const previous=structuredClone(current);
        current.buildCells=current.buildCells.filter(value=>value!==cell);
        current.solidCells=(current.solidCells??[]).filter(value=>value!==cell);
        current.hazards=(current.hazards??[]).filter(value=>value.cell!==cell);
        const row=Math.floor(cell/current.width);
        if(brush==='build'){
          if(row<Math.ceil(current.height/2)||row>=current.height-2){Object.assign(current,previous);notice.textContent='Build hexes belong in the back half, clear of the wall.';return;}
          if(!build)current.buildCells.push(cell);
        }else if(brush==='solid'&&!solid)current.solidCells.push(cell);
        else if((brush==='slow'||brush==='damage')&&hazard?.kind!==brush)current.hazards.push({cell,kind:brush});
        if(!arenaLayoutValid(current)){Object.assign(current,previous);notice.textContent='That obstacle would seal a route to a wall.';return;}
        if(config.map.id===current.id)config.map=structuredClone(current);
        notice.textContent=`${current.buildCells.length} build hexes · ${current.solidCells.length} solids · ${current.hazards.length} hazards. Both halves mirror this layout.`;
        paint();refreshPreview();
      });
      grid.append(button);
    }
  };
  const button = (text: string, fn: () => void) => { const node = el('button', { type: 'button', class: 'studio-btn', text }); node.addEventListener('click', fn); return node; };
  const brushSelect=el('select',{class:'admin-input','aria-label':'Map paint tool'},[
    el('option',{value:'build',text:'Build hex'}),el('option',{value:'solid',text:'Solid obstacle'}),el('option',{value:'slow',text:'Slow hazard'}),el('option',{value:'damage',text:'Damage hazard'}),el('option',{value:'erase',text:'Erase'}),
  ]) as HTMLSelectElement;
  brushSelect.addEventListener('change',()=>{brush=brushSelect.value as typeof brush;});
  controls.append(el('h4', { text: 'Seven mirrored maps' }), select, name, el('p', { text: 'Paint one half; the opponent sees a mirrored copy. Gold + marks legal hexes in the back half. Route checks prevent blocked walls.' }), brushSelect, grid,
    el('div', { class: 'admin-route-actions' }, [
      button('Restore this map',()=>{config.maps[selected]=arenaMap({...config.maps[selected]!,version:undefined});if(config.map.id===config.maps[selected]!.id)config.map=structuredClone(config.maps[selected]!);notice.textContent='Original layout restored. Save to publish.';paint();refreshPreview();}),
    ]), notice);
  select.addEventListener('change', () => { selected = Number(select.value); paint(); refreshPreview(); });
  name.addEventListener('input', () => { map().name = name.value; select.options[selected]!.textContent = name.value; if (config.map.id === map().id) config.map.name = name.value; });
  controls.append(el('details',{class:'admin-power-rules'},[
    el('summary',{text:'Hero power balance · live rules'}),
    el('p',{text:'Offensive powers target only inside the main tower’s current radius. Damage falls from full strength near the tower to 35% at the edge. Each rank adds 20% base damage and reduces the base cooldown by 5%; stronger slows and guard healing also scale. Tower upgrades extend range. Slice-only enemies resist all powers.'}),
    ...HERO_ABILITIES.map(ability=>{const base=powerStats(ability,1),max=powerStats(ability,5);return el('p',{text:`${ability.name}: rank 1 ${Math.round(base.damage)} damage / ${base.cooldownMs/1000}s → rank 5 ${Math.round(max.damage)} damage / ${max.cooldownMs/1000}s.`});}),
  ]));
  const fields = el('div'); controls.append(fields);
  const { map: _map, maps: _maps, version: _version, ...balance } = config;
  // Nested records share draft references; scalar updates are copied back explicitly.
  renderConfigForm(fields, balance, () => { Object.assign(config, balance); refreshPreview(); });
  paint(); disposers.set(host, () => scene?.dispose());
}
export function disposePvpEditor(host: HTMLElement): void { disposers.get(host)?.(); disposers.delete(host); }
