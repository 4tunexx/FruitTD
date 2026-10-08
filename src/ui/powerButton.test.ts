import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub } from './domStub.test-helper';
installDomStub();
import { cooldownProgress, powerButton, updatePowerButton } from './powerButton';

test('recharge remains bounded and resumes the correct point after a snapshot',()=>{
 assert.equal(cooldownProgress(10000,9000,1000),0);
 assert.equal(cooldownProgress(10000,9000,5500),.5);
 assert.equal(cooldownProgress(10000,9000,12000),1);
 assert.equal(cooldownProgress(20000,9000,1000),0);
});
test('powers preserve their icon and node as cooldown and affordability change',()=>{
 const button=powerButton('jiju-2',()=>{}),icon=button.querySelector('img');
 updatePowerButton(button,'jiju-2',Date.now()+5000,100);
 assert.equal(button.disabled,true);assert.ok(button.classList.contains('is-recharging'));
 updatePowerButton(button,'jiju-2',0,0);
 assert.equal(button.disabled,true);assert.equal(button.classList.contains('is-recharging'),false);
 updatePowerButton(button,'jiju-2',0,100);
 assert.equal(button.disabled,false);assert.ok(button.classList.contains('is-ready'));assert.equal(button.querySelector('img'),icon);
});
