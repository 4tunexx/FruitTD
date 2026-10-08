import { HERO_ABILITIES, MAX_HERO_ABILITY_RANK } from '../../game/heroAbilities';
import type { HeroId } from '../../game/heroes';
import type { SaveData } from '../../game/save';
import { el } from '../components/dom';
import { powerIconSource } from '../powerIcons';
export interface HeroPowerTreeCallbacks { onToggleAbility?: (id:string)=>void; onUpgradeAbility?: (id:string)=>void; }
/** Shared power progression and equipment UI for the hub and hero screen. */
export function renderHeroPowerTree(save:SaveData,heroId:HeroId,heroLevel:number,heroOwned:boolean,callbacks:HeroPowerTreeCallbacks):HTMLElement {
 const abilities=HERO_ABILITIES.filter(a=>a.hero===heroId);
 const tree=el('section',{class:'ftd-hero-power-tree','aria-label':'Hero power skill tree'},[
  el('div',{class:'ftd-hero-power-tree__head'},[
   el('div',{},[el('span',{class:'ftd-hero-power-tree__eyebrow',text:'POWER SKILL TREE'}),el('p',{class:'ftd-hero-power-tree__hint',text:'Six powers · 1 SP per rank · equip three · solo uses juice, online uses Fruts'})]),
   el('span',{class:'ftd-hero-power-tree__points',text:`${save.skillPoints} SP`}),
  ]),
 ]);
 const rows=el('div',{class:'ftd-hero-power-tree__rows'});
 for(const ability of abilities){
  const rank=Math.max(0,Math.min(MAX_HERO_ABILITY_RANK,save.heroAbilityRanks?.[ability.id]??0));
  const unlocked=heroOwned&&heroLevel>=ability.unlockLevel,loadout=save.heroAbilityLoadouts?.[heroId]??[],equipped=loadout.includes(ability.id);
  const canEquip=rank>0||ability.id==='jiju-1',atLimit=!equipped&&loadout.length>=3;
  const icon=el('img',{class:'ftd-power-row__icon',src:powerIconSource(ability.id,ability.iconUrl),alt:`${ability.name} power icon`,loading:'lazy','data-power-icon':ability.id,'data-power-default':ability.iconUrl});
  const copy=el('div',{class:'ftd-power-row__copy'},[
   el('div',{class:'ftd-power-row__title-line'},[el('h3',{class:'ftd-power-row__title',text:ability.name}),el('span',{class:'ftd-power-row__cooldown',text:`${Math.round(ability.cooldownMs/1000)}s · ${ability.juiceCost} JUICE`})]),
   el('p',{class:'ftd-power-row__description',text:ability.description}),
   el('div',{class:'ftd-power-row__footer'},[
    el('span',{class:'ftd-power-row__state',text:!unlocked?`LOCKED · LV ${ability.unlockLevel}`:equipped?'EQUIPPED':rank?'POWER READY':'UNLOCKED'}),
    el('button',{type:'button',class:`ftd-power-row__equip${equipped?' is-equipped':''}`,text:equipped?'EQUIPPED':canEquip?'EQUIP':'UNLOCK POWER',disabled:!unlocked||!canEquip||atLimit,'aria-label':equipped?`Unequip ${ability.name}`:`Equip ${ability.name}`}),
   ]),
  ]);
  copy.querySelector<HTMLButtonElement>('.ftd-power-row__equip')?.addEventListener('click',()=>callbacks.onToggleAbility?.(ability.id));
  const track=el('div',{class:'ftd-power-row__track',role:'group','aria-label':`${ability.name} upgrade ranks, rank ${rank} of ${MAX_HERO_ABILITY_RANK}`},[el('span',{class:'ftd-power-row__rank-label',text:`RANK ${rank}/${MAX_HERO_ABILITY_RANK}`})]);
  for(let node=1;node<=MAX_HERO_ABILITY_RANK;node++){
   const earned=node<=rank,clickable=node===rank+1&&unlocked&&save.skillPoints>0;
   const slot=el('button',{type:'button',class:`ftd-power-row__hex${earned?' is-earned':''}${clickable?' is-next':''}${!unlocked&&!earned?' is-locked':''}`,text:String(node),disabled:!clickable,'aria-label':earned?`Rank ${node} earned`:node===rank+1&&unlocked?`Upgrade ${ability.name} to rank ${node} for 1 skill point`:`Rank ${node} locked`,'aria-pressed':earned});
   if(clickable)slot.addEventListener('click',()=>callbacks.onUpgradeAbility?.(ability.id));
   track.appendChild(slot);
  }
  rows.appendChild(el('article',{class:`ftd-power-row${equipped?' is-equipped':''}${!unlocked?' is-locked':''}`},[icon,copy,track]));
 }
 tree.appendChild(rows);return tree;
}