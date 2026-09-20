import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { screenShell } from './shell';
import { getLiveConfig } from '../../services/liveConfig';
import type { SaveData } from '../../game/save';

export function renderNews(root: HTMLElement, save: SaveData, onDaily: () => void): void {
  const body = screenShell(root, {
    title: 'Field Briefing',
    subtitle: 'Live signals from the Fruit TD command centre.',
    save,
  });
  const config = getLiveConfig();
  body.appendChild(
    el('section', { class: 'ftd-briefing' }, [
      el('p', { class: 'ftd-briefing__eyebrow', text: 'ACTIVE TRANSMISSION' }),
      el('h2', { class: 'ftd-briefing__title', text: config.menuConfig.announcement || 'Wall briefing incoming.' }),
      el('p', { class: 'ftd-briefing__copy', text: 'Daily rewards, season progress, and new loadout opportunities are tracked here.' }),
      GameButton({ label: 'Open daily bonus', tone: 'primary', onClick: onDaily }),
    ]),
  );
}