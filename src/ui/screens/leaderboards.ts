import { getAuthToken } from '../../services/auth';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
export function renderLeaderboards(root: HTMLElement): void {
  root.replaceChildren(el('h1', { text: 'LEADERBOARDS' }));
  const tabs = el('div', { class: 'ftd-board-tabs' }), scopes = el('div', { class: 'ftd-board-tabs' }), list = el('div', { class: 'ftd-board-list', 'aria-live': 'polite' }); root.append(tabs, scopes, list);
  let category = 'ranked', scope = 'global', revision = 0;
  const categories = [['ranked','Ranked FR'], ['casual','Casual'], ['horde','Horde'], ['coop','Co-op'], ['campaign','Campaign'], ['coins','Coins'], ['gems','Gems']];
  const load = async () => {
    const current = ++revision;
    tabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    scopes.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === scope)));
    list.replaceChildren(el('p', { text: 'Loading records…' }));
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/leaderboard/boards?category=${category}&scope=${scope}`, { signal: AbortSignal.timeout(12000), headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await response.json(); if (current !== revision || !root.isConnected) return;
      if (!response.ok) throw new Error(data.error || 'Records unavailable.');
      list.replaceChildren(el('p', { text: `Sorted by ${data.metric} · ${scope === 'friends' ? 'You and your friends' : 'Global top 50'}` }));
      if (!data.entries.length) list.append(el('p', { text: 'No records yet. Play a match to set the pace.' }));
      data.entries.forEach((entry: { rank: number; name: string; value: number; detail: string; isYou: boolean }) => list.append(el('div', { class: `ftd-board-row${entry.isYou ? ' is-you' : ''}` }, [el('strong', { text: `#${entry.rank}` }), el('div', {}, [el('strong', { text: `${entry.name}${entry.isYou ? ' · YOU' : ''}` }), el('small', { text: entry.detail })]), el('strong', { text: entry.value.toLocaleString() })])));
    } catch (error) {
      if (current !== revision) return;
      list.replaceChildren(el('p', { role: 'alert', text: error instanceof Error ? error.message : 'Records unavailable.' }), GameButton({ label: 'Retry', onClick: () => void load() }));
    }
  };
  categories.forEach(([id,label]) => { const button = GameButton({ label, onClick: () => { category = id; void load(); } }); button.dataset.category = id; tabs.append(button); });
  [['global','Everyone'], ['friends','Friends']].forEach(([id,label]) => { const button = GameButton({ label, onClick: () => { scope = id; void load(); } }); button.dataset.scope = id; scopes.append(button); });
  void load();
}
