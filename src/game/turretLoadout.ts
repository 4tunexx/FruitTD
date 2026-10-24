import { TURRET_WEAPONS, type BuiltinWeaponId } from './turretWeapons';
import { normalizeTurretTuning } from './turretTuning';
import type { MediaStudioStore } from '../ui/adminMediaStudio';
import type { PvpConfig } from './pvp';
export const STARTER_TURRETS = ['guillotine','vortex','laser','railgun','sprinkler','blender'];
export const TURRET_SLOTS=6;
export interface TurretOffer {kind:string;name:string;price:number;chassis:BuiltinWeaponId;image?:string}
export function turretOffers(media:MediaStudioStore|null|undefined):TurretOffer[] {
  const offers:TurretOffer[]=STARTER_TURRETS.map(kind=>({kind,name:TURRET_WEAPONS[kind as BuiltinWeaponId].name,price:0,chassis:kind as BuiltinWeaponId}));
  for(const [key,entity] of Object.entries(media?.entities??{})){
    if(!/^tower-custom-[a-z0-9_-]{1,48}$/.test(key)||/-level-|-(base|top)$/.test(key))continue;
    const tuning=normalizeTurretTuning(entity.turret);if(!tuning?.chassis)continue;
    offers.push({kind:key.slice(6),name:entity.label||key.slice(6),price:tuning.shopPrice??0,chassis:tuning.chassis,image:media?.entities[`${key}-top`]?.sheetDataUrl||entity.sheetDataUrl||undefined});
  }
  return offers;
}
export function ownsTurret(save:{ownedTurrets?:string[]},offer:TurretOffer):boolean{return offer.price===0||Boolean(save.ownedTurrets?.includes(offer.kind));}
export function equippedTurrets(save:{ownedTurrets?:string[];turretLoadout?:string[]},offers:TurretOffer[]):string[]{
  return [...new Set(save.turretLoadout??STARTER_TURRETS)].filter(kind=>offers.some(offer=>offer.kind===kind&&ownsTurret(save,offer))).slice(0,TURRET_SLOTS);
}
export function turretAllowed(kind:string,loadout?:string[]):boolean{return kind==='catcher'||(loadout??STARTER_TURRETS).includes(kind);}
/** Publish custom firing chassis to online authority using a frozen match config. */
export function withCreatorTurrets(balance:PvpConfig,media:MediaStudioStore|null|undefined):PvpConfig {
  const towers={...balance.towers};
  for(const offer of turretOffers(media).filter(offer=>offer.kind.startsWith('custom-'))){
    const t=normalizeTurretTuning(media!.entities[`tower-${offer.kind}`]!.turret)!;
    const base=balance.towers[offer.chassis];if(!base)continue;
    towers[offer.kind]={cost:t.cost??base.cost,damage:(t.baseDamage??base.damage)*t.damageMultiplier,range:(t.baseRange??base.range)*t.rangeMultiplier,cooldownMs:(t.baseCooldown===undefined?base.cooldownMs:t.baseCooldown*1000)*t.cooldownMultiplier,chassis:offer.chassis};
  }
  return {...balance,towers};
}
