import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { screenShell } from './shell';
import type { SaveData } from '../../game/save';

export function renderSettings(
  root: HTMLElement,
  save: SaveData,
  actions: { onToggleSound: () => void; onLogout: () => void },
): void {
  const body = screenShell(root, { title: 'Settings', subtitle: 'Tune your command centre.', save });
  body.appendChild(
    el('section', { class: 'ftd-settings-grid' }, [
      el('article', { class: 'ftd-settings-card' }, [
        el('p', { class: 'ftd-settings-card__label', text: 'AUDIO' }),
        el('h2', { class: 'ftd-settings-card__title', text: 'Combat audio' }),
        el('p', { class: 'ftd-settings-card__copy', text: 'Toggle all gameplay and interface sound.' }),
        GameButton({ label: 'Toggle sound', variant: 'outline', onClick: actions.onToggleSound }),
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