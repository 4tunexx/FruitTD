import { createElement, ArrowLeft, Shield, LockKeyhole, Swords, Sparkles } from 'lucide';
import { campaignBoss, campaignWaves, sanitizeCampaignProgress, type CampaignProgress } from '../../game/campaign';
import type { SaveData } from '../../game/save';
import { getLiveConfig } from '../../services/liveConfig';
import { el, clear } from '../components/dom';
import { back } from './registry';

const icon = (node: typeof Shield) => typeof document.createElementNS === 'function'
  ? createElement(node, { width: 19, height: 19, 'aria-hidden': 'true' }) : el('span', { text: '◆' });

export function renderCampaign(root: HTMLElement, save: SaveData, onStart: (stage: number) => void): void {
  clear(root);
  root.className = 'ftd-screen-host ftd-campaign';
  const progress: CampaignProgress = sanitizeCampaignProgress(save.campaignProgress);
  const start = Math.max(1, Math.min(96, progress.unlocked - 2));
  const end = Math.min(100, start + 4);
  let selected = Math.min(progress.unlocked, Math.max(start, progress.unlocked));
  const roster = getLiveConfig().campaignBosses;
  const head = el('header', { class: 'ftd-campaign__header' }, [
    el('button', { class: 'ftd-campaign__back', type: 'button', 'aria-label': 'Back to hub' }, [icon(ArrowLeft), el('span', { text: 'BACK' })]),
    el('div', {}, [el('p', { class: 'ftd-campaign__eyebrow', text: 'THE ROTTEN ORCHARD' }), el('h1', { text: 'CAMPAIGN' }), el('p', { text: '100 stages · 100 overlords · one wall to hold' })]),
    el('div', { class: 'ftd-campaign__progress' }, [el('strong', { text: `${progress.cleared.length}/100` }), el('span', { text: 'STAGES CLEARED' })]),
  ]);
  head.querySelector('button')?.addEventListener('click', back);
  root.appendChild(head);

  const map = el('section', { class: 'ftd-campaign__map', 'aria-label': `Campaign stages ${start} to ${end}` });
  map.appendChild(el('div', { class: 'ftd-campaign__route' }));
  const nodes: HTMLButtonElement[] = [];
  for (let stage = start; stage <= end; stage++) {
    const cleared = progress.cleared.includes(stage);
    const locked = stage > progress.unlocked;
    const button = el('button', { type: 'button', class: `ftd-stage${cleared ? ' is-cleared' : ''}${locked ? ' is-locked' : ''}`, disabled: locked, 'aria-label': `Stage ${stage}${locked ? ', locked' : cleared ? ', cleared' : ', available'}` }, [
      icon(locked ? LockKeyhole : cleared ? Sparkles : Shield),
      el('strong', { text: String(stage).padStart(2, '0') }),
      el('small', { text: cleared ? 'CLEARED' : locked ? 'LOCKED' : 'READY' }),
    ]) as HTMLButtonElement;
    button.addEventListener('click', () => { selected = stage; renderDetails(); });
    map.appendChild(button); nodes.push(button);
    if (stage === progress.unlocked && stage > 1 && progress.unlocked < 100) map.appendChild(el('div', { class: 'ftd-campaign__portal', 'aria-label': 'Portal to the next stage' }, [el('span', { text: 'PORTAL' }), el('i')]));
  }
  root.appendChild(map);

  const detail = el('section', { class: 'ftd-boss-reveal' });
  root.appendChild(detail);
  const renderDetails = () => {
    const boss = campaignBoss(selected, roster);
    clear(detail);
    detail.dataset.stage = String(selected);
    const art = el('div', { class: 'ftd-boss-reveal__art' }, [
      boss.revealImage ? el('img', { src: boss.revealImage, alt: `${boss.name} boss artwork` }) : el('div', { class: 'ftd-boss-reveal__sigil' }, [icon(Swords), el('span', { text: `OVERLORD ${String(selected).padStart(2, '0')}` })]),
      el('span', { class: 'ftd-boss-reveal__stamp', text: 'BOSS INTEL' }),
    ]);
    detail.appendChild(art);
    detail.appendChild(el('div', { class: 'ftd-boss-reveal__copy' }, [
      el('p', { class: 'ftd-campaign__eyebrow', text: boss.title }),
      el('h2', { text: boss.name }),
      el('p', { class: 'ftd-boss-reveal__description', text: boss.description }),
      el('div', { class: 'ftd-boss-reveal__facts' }, [
        el('span', { text: `${campaignWaves(selected)} WAVES` }), el('span', { text: `THREAT ×${boss.difficulty.toFixed(1)}` }),
        el('span', { text: `REWARD  ${boss.rewardCoins.toLocaleString()} COINS${boss.rewardGems ? ` · ${boss.rewardGems} GEMS` : ''}` }),
      ]),
      el('button', { type: 'button', class: 'ftd-campaign__launch', 'data-testid': 'campaign-start-stage' }, [icon(Swords), el('span', { text: progress.cleared.includes(selected) ? 'REPLAY STAGE' : `ENTER STAGE ${String(selected).padStart(2, '0')}` })]),
    ]));
    detail.querySelector('.ftd-campaign__launch')?.addEventListener('click', () => onStart(selected));
    nodes.forEach((node) => node.classList.toggle('is-selected', Number(node.querySelector('strong')?.textContent) === selected));
  };
  renderDetails();
}
