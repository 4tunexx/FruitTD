import { MODE_ICONS } from '../modeIcons';
import { getAuthToken } from '../../services/auth';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { lucideIcon } from '../lucideIcon';
import { openScreen } from './registry';

type BoardCategory = 'ranked' | 'casual' | 'horde' | 'coop' | 'campaign' | 'coins' | 'gems';
type BoardScope = 'global' | 'friends';
type BoardEntry = { rank: number; name: string; value: number; detail: string; isYou: boolean };

const categories: Array<{ id: BoardCategory; label: string; icon: string }> = [
  { id: 'ranked', label: 'Ranked FR', icon: MODE_ICONS.ranked },
  { id: 'casual', label: 'Casual', icon: MODE_ICONS.casual },
  { id: 'horde', label: 'Horde', icon: MODE_ICONS.horde },
  { id: 'coop', label: 'Co-op', icon: MODE_ICONS.coop },
  { id: 'campaign', label: 'Campaign', icon: MODE_ICONS.campaign },
  { id: 'coins', label: 'Coins', icon: 'Coins' },
  { id: 'gems', label: 'Gems', icon: 'Gem' },
];

function safeEntry(value: unknown, index: number): BoardEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 48) : 'Defender';
  const rank = Number(item.rank);
  const score = Number(item.value);
  return {
    rank: Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : index + 1,
    name,
    value: Number.isFinite(score) ? Math.max(0, score) : 0,
    detail: typeof item.detail === 'string' ? item.detail.slice(0, 100) : '',
    isYou: item.isYou === true,
  };
}

function emptyMessage(category: BoardCategory, scope: BoardScope): { title: string; copy: string; action: string; destination: string } {
  if (scope === 'friends') return {
    title: 'Your squad board is waiting',
    copy: 'Add a few defenders or invite your crew. Their best runs will appear here automatically.',
    action: 'Find defenders',
    destination: 'SOCIAL',
  };
  if (category === 'ranked') return {
    title: 'Claim the first place',
    copy: 'No ranked scores have been recorded yet. Finish a ranked siege and your rating will enter the global board.',
    action: 'Enter ranked siege',
    destination: 'RANKED',
  };
  if (category === 'coins' || category === 'gems') return {
    title: 'The board is clear',
    copy: 'Play a run and collect rewards to put the first balance on this board.',
    action: 'Choose a run',
    destination: 'MAIN_MENU',
  };
  return {
    title: 'Set the pace',
    copy: 'There are no scores here yet. Play this mode and your best result will set the benchmark.',
    action: category === 'coop' ? 'Find a squad' : category === 'campaign' ? 'Open campaign' : 'Choose a run',
    destination: category === 'coop' ? 'CO_OP' : category === 'campaign' ? 'CAMPAIGN' : 'MAIN_MENU',
  };
}

