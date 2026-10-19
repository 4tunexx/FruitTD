import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { installDomStub, resetDom } from './domStub.test-helper';
import { normalizeCreatorMedia, setPublishedCreatorMedia } from '../game/creatorMedia';
import { builtinEntityArtwork, mergeStudioDraft, resolveEntityArtwork } from '../game/entityArtwork';
import { resolveIconAsset, ICON_ASSETS } from './extractedIcons';
import { mergeAdminConfig } from '../services/admin';
import { HERO_ABILITIES } from '../game/heroAbilities';
installDomStub();
const {withSpriteImage,getAdminSprite,installSpriteUploads}=await import('./adminSprites');
const {heroArt}=await import('./heroArt');
const {powerIconSource}=await import('./powerIcons');
const {renderIconLibrary}=await import('./admin/iconLibrary');
const {getLiveConfig,setLiveConfig}=await import('../services/liveConfig');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const url='/api/media/0123456789abcdef01234567';

test('Casual live preview resolves its saved shared Shield icon and explicit override identically',()=>{
 resetDom();const host=document.createElement('div');document.body.appendChild(host);
 const overrides={Shield:'rune-01-03'};
 assert.equal(resolveIconAsset('ModeCasual',overrides),'rune-01-03');
 renderIconLibrary(host,overrides,async()=>({ok:true,message:'Saved'}));
 assert.match(host.querySelector('[data-testid="admin-icon-live"]')!.textContent||'',/rune-01-03.*inherited from Shield/);
 assert.equal(resolveIconAsset('ModeCasual',{...overrides,ModeCasual:'hero-01-02'}),'hero-01-02');
 assert.equal(resolveIconAsset('ModeCasual',{}),ICON_ASSETS.Shield);
});

test('changing icon roles clears a pending choice instead of applying it to the wrong mode',()=>{
 resetDom();const host=document.createElement('div');let saves=0;
 renderIconLibrary(host,{},async()=>{saves++;return {ok:true,message:'Saved'};});
 (host.querySelector('.admin-icon-library__item') as HTMLButtonElement).click();
 const assign=[...host.querySelectorAll('button')].find(b=>b.textContent==='Apply selected icon') as HTMLButtonElement;assert.equal(assign.disabled,false);
 const role=host.querySelector('[data-testid="admin-icon-role"]') as HTMLSelectElement;role.value='ModeHorde';role.dispatchEvent({type:'change'} as Event);
 assert.equal(assign.disabled,true);assign.click();assert.equal(saves,0);
});

test('all built-in heroes, ability icons and turret levels have inspectable game artwork',()=>{
 for(const hero of ['jiju','topfu','lagen','tripos','ki']){const art=builtinEntityArtwork(`hero-${hero}`)!;assert.ok(art.crop);assert.ok(existsSync(`public${art.source}`));assert.ok(art.crop!.x>=0&&art.crop!.x+art.crop!.width<=1);}
 for(const ability of HERO_ABILITIES)assert.equal(builtinEntityArtwork(`power-${ability.id}`)!.source,ability.iconUrl);
 for(const kind of ['main','guillotine','vortex','laser','railgun','sprinkler','blender'])for(let level=1;level<=10;level++)assert.ok(existsSync(`public${builtinEntityArtwork(`tower-${kind}-level-${level}`)!.source}`));
});

