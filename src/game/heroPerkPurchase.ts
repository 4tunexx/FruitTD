import { HEROES, heroXpToLevel } from './heroes';
import { HERO_PERKS } from './heroProgression';
import { perkPointsFromLevel } from './progression';
import type { SaveData } from './save';

/** Pure purchase rule shared by guests and the revision-checked server action. */
export function purchaseHeroPerk(save:SaveData,heroId:string,perkId:string):string|null {
  const hero=HEROES.find(hero=>hero.id===heroId),perk=HERO_PERKS.find(perk=>perk.id===perkId);
  if(!hero||!perk||!save.ownedHeroes.includes(hero.id))return 'Choose an owned hero and valid perk';
  const level=heroXpToLevel(save.xp[hero.id]??0);
  if(level<perk.unlockLevel)return `Requires hero level ${perk.unlockLevel}`;
  const ranks=save.heroPerkRanks?.[hero.id]??{};
  const rank=ranks[perk.id]??0;
  if(rank>=perk.maxRank)return 'Perk is already at maximum rank';
  const spent=HERO_PERKS.reduce((sum,entry)=>sum+Math.max(0,ranks[entry.id]??0),0);
  if(spent>=perkPointsFromLevel(level))return 'Earn more hero mastery points by levelling this hero';
  save.heroPerkRanks??={jiju:{},topfu:{},lagen:{},tripos:{},ki:{}};
  save.heroPerkRanks[hero.id]??={};save.heroPerkRanks[hero.id][perk.id]=rank+1;
  return null;
}