export function renderLeaderboards(root: HTMLElement): void {
  root.replaceChildren();
  const page = el('section', { class: 'ftd-board' });
  const categoryTabs = el('div', { class: 'ftd-board-tabs ftd-board-tabs--categories', role: 'group', 'aria-label': 'Leaderboard category' });
  const scopeTabs = el('div', { class: 'ftd-board-tabs ftd-board-tabs--scope', role: 'group', 'aria-label': 'Leaderboard audience' });
  const introEyebrow = el('p', { class: 'ftd-board-intro__eyebrow', text: 'GLOBAL STANDINGS' });
  const intro = el('div', { class: 'ftd-board-intro' }, [
    el('div', { class: 'ftd-board-intro__icon', 'aria-hidden': 'true' }, [lucideIcon('Trophy', '', 25)]),
    el('div', {}, [
      introEyebrow,
      el('p', { class: 'ftd-board-intro__copy', text: 'Pick a challenge and see who is setting the pace.' }),
    ]),
  ]);
  const content = el('div', { class: 'ftd-board-content', 'aria-live': 'polite', 'aria-busy': 'true' });
  const toolbar=el('div',{class:'ftd-board-toolbar'},[categoryTabs,scopeTabs]);
  const columns=el('div',{class:'ftd-board-columns','aria-hidden':'true'},[el('span',{text:'RANK'}),el('span',{text:'DEFENDER'}),el('span',{text:'RESULT'})]);
  page.append(toolbar,intro,columns,content);
  root.appendChild(page);

  let category: BoardCategory = 'ranked';
  let scope: BoardScope = 'global';
  let revision = 0;
  let controller: AbortController | null = null;

  const showEmpty = () => {
    const state = emptyMessage(category, scope);
    content.replaceChildren(el('div', { class: 'ftd-board-empty' }, [
      el('div', { class: 'ftd-board-empty__art', 'aria-hidden': 'true' }, [lucideIcon(scope === 'friends' ? 'Users' : 'Trophy', '', 40)]),
      el('p', { class: 'ftd-board-empty__eyebrow', text: scope === 'friends' ? 'FRIENDS ONLY' : 'NO SCORES YET' }),
      el('h2', { text: state.title }),
      el('p', { class: 'ftd-board-empty__copy', text: state.copy }),
      GameButton({ label: state.action, icon: scope === 'friends' ? 'Users' : category === 'ranked' ? 'Swords' : 'ChevronRight', tone: 'accent', onClick: () => openScreen(state.destination as Parameters<typeof openScreen>[0]) }),
    ]));
    content.setAttribute('aria-busy', 'false');
  };

  const load = async () => {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    categoryTabs.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    scopeTabs.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === scope)));
    columns.children[2]!.textContent=({ranked:'RANK POINTS',casual:'SCORE',horde:'WAVE',coop:'WAVES',campaign:'STAGE',coins:'COINS',gems:'GEMS'})[category];
    introEyebrow.textContent = scope === 'friends' ? 'SQUAD STANDINGS' : 'GLOBAL STANDINGS';
    content.setAttribute('aria-busy', 'true');
    content.replaceChildren(el('div', { class: 'ftd-board-loading' }, [
      el('span', { class: 'ftd-board-loading__spinner', 'aria-hidden': 'true' }),
      el('p', { text: 'Scanning the boards…' }),
    ]));
    const requestController = controller;
    const timeout = window.setTimeout(() => requestController.abort(), 12000);
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/leaderboard/boards?category=${encodeURIComponent(category)}&scope=${encodeURIComponent(scope)}`, {
        signal: requestController.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data: unknown = await response.json();
      if (current !== revision || !root.isConnected) return;
      if (!response.ok) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Records are unavailable right now.';
        throw new Error(message);
      }
      if (!data || typeof data !== 'object' || !('entries' in data) || !Array.isArray(data.entries)) {
        throw new Error('The leaderboard returned an unexpected response. Try again.');
      }
      const payload = data as { entries: unknown[]; metric?: unknown };
      const entries = payload.entries.map(safeEntry).filter((entry): entry is BoardEntry => entry !== null);
      if (!entries.length) {
        showEmpty();
        return;
      }
      const metric = typeof payload.metric === 'string' && payload.metric.trim() ? payload.metric.trim().slice(0, 50) : 'Score';
      columns.children[2]!.textContent=metric.toUpperCase();
      const rows = entries.map(entry => el('article', { class: `ftd-board-row${entry.isYou ? ' is-you' : ''}` }, [
        el('div', { class: `ftd-board-row__rank${entry.rank <= 3 ? ` ftd-board-row__rank--${entry.rank}` : ''}` }, [
          entry.rank <= 3 ? lucideIcon(entry.rank === 1 ? 'Crown' : 'Medal', '', 17) : null,
          el('strong', { text: `#${entry.rank}` }),
        ]),
        el('div', { class: 'ftd-board-row__player' }, [
          el('strong', { text: `${entry.name}${entry.isYou ? ' · YOU' : ''}` }),
          ...(entry.detail ? [el('small', { text: entry.detail })] : []),
        ]),
        el('div', { class: 'ftd-board-row__score' }, [
          el('small', { text: metric }),
          el('strong', { text: Math.round(entry.value).toLocaleString() }),
        ]),
      ]));
      content.replaceChildren(
        el('div', { class: 'ftd-board-summary' }, [
          el('span', { text: scope === 'friends' ? 'YOUR SQUAD' : 'GLOBAL TOP 50' }),
          el('span', { text: `${entries.length} ${entries.length === 1 ? 'defender' : 'defenders'}` }),
        ]),
        el('div', { class: 'ftd-board-list' }, rows),
      );
      content.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (current !== revision || !root.isConnected) return;
      const message = requestController.signal.aborted ? 'The board took too long to respond.' : error instanceof Error ? error.message : 'Records are unavailable right now.';
      content.replaceChildren(el('div', { class: 'ftd-board-error', role: 'alert' }, [
        el('p', { text: message }),
        GameButton({ label: 'Retry', icon: 'RefreshCw', variant: 'outline', onClick: () => void load() }),
      ]));
      content.setAttribute('aria-busy', 'false');
    } finally {
      window.clearTimeout(timeout);
    }
  };

  categories.forEach(({ id, label, icon }) => {
    const button = GameButton({ label, icon, variant: 'outline', size: 'sm', onClick: () => { category = id; void load(); } });
    button.dataset.category = id;
    button.setAttribute('aria-pressed', String(id === category));
    categoryTabs.appendChild(button);
  });
  ([['global', 'Everyone', 'Globe2'], ['friends', 'Friends', 'Users']] as const).forEach(([id, label, icon]) => {
    const button = GameButton({ label, icon, variant: 'outline', size: 'sm', onClick: () => { scope = id; void load(); } });
    button.dataset.scope = id;
    button.setAttribute('aria-pressed', String(id === scope));
    scopeTabs.appendChild(button);
  });
  void load();
}
