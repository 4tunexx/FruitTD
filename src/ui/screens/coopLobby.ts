import { clear, el } from '../components/dom';

export function renderCoopLobby(root: HTMLElement, startLocal: () => void): void {
  const card = el('section', { class: 'ftd-coop-card ftd-coop-lobby' }, [
    el('p', { class: 'ftd-playcard__eyebrow', text: 'LOCAL CO-OP' }),
    el('h2', { text: 'DEFEND THE WALL TOGETHER' }),
    el('p', { text: 'Two people play the same match on this PC. Both players can slice incoming fruit while the wall and rewards belong to the current profile.' }),
  ]);
  const controls = el('div', { class: 'ftd-coop-lobby__columns' }, [
    el('section', { class: 'ftd-coop-lobby__local' }, [
      el('p', { class: 'ftd-playcard__eyebrow', text: 'PLAYER 1' }),
      el('h3', { text: 'Mouse or touch' }),
      el('p', { text: 'Swipe across fruit, place towers, and manage upgrades.' }),
    ]),
    el('section', { class: 'ftd-coop-lobby__local' }, [
      el('p', { class: 'ftd-playcard__eyebrow', text: 'PLAYER 2' }),
      el('h3', { text: 'Keyboard' }),
      el('p', { text: 'Use the arrow keys to move the blue cursor. Hold Enter to slash.' }),
    ]),
  ]);
  const play = el('button', { class: 'ftd-coop-lobby__button', type: 'button', text: 'Start local Co-op' });
  play.addEventListener('click', startLocal);
  card.appendChild(controls);
  card.appendChild(play);
  clear(root);
  root.appendChild(card);
}
