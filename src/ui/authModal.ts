export type EmailAuthMode = 'login' | 'register';

/** Keep title actions and account copy aligned with the current session. */
export function syncTitleAuthState(root: Document, ready: boolean, identity?: string): void {
  root.getElementById('btn-title-continue')?.classList.toggle('hidden', !ready);
  root.getElementById('btn-title-login')?.classList.toggle('hidden', ready);
  root.getElementById('btn-title-register')?.classList.toggle('hidden', ready);
  root.getElementById('btn-settings-logout')?.classList.toggle('hidden', !ready);
  const account = root.getElementById('title-account-line');
  if (account) account.textContent = ready
    ? `Signed in as @${identity || 'Player'}`
    : 'Not signed in — choose Start Game or Create Account';
}

/** Keep auth copy and form state in sync whenever the modal is opened/switched. */
export function showEmailAuthModal(root: Document, mode: EmailAuthMode): void {
  const get = (id: string) => root.getElementById(id);
  const title = get('auth-modal-title');
  const sub = get('auth-modal-sub');
  const submit = get('btn-auth-email-submit');
  const error = get('auth-email-error');
  const steam = get('btn-auth-open-steam');
  const switchButton = get('btn-auth-switch');
  const password = get('auth-password') as HTMLInputElement | null;

  if (switchButton) {
    switchButton.textContent = mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in';
  }
  if (password) password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  if (title) title.textContent = mode === 'login' ? 'Login' : 'Register';
  if (sub) {
    sub.textContent = mode === 'login'
      ? 'Sign in with Steam or your email.'
      : 'Create an account with Steam or email.';
  }
  if (submit) submit.textContent = mode === 'login' ? 'Login with email' : 'Register with email';
  if (steam) steam.textContent = mode === 'login' ? 'Sign in through Steam' : 'Register through Steam';
  if (error) {
    error.textContent = '';
    error.classList.add('hidden');
  }

  const modal = get('modal-auth');
  modal?.classList.remove('is-dismissing', 'hidden');
}

/** Bind the title screen's primary auth choices to the matching modal mode. */
export function bindTitleAuthButtons(root: Document, open: (mode: EmailAuthMode) => void): void {
  root.getElementById('btn-title-login')?.addEventListener('click', () => open('login'));
  root.getElementById('btn-title-register')?.addEventListener('click', () => open('register'));
}