test('shared hero artwork and power icons win over old browser uploads; reset markers survive reload',()=>{
 resetDom();localStorage.setItem('admin-sprite-hero-jiju','old-hero');localStorage.setItem('admin-sprite-power-jiju-1','old-power');
 let media=withSpriteImage(null,'hero-jiju',url);media=withSpriteImage(media,'power-jiju-1',url);setPublishedCreatorMedia(normalizeCreatorMedia(media));
 const hero=heroArt('jiju');assert.ok(hero.querySelector('.ftd-hero-portrait__published'));assert.equal(getAdminSprite('hero-jiju'),url);assert.equal(powerIconSource('jiju-1','default'),url);
 media=withSpriteImage(media,'hero-jiju',null);media=withSpriteImage(media,'power-jiju-1',null);setPublishedCreatorMedia(normalizeCreatorMedia(JSON.parse(JSON.stringify(media))));
 assert.equal(getAdminSprite('hero-jiju'),null);assert.equal(powerIconSource('jiju-1','default'),'default');assert.equal(resolveEntityArtwork('hero-jiju',media.entities,'old-hero')!.origin,'built-in');
 setPublishedCreatorMedia(null);localStorage.removeItem('admin-sprite-hero-jiju');localStorage.removeItem('admin-sprite-power-jiju-1');
});

test('opening Creator preserves its draft while including missing published assets and sounds',()=>{
 const published=withSpriteImage(null,'hero-ki',url);published.sounds={'turret-laser':url};
 const draft=withSpriteImage(null,'hero-jiju',url);draft.entities['hero-jiju']!.label='My draft';
 const merged=mergeStudioDraft(published,draft);assert.ok(merged.entities['hero-ki']);assert.equal(merged.entities['hero-jiju']!.label,'My draft');assert.equal(merged.sounds!['turret-laser'],url);
 const edited=withSpriteImage(merged,'hero-ki',null);assert.ok(edited.entities['hero-jiju']);assert.equal(edited.sounds!['turret-laser'],url);
});

test('quick hero upload sends media, publishes shared config, and reloads the same preview',async(t)=>{
 resetDom();setLiveConfig(mergeAdminConfig({}));
 const card=document.createElement('div'),input=document.createElement('input'),preview=document.createElement('div'),clear=document.createElement('button');input.id='sprite-hero-jiju';preview.id='preview-hero-jiju';clear.id='clear-hero-jiju';card.append(input,preview,clear);document.body.appendChild(card);
 const oldFetch=globalThis.fetch,oldReader=globalThis.FileReader;const requests:string[]=[];let saved:any;
 t.after(()=>{globalThis.fetch=oldFetch;globalThis.FileReader=oldReader;setPublishedCreatorMedia(null);});
 (globalThis as any).FileReader=class {result='data:image/png;base64,YQ==';onload?:()=>void;readAsDataURL(){queueMicrotask(()=>this.onload?.());}};
 globalThis.fetch=async(path,init)=>{requests.push(`${init?.method||'GET'} ${path}`);if(path==='/api/admin/media')return new Response(JSON.stringify({success:true,url}));if(init?.method==='POST'){saved=JSON.parse(String(init.body));return new Response(JSON.stringify({success:true}));}return new Response(JSON.stringify({config:mergeAdminConfig({})}));};
 installSpriteUploads();assert.match(preview.textContent||'',/Built-in game artwork/);
 (input as any).files=[{type:'image/png',size:100}];input.dispatchEvent({type:'change'} as Event);for(let i=0;i<6;i++)await tick();
 assert.deepEqual(requests,['POST /api/admin/media','GET /api/admin/config','POST /api/admin/config']);assert.equal(saved.creatorMedia.entities['hero-jiju'].sheetDataUrl,url);assert.equal(getLiveConfig().creatorMedia!.entities['hero-jiju']!.sheetDataUrl,url);assert.match(preview.textContent||'',/Published/);
 installSpriteUploads();assert.equal(getAdminSprite('hero-jiju'),url);assert.equal((input as HTMLInputElement).disabled,false);
});

test('cleared sounds stay cleared when reopening a draft against the published pack',()=>{
 const published=withSpriteImage(null,'hero-jiju',url);published.sounds={'turret-laser':url};
 const draft={...withSpriteImage(null,'hero-ki',url),removedSounds:['turret-laser']};
 const reopened=mergeStudioDraft(published,JSON.parse(JSON.stringify(draft)));
 assert.equal(reopened.sounds!['turret-laser'],undefined);assert.equal(normalizeCreatorMedia(reopened)!.sounds!['turret-laser'],undefined);
});
