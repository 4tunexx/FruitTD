import { heroDef, type HeroId } from '../game/heroes';
import { getAdminSprite } from './adminSprites';
import { el } from './components/dom';
export function heroArt(id:HeroId):HTMLElement {
  const hero=heroDef(id),art=el('span',{class:'ftd-hero-portrait','data-hero-art':id,'aria-label':`${hero.name} character`});
  art.style.setProperty('--hero-color',`#${hero.color.toString(16).padStart(6,'0')}`);
  let source:string|null=null;try{source=getAdminSprite(`hero-${id}`);}catch{/* Storage is optional for built-in characters. */}
  if(source)art.appendChild(el('img',{src:source,alt:`${hero.name} character art`,class:'ftd-hero-portrait__image'}));
  else art.appendChild(el('span',{class:'ftd-hero-portrait__figure','aria-hidden':'true'},[el('i',{class:'ftd-hero-portrait__head'}),el('i',{class:'ftd-hero-portrait__body'}),el('i',{class:'ftd-hero-portrait__weapon'})]));
  return art;
}
