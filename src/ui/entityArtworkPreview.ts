import type { Artwork } from '../game/entityArtwork';
export function artworkPreview(art:Artwork|null,label:string,className=''):HTMLElement {
  const host=document.createElement('span');host.className=`ftd-entity-art ${className}`.trim();host.setAttribute('role','img');host.setAttribute('aria-label',label);
  if(!art){host.textContent='No artwork';host.classList.add('is-empty');return host;}
  host.dataset.artSource=art.origin;
  const image=document.createElement('span');image.className='ftd-entity-art__image';
  image.style.backgroundImage=`url("${art.source.replace(/"/g,'\\"')}")`;
  if(art.crop){const c=art.crop;image.style.backgroundSize=`${100/c.width}% ${100/c.height}%`;image.style.backgroundPosition=`${c.width===1?50:c.x/(1-c.width)*100}% ${c.height===1?50:c.y/(1-c.height)*100}%`;}
  host.appendChild(image);return host;
}
