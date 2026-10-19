import { getStudioEntityData } from '../game/studioRuntime';
import { studioArtwork } from '../game/entityArtwork';
import { artworkPreview } from './entityArtworkPreview';
import { CHARACTER_ATLAS_URL, PORTRAIT_CELLS } from '../game/characterPortraits';
import { heroDef, type HeroId } from '../game/heroes';
import { getAdminSprite } from './adminSprites';
import { el } from './components/dom';
export function heroArt(id:HeroId):HTMLElement {
  const hero=heroDef(id),art=el('span',{class:'ftd-hero-portrait','data-hero-art':id,'aria-label':`${hero.name} character`});
  art.style.setProperty('--hero-color',`#${hero.color.toString(16).padStart(6,'0')}`);
  let source:string|null=null;try{source=getAdminSprite(`hero-${id}`);}catch{/* Storage is optional for built-in characters. */}
  const creator=studioArtwork(getStudioEntityData(`hero-${id}`),'published');
  if(creator)art.appendChild(artworkPreview(creator,`${hero.name} character art`,'ftd-hero-portrait__published'));
  else if(source)art.appendChild(el('img',{src:source,alt:`${hero.name} character art`,class:'ftd-hero-portrait__image'}));
  else {
    art.classList.add('has-atlas');
    const [column,row]=PORTRAIT_CELLS[id]!,size=.228,centerY=[.12,.355,.588,.834][row]!;
    const sprite=el('span',{class:'ftd-hero-portrait__atlas','aria-hidden':'true'});
    sprite.style.setProperty('background-image',`url(${CHARACTER_ATLAS_URL})`);
    sprite.style.setProperty('background-size',`${100/size}% ${100/size}%`);
    sprite.style.setProperty('background-position',`${((column+.5)/4-size/2)/(1-size)*100}% ${(centerY-size/2)/(1-size)*100}%`);
    art.appendChild(sprite);
  }
  return art;
}

if(typeof window!=='undefined')window.addEventListener('fruit-td-creator-update',()=>{document.querySelectorAll<HTMLElement>('[data-hero-art]').forEach(node=>node.parentElement?.replaceChild(heroArt(node.dataset.heroArt as HeroId),node));});
