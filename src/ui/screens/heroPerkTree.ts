import { HERO_PERKS, HERO_PERK_VALUES } from '../../game/heroProgression';
import { perkPointsFromLevel } from '../../game/progression';
import { heroXpToLevel, type HeroId } from '../../game/heroes';
import type { SaveData } from '../../game/save';
import { el } from '../components/dom';

export function renderHeroPerkTree(save:SaveData,hero:HeroId,onUpgrade?:(id:string)=>void):HTMLElement {
  const level=heroXpToLevel(save.xp[hero]??0),ranks=save.heroPerkRanks?.[hero]??{};
  const spent=HERO_PERKS.reduce((sum,perk)=>sum+(ranks[perk.id]??0),0);
  const points=Math.max(0,perkPointsFromLevel(level)-spent),owned=save.ownedHeroes.includes(hero);
  const tree=el('section',{class:'ftd-hero-perks','aria-label':'Passive mastery skill tree'},[
    el('p',{class:'ftd-hero-perks__label',text:`PASSIVE MASTERY · ${points} POINTS`}),
    el('p',{class:'ftd-hero-perks__hint',text:'Earned by levelling this hero. Separate from power skill points.'}),
  ]);
  for(const perk of HERO_PERKS){
    const rank=ranks[perk.id]??0,locked=!owned||level<perk.unlockLevel,maxed=rank>=perk.maxRank;
    const value=Math.round(HERO_PERK_VALUES[perk.id].perRank*100);
    const button=el('button',{type:'button',class:'ftd-perk-upgrade',text:locked?`Lv ${perk.unlockLevel}`:maxed?'MAX':'UPGRADE · 1 PT',
      disabled:locked||maxed||points<1||!onUpgrade,'aria-label':`Upgrade ${perk.name} to rank ${rank+1}`});
    button.addEventListener('click',()=>onUpgrade?.(`${hero}:${perk.id}`));
    tree.appendChild(el('div',{class:`ftd-hero-perk${locked?' is-locked':''}`},[
      el('div',{},[el('strong',{text:`${perk.name} · ${rank}/${perk.maxRank}`}),el('p',{text:perk.description}),
        el('small',{text:`${value}% per rank · ${maxed?'MAX':`Next rank ${value*(rank+1)}%`}`})]),
      button,
    ]));
  }
  return tree;
}
