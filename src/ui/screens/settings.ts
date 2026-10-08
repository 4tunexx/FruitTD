import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { screenShell } from './shell';
import type { SaveData } from '../../game/save';
import { getHubChromeMode, setHubChromeMode } from './hubChrome';

export function renderSettings(
  root: HTMLElement,
  save: SaveData,
  actions: { onToggleSound: () => void; onLogout: () => void },
): void {
  const body = screenShell(root, { title: 'Settings', subtitle: 'Tune your command centre.', save });
  const muted = () => document.getElementById('btn-mute')?.getAttribute('data-muted') === 'true';
  const soundState = el('p', { class: 'ftd-settings-card__state', role: 'status', text: muted() ? 'Sound off' : 'Sound on' });
  const soundButton = GameButton({ label: muted() ? 'Turn sound on' : 'Turn sound off', variant: 'outline', onClick: () => {
    actions.onToggleSound();
    soundState.textContent = muted() ? 'Sound off' : 'Sound on';
    soundButton.textContent = muted() ? 'Turn sound on' : 'Turn sound off';
  } });
  const chromeToggle = el('button', {
    class: `ftd-hub-chrome-toggle${getHubChromeMode() === 'always' ? ' is-on' : ''}`,
    type: 'button', role: 'switch', 'aria-checked': String(getHubChromeMode() === 'always'),
    'aria-label': 'Keep the top header and bottom navigation visible', 'data-testid': 'hub-chrome-toggle',
  }, [el('span', { class: 'ftd-hub-chrome-toggle__track', 'aria-hidden': 'true' }, [el('i')]), el('span', { class: 'ftd-hub-chrome-toggle__label', text: getHubChromeMode() === 'always' ? 'Always visible' : 'Reveal on edge hover' })]);
  chromeToggle.addEventListener('click', () => {
    const mode = getHubChromeMode() === 'always' ? 'auto' : 'always';
    setHubChromeMode(mode);
    chromeToggle.classList.toggle('is-on', mode === 'always');
    chromeToggle.setAttribute('aria-checked', String(mode === 'always'));
    const label = chromeToggle.querySelector<HTMLElement>('.ftd-hub-chrome-toggle__label');
    if (label) label.textContent = mode === 'always' ? 'Always visible' : 'Reveal on edge hover';
  });
  body.appendChild(
    el('section', { class: 'ftd-settings-grid' }, [
      el('article', { class: 'ftd-settings-card' }, [
        el('p', { class: 'ftd-settings-card__label', text: 'AUDIO' }),
        el('h2', { class: 'ftd-settings-card__title', text: 'Combat audio' }),
        el('p', { class: 'ftd-settings-card__copy', text: 'Toggle all gameplay and interface sound.' }),
        soundState,
        soundButton,
      ]),
      el('article', { class: 'ftd-settings-card ftd-settings-card--chrome' }, [
        el('p', { class: 'ftd-settings-card__label', text: 'GAME MENU' }),
        el('h2', { class: 'ftd-settings-card__title', text: 'Header and navigation' }),
        el('p', { class: 'ftd-settings-card__copy', text: 'Keep the top header and bottom navigation pinned, or let them tuck away until you hover the top or bottom edge.' }),
        chromeToggle,
      ]),
      el('article', { class: 'ftd-settings-card ftd-settings-card--danger' }, [
        el('p', { class: 'ftd-settings-card__label', text: 'SESSION' }),
        el('h2', { class: 'ftd-settings-card__title', text: 'Sign out' }),
        el('p', { class: 'ftd-settings-card__copy', text: 'Return to the title screen without changing saved progression.' }),
        GameButton({ label: 'Log out', tone: 'danger', variant: 'outline', onClick: actions.onLogout }),
      ]),
    ]),
  );
}
