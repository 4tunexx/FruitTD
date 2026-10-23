import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from '../domStub.test-helper';
import { renderConfigForm } from './configForm';
import { el } from '../components/dom';
installDomStub();

test('admin exact values update the draft and slider without publishing invalid input', () => {
  resetDom(); const host=document.createElement('div'); const config={speed:0.65}; let changes=0;
  renderConfigForm(host,config,()=>{changes++;});
  const inputs=[...host.querySelectorAll('input')];
  const slider=inputs.find(input=>input.type==='range')!;
  const exact=inputs.find(input=>input.type==='number')!;
  assert.ok(exact);
  exact.checkValidity=()=>true;
  exact.value='0.75'; exact.dispatchEvent({type:'input'} as Event);
  assert.equal(config.speed,0.75); assert.equal(slider.value,'0.75'); assert.equal(changes,1);
  exact.value=''; exact.dispatchEvent({type:'input'} as Event);
  assert.equal(config.speed,0.75); assert.equal(changes,1);
  exact.value='99'; exact.checkValidity=()=>false; exact.dispatchEvent({type:'input'} as Event);
  assert.equal(config.speed,0.75);
  exact.dispatchEvent({type:'change'} as Event); assert.equal(exact.value,'0.75');
  slider.checkValidity=()=>true; slider.value='0.8'; slider.dispatchEvent({type:'input'} as Event);
  assert.equal(exact.value,'0.8'); assert.equal(config.speed,0.8); assert.equal(changes,2);
});

test('collapsed and unselected controls expose false ARIA states without enabling HTML boolean attributes',()=>{
  const button=el('button',{'aria-expanded':false,'aria-pressed':false,disabled:false});
  assert.equal(button.getAttribute('aria-expanded'),'false');
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(button.hasAttribute('disabled'),false);
});
