import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { screenShell } from './shell';
import { getLiveConfig } from '../../services/liveConfig';
import { openScreen } from './registry';
import type { SaveData } from '../../game/save';

export function renderNews(root: HTMLElement, save: SaveData, onDaily: () => void): void {
  const body = screenShell(root, {
    title: 'Field Briefing',
    subtitle: 'Live signals from the Fruit TD command centre.',
    save,
  });
  const config = getLiveConfig();
  body.appendChild(
    el('div', { class: 'ftd-briefing-grid' }, [
      el('section', { class: 'ftd-briefing ftd-briefing--lead' }, [
        el('p', { class: 'ftd-briefing__eyebrow', text: 'ACTIVE TRANSMISSION' }),
        el('h2', { class: 'ftd-briefing__title', text: config.menuConfig.announcement || 'Wall briefing incoming.' }),
        el('p', { class: 'ftd-briefing__copy', text: 'The latest orchard briefing. Check your rewards, next stage, and fellow defenders below.' }),
      ]),
      el('section', { class: 'ftd-briefing' }, [
        el('p', { class: 'ftd-briefing__eyebrow', text: 'TODAY' }),
        el('h2', { class: 'ftd-briefing__title', text: 'Claim your daily supply' }),
        el('p', { class: 'ftd-briefing__copy', text: 'Collect your bonus and follow today’s missions.' }),
        GameButton({ label: 'Open daily bonus', tone: 'primary', onClick: onDaily }),
      ]),
      el('section', { class: 'ftd-briefing' }, [
        el('p', { class: 'ftd-briefing__eyebrow', text: 'CAMPAIGN' }),
        el('h2', { class: 'ftd-briefing__title', text: 'Take the next stage' }),
        el('p', { class: 'ftd-briefing__copy', text: 'Browse bosses, stage rewards, and your unlocked route.' }),
        GameButton({ label: 'Open campaign', variant: 'outline', onClick: () => openScreen('CAMPAIGN') }),
      ]),
      el('section', { class: 'ftd-briefing' }, [
        el('p', { class: 'ftd-briefing__eyebrow', text: 'COMMUNITY' }),
        el('h2', { class: 'ftd-briefing__title', text: 'Meet the defenders' }),
        el('p', { class: 'ftd-briefing__copy', text: 'Find friends, check messages, and read the community board.' }),
        GameButton({ label: 'Open community', variant: 'outline', onClick: () => openScreen('SOCIAL') }),
      ]),
    ]),
  );
}
