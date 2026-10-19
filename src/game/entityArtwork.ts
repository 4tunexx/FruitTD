import { CHARACTER_ATLAS_URL, PORTRAIT_CELLS } from './characterPortraits';
import { HERO_ABILITIES } from './heroAbilities';
import type { EntityStudioData, MediaStudioStore } from '../ui/adminMediaStudio';
export interface Artwork {source:string;crop?:{x:number;y:number;width:number;height:number};origin:'published'|'draft'|'legacy'|'built-in';}

export function portraitArtwork(id:string):Artwork|null {
  if(id==='pineapple')return {source:'/assets/battle/pineapple-v1.webp',origin:'built-in'};
  const cell=PORTRAIT_CELLS[id];if(!cell)return null;
  const size=.228,rows=[.12,.355,.588,.834];
  return {source:CHARACTER_ATLAS_URL,crop:{x:(cell[0]+.5)/4-size/2,y:rows[cell[1]]!-size/2,width:size,height:size},origin:'built-in'};
}
export function builtinEntityArtwork(key:string):Artwork|null {
  if(key.startsWith('hero-'))return portraitArtwork(key.slice(5));
  if(key.startsWith('power-')){const ability=HERO_ABILITIES.find(a=>`power-${a.id}`===key);return ability?{source:ability.iconUrl,origin:'built-in'}:null;}
  if(key.startsWith('tower-main'))return portraitArtwork('tower');
  const turret=key.match(/^tower-(guillotine|vortex|laser|railgun|sprinkler|blender)(?:-level-\d+)?$/);if(turret)return {source:`/assets/towers/${turret[1]}.svg`,origin:'built-in'};
  if(key==='tower-wall')return {source:'/assets/maps/samples/tower-keep.webp',origin:'built-in'};
  const enemies:Record<string,string>={'enemy-normal':'orange','enemy-explosive':'bomb','enemy-armored':'watermelon','enemy-splitter':'kiwi','enemy-swift':'strawberry','enemy-chainburst':'apple'};
  if(enemies[key])return portraitArtwork(enemies[key]!);
  if(key.startsWith('boss-'))return portraitArtwork(key==='boss-watermelon'?'boss-melon':'boss-orange');
  return null;
}
export function studioArtwork(entity:EntityStudioData|undefined|null,origin:Artwork['origin']):Artwork|null {
  if(!entity?.sheetDataUrl)return null;
  const cols=Math.max(1,entity.cols||1),rows=Math.max(1,entity.rows||1),frame=entity.clips.idle?.startFrame??entity.clips.walk_down?.startFrame??0;
  return {source:entity.sheetDataUrl,origin,...(cols*rows>1?{crop:{x:(frame%cols)/cols,y:Math.floor(frame/cols)/rows,width:1/cols,height:1/rows}}:{})};
}
/** Same precedence as combat: published Creator entity, inherited level, legacy upload, built-in. */
export function resolveEntityArtwork(key:string,entities:Record<string,EntityStudioData>,legacy?:string|null,origin:Artwork['origin']='published'):Artwork|null {
  const own=studioArtwork(entities[key],origin);if(own)return own;
  if(/-level-\d+$/.test(key)){const base=studioArtwork(entities[key.replace(/-level-\d+$/,'')],origin);if(base)return base;}
  return legacy&&!entities[key]?.ignoreLegacy?{source:legacy,origin:'legacy'}:builtinEntityArtwork(key);
}
/** Preserve drafts while bringing previously missing published assets into the editor. */
export function mergeStudioDraft(published:MediaStudioStore|null|undefined,draft:MediaStudioStore):MediaStudioStore {
  const sounds={...published?.sounds,...draft.sounds};for(const id of draft.removedSounds||[])delete sounds[id];
  return {...draft,entities:{...published?.entities,...draft.entities},sounds};
}
