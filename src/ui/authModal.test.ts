import { installDomStub } from './domStub.test-helper';
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindTitleAuthButtons, showEmailAuthModal, type EmailAuthMode } from './authModal';

function add(id: string, tag = 'div'): HTMLElement {
  const element = document.createElement(tag);
  element.id = id;
  document.body.appendChild(element);
  return element;
}

test('title Create Account opens the registration form', () => {
  const start = add('btn-title-login', 'button');
  start.textContent = 'Start Game';
  const register = add('btn-title-register', 'button');
  register.textContent = 'Create Account';
  const modal = add('modal-auth');
  modal.classList.add('hidden');
  const title = add('auth-modal-title');
  const subtitle = add('auth-modal-sub');
  const submit = add('btn-auth-email-submit', 'button');
  const password = add('auth-password', 'input') as HTMLInputElement;
  const error = add('auth-email-error');
  error.classList.remove('hidden');
  const steam = add('btn-auth-open-steam', 'button');
  const switchButton = add('btn-auth-switch', 'button');
  const opened: EmailAuthMode[] = [];

  bindTitleAuthButtons(document, (mode) => {
    opened.push(mode);
    showEmailAuthModal(document, mode);
  });
  start.click();
  register.click();

  assert.deepEqual(opened, ['login', 'register']);
  assert.equal(modal.classList.contains('hidden'), false);
  assert.equal(title.textContent, 'Register');
  assert.match(subtitle.textContent!, /Create an account/);
  assert.equal(submit.textContent, 'Register with email');
  assert.equal(password.autocomplete, 'new-password');
  assert.equal(steam.textContent, 'Register through Steam');
  assert.equal(switchButton.textContent, 'Already have an account? Sign in');
  assert.equal(error.classList.contains('hidden'), true);
});
