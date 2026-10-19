import { installDomStub } from '../domStub.test-helper';
installDomStub();
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderHeroPerkTree } from './heroPerkTree';
import { defaultSave } from '../../game/save';
import { heroXpForLevel } from '../../game/heroes';
import { heroArt } from '../heroArt';

test('active hero mastery tree exposes upgrades, locked levels and point exhaustion',()=>{
 const save=defaultSave();save.xp.jiju=heroXpForLevel(10);
 let selected='';const tree=renderHeroPerkTree(save,'jiju',id=>{selected=id;});
 const buttons=[...tree.querySelectorAll<HTMLButtonElement>('button')];
 assert.equal(buttons.length,5);assert.equal(buttons[0]!.getAttribute('disabled'),null);
 buttons[0]!.click();assert.equal(selected,'jiju:combo');
 assert.equal(buttons[1]!.getAttribute('disabled'),'');
 save.xp.jiju=heroXpForLevel(1);
 const locked=renderHeroPerkTree(save,'jiju',()=>{});
 assert.ok([...locked.querySelectorAll('button')].every(button=>button.hasAttribute('disabled')));
 const art=heroArt('jiju');assert.ok(art.querySelector('.ftd-hero-portrait__atlas'),'menu uses the same character art as combat');
});
