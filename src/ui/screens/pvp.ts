import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { getAuthToken } from '../../services/auth';
import type { PvpConfig, PvpQueue } from '../../game/pvp';
import type { Realtime as AblyRealtime } from 'ably';
import { socialApi } from '../../services/social';

type MapView = { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells?: number[] };
type MatchView = { id: string; queue: PvpQueue; status: string; remainingMs: number; revision: number; map: MapView | null; mapPool: MapView[]; yourVetoTurn: boolean; vetoesRemaining: number; players: Array<{ userId: string; name: string; side: string; fruts: number; wallHealth: number; score: number; towers: Array<{ id: string; type: string; cell: number }>; attackers: Array<{ id: string; type: string; progress: number }>; connected: boolean; ratingDelta?: number }>; yourSide: string; winnerId: string | null; resultReason: string | null; yourSequence: number; yourCombo: number };
type PvpStatus = { success: boolean; error?: string; rating?: { points: number; tier: string; season: string; matches: number; wins: number; ties: number; losses: number }; match?: MatchView | null; queued?: PvpQueue | null; challenge?: { challengeId: string; fromId: string; fromName: string } | null; config?: Pick<PvpConfig, 'durationSeconds' | 'reconnectGraceSeconds' | 'towers' | 'attacks' | 'maps'> };
const timers = new WeakMap<HTMLElement, number>();
const realtimeClients = new WeakMap<HTMLElement, AblyRealtime>();
const pvpApiBase = (import.meta.env?.VITE_PVP_API_URL || '/api/pvp').replace(/\/$/, '');

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const token = getAuthToken();
  const response = await fetch(`${pvpApiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'PvP service is unavailable.');
  return data;
}
function label(text: string, cls = ''): HTMLElement { return el('p', { class: cls, text }); }

export function renderPvpHub(root: HTMLElement, queue: PvpQueue): void {
  const prior = timers.get(root); if (prior) globalThis.clearInterval(prior);
  root.replaceChildren();
  const main = el('section', { class: `ftd-pvp ftd-pvp--${queue}` }); root.appendChild(main);
  let status: PvpStatus = { success: true };
  let selectedTower = 'guillotine';
  let selectedAttackers = new Set<string>();
  let busy = false;
  const heading = el('header', { class: 'ftd-pvp__heading' }, [
    el('div', {}, [label(queue === 'ranked' ? 'FR POINT LADDER · PUBLIC QUEUE' : 'UNRANKED · FRIENDS OR QUICK MATCH', 'ftd-pvp__eyebrow'), el('h1', { text: queue === 'ranked' ? 'RANKED SIEGE' : 'ARENA' }), label('Three minutes. Build your line. Send fruit-zombies to break the other wall.', 'ftd-pvp__intro')]),
    el('div', { class: 'ftd-pvp__rating', 'data-pvp-rating': '' }, [label('RATING', 'ftd-pvp__eyebrow'), el('strong', { text: 'Loading…' })]),
  ]);
  main.appendChild(heading);
  const body = el('div', { class: 'ftd-pvp__body', 'aria-live': 'polite' }); main.appendChild(body);

  const refresh = async () => {
    try { status = await request('/status'); render(); }
    catch (error) { body.replaceChildren(label(error instanceof Error ? error.message : 'Could not connect.')); }
  };
  const attachRealtime = async (match: MatchView) => {
    if (realtimeClients.has(root) || !getAuthToken()) return;
    try {
      const { Realtime } = await import('ably');
      if (!root.isConnected) return;
      const client = new Realtime({ authCallback: async (_params, callback) => {
        try { const response = await request(`/match/${match.id}/token`); callback(null, response.token); }
        catch (error) { callback({ name: 'PvpTokenError', message: error instanceof Error ? error.message : 'PvP authentication failed', code: 500, statusCode: 500 }, null); }
      } });
      realtimeClients.set(root, client);
      const channel = client.channels.get(`fruittd-pvp-${match.id}`);
      channel.subscribe('match.snapshot', (message) => {
        const revision = Number((message.data as { revision?: number } | undefined)?.revision ?? -1);
        if (status.match?.id === match.id && revision > status.match.revision) void refresh();
      });
    } catch (error) { console.warn('PvP realtime subscription unavailable; using match snapshots.', error); }
  };
  const send = async (path: string, payload?: unknown, method = 'POST') => {
    if (busy) return;
    busy = true;
    try {
      await request(path, { method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
      if (path.includes('/command') && (payload as any)?.command?.type === 'slash') selectedAttackers.clear();
      await refresh();
    }
    catch (error) { body.prepend(label(error instanceof Error ? error.message : 'Action failed.', 'ftd-pvp__error')); }
    finally { busy = false; }
  };
  const render = () => {
    const badge = main.querySelector<HTMLElement>('[data-pvp-rating] strong');
    if (badge && status.rating) badge.textContent = `${status.rating.tier} · ${status.rating.points.toLocaleString()} FR`;
    body.replaceChildren();
    const match = status.match;
    const towerIds = Object.keys(status.config?.towers || {});
    if (!towerIds.includes(selectedTower) && towerIds.length) selectedTower = towerIds[0]!;
    if (!getAuthToken()) { body.append(label('Sign in to play online Arena or Ranked.', 'ftd-pvp__notice')); return; }
    if (!match) {
      const oldClient = realtimeClients.get(root); if (oldClient) { void oldClient.close(); realtimeClients.delete(root); }
      body.append(el('div', { class: 'ftd-pvp__queue' }, [
        label(status.queued === queue ? `Searching for an opponent · ${queue.toUpperCase()}` : 'Find an opponent', 'ftd-pvp__section-title'),
        label(queue === 'ranked' ? 'Win +50 FR · Tie +20 · Loss −50, with server-verified performance bonuses.' : 'Arena results do not change FR points.', 'ftd-pvp__intro'),
        status.queued === queue
          ? GameButton({ label: 'Cancel search', variant: 'outline', onClick: () => void send('/queue', undefined, 'DELETE') })
          : GameButton({ label: queue === 'ranked' ? 'Find ranked match' : 'Quick match', tone: 'primary', onClick: () => void send('/queue', { queue }) }),
        ...(queue === 'arena' ? [el('div', { class: 'ftd-pvp__challenge' }, [el('label', { htmlFor: 'pvp-friend-select', text: 'Challenge a friend' }), el('select', { id: 'pvp-friend-select', class: 'ftd-pvp__friend-select' }, [el('option', { value: '', text: 'Loading friends…' })]), GameButton({ label: 'Send challenge', variant: 'outline', onClick: () => { const friendId = main.querySelector<HTMLSelectElement>('#pvp-friend-select')?.value; if (friendId) void send('/challenge', { friendId }); } })])] : []),
        ...(status.challenge ? [el('div', { class: 'ftd-pvp__incoming' }, [label(`${status.challenge.fromName} challenged you.`), GameButton({ label: 'Accept challenge', tone: 'primary', onClick: () => void send(`/challenge/${status.challenge!.challengeId}/accept`) })])] : []),
      ]));
      if (queue === 'arena') {
        const select = main.querySelector<HTMLSelectElement>('#pvp-friend-select');
        if (select && select.dataset.loaded !== '1') {
          select.dataset.loaded = '1';
          void socialApi.friends().then(({ friends }) => {
            if (!select.isConnected) return;
            const accepted = friends.filter((friend) => friend.state === 'accepted');
            select.replaceChildren(el('option', { value: '', text: accepted.length ? 'Choose a friend' : 'Add a friend first' }), ...accepted.map((friend) => el('option', { value: friend.userId, text: friend.nickname || friend.username })));
          }).catch(() => { if (select.isConnected) select.replaceChildren(el('option', { value: '', text: 'Could not load friends' })); });
        }
      }
      return;
    }
    const own = match.players.find((player) => player.side === match.yourSide)!;
    const opponent = match.players.find((player) => player.side !== match.yourSide)!;
    void attachRealtime(match);
    if (match.status === 'draft') {
      const drafts = match.mapPool.map((map) => {
        const path = new Set(map.pathCells);
        const thumbnail = el('div', { class: 'ftd-pvp__map-thumb', style: `--map-cols:${map.width}` }, Array.from({ length: map.width * map.height }, (_, cell) => el('i', { class: path.has(cell) ? 'is-path' : '' })));
        const veto = el('button', { class: 'ftd-pvp__map-card', type: 'button', disabled: !match.yourVetoTurn }, [thumbnail, el('strong', { text: map.name }), el('small', { text: `${map.pathCells.length} path tiles · veto this route` })]);
        veto.addEventListener('click', () => void send(`/match/${match.id}/veto`, { sequence: match.yourSequence + 1, mapId: map.id })); return veto;
      });
      body.append(el('section', { class: 'ftd-pvp__draft' }, [el('div', { class: 'ftd-pvp__draft-head' }, [el('h2', { text: 'CHOOSE THE BATTLEFIELD' }), label(`${match.vetoesRemaining} vetoes left · then one of the final two paths is selected at random`), label(match.yourVetoTurn ? 'Your turn: veto one route' : 'Waiting for the other player to veto a route')]), el('div', { class: 'ftd-pvp__map-grid' }, drafts)]));
      return;
    }
    if (match.status === 'complete') {
      const won = match.winnerId === own.userId;
      body.append(el('section', { class: 'ftd-pvp__result' }, [el('h2', { text: won ? 'WALL HELD' : match.winnerId ? 'WALL BREACHED' : 'DRAW' }), label(`Final walls · You ${own.wallHealth} — ${opponent.wallHealth} opponent`), label(`Score · You ${own.score} — ${opponent.score} opponent`), ...(queue === 'ranked' ? [label(`FR change · ${own.ratingDelta === undefined ? 'Tie' : own.ratingDelta > 0 ? '+' : ''}${own.ratingDelta ?? 0} FR`)] : []), GameButton({ label: 'Back to queue', tone: 'primary', onClick: () => void send(`/match/${match.id}/ack`) })]));
      return;
    }
    const timer = Math.ceil(match.remainingMs / 1000);
    const map = match.map!;
    const routeCells = new Set(map.pathCells);
    const attackersByCell = new Map<number, number>();
    for (const fruit of own.attackers) { const cell = map.pathCells[Math.min(map.pathCells.length - 1, Math.floor(fruit.progress))]!; attackersByCell.set(cell, (attackersByCell.get(cell) || 0) + 1); }
    const grid = el('div', { class: 'ftd-pvp__cells', style: `--map-cols:${map.width}`, 'aria-label': 'Battle path and build cells' });
    for (let i = 0; i < map.width * map.height; i++) {
      const tower = own.towers.find((item) => item.cell === i);
      const path = routeCells.has(i); const endpoint = map.pathCells[0] === i ? ' · enemy gate' : map.pathCells.at(-1) === i ? ' · your wall' : '';
      const cell = el('button', { type: 'button', class: `ftd-pvp__cell${path ? ' is-path' : ''}${tower ? ' is-built' : ''}${attackersByCell.has(i) ? ' has-fruit' : ''}`, disabled: path || Boolean(tower), title: path ? `Lane${endpoint}` : tower?.type || `Build ${selectedTower}`, text: tower ? tower.type.slice(0, 3).toUpperCase() : path ? (attackersByCell.has(i) ? `●${attackersByCell.get(i)}` : '·') : '＋' });
      cell.addEventListener('click', () => void send(`/match/${match.id}/command`, { sequence: match.yourSequence + 1, command: { type: 'build', tower: selectedTower, cell: i } })); grid.append(cell);
    }
    const attacks = Object.entries(status.config?.attacks || {});
    const attackers = el('div', { class: 'ftd-pvp__attackers' }, own.attackers.length ? [
      ...own.attackers.map((fruit) => {
        const button = el('button', { class: `ftd-pvp__fruit${selectedAttackers.has(fruit.id) ? ' is-selected' : ''}`, type: 'button', 'aria-pressed': String(selectedAttackers.has(fruit.id)), title: `At ${Math.round(fruit.progress * 10)}% of the lane`, text: `${fruit.type.toUpperCase()} · ${selectedAttackers.has(fruit.id) ? 'selected' : 'select to slice'}` });
        button.addEventListener('click', () => {
          if (selectedAttackers.has(fruit.id)) selectedAttackers.delete(fruit.id);
          else if (selectedAttackers.size < 8) selectedAttackers.add(fruit.id);
          render();
        }); return button;
      }),
      GameButton({ label: `Slice ${selectedAttackers.size || 'selected'} fruit${selectedAttackers.size === 1 ? '' : 's'} · combo ×${match.yourCombo}`, tone: 'primary', disabled: selectedAttackers.size === 0, onClick: () => void send(`/match/${match.id}/command`, { sequence: match.yourSequence + 1, command: { type: 'slash', attackerIds: [...selectedAttackers] } }) }),
    ] : [label('No incoming fruit-zombies. Watch the lane.', 'ftd-pvp__intro')]);
    body.append(el('div', { class: 'ftd-pvp__matchbar' }, [
      el('strong', { text: `${timer}s` }), label(`${own.name} · ${own.side.toUpperCase()}`), label(`Wall ${own.wallHealth} · ${own.fruts} match Fruts · Score ${own.score}`),
      label(`${opponent.name} · Wall ${opponent.wallHealth} · Score ${opponent.score}`), label(opponent.connected ? 'Opponent connected' : 'Opponent reconnecting…'),
    ]));
    const battlefield = el('div', { class: 'ftd-pvp__battlefield' }, [label(`${opponent.side === 'blue' ? 'BLUE' : 'RED'} ENEMY GATE · ${opponent.name}`, 'ftd-pvp__gate ftd-pvp__gate--enemy'), grid, label(`${own.side === 'blue' ? 'BLUE' : 'RED'} WALL + MAIN TOWER · ${own.wallHealth} HP`, 'ftd-pvp__gate ftd-pvp__gate--own')]);
    const controls = el('section', { class: 'ftd-pvp__controls' }, [label(`DEFEND ${map.name.toUpperCase()}`, 'ftd-pvp__section-title'), battlefield, el('div', { class: 'ftd-pvp__tower-picker' }, Object.entries(status.config?.towers || {}).map(([id, info]) => GameButton({ label: `${id} · ${info.cost} Fruts`, variant: id === selectedTower ? 'outline' : 'ghost', onClick: () => { selectedTower = id; render(); } }))), label('SEND A FRUIT-ZOMBIE', 'ftd-pvp__section-title'), el('div', { class: 'ftd-pvp__tower-picker' }, attacks.map(([id, info]) => GameButton({ label: `${id} · ${info.cost} Fruts`, tone: 'primary', onClick: () => void send(`/match/${match.id}/command`, { sequence: match.yourSequence + 1, command: { type: 'send', enemy: id } }) }))), label(`YOUR INCOMING LANE · Combo ×${match.yourCombo}`, 'ftd-pvp__section-title'), attackers]);
    body.append(controls);
  };
  void refresh();
  const timer = globalThis.setInterval(() => { if (!root.isConnected) { globalThis.clearInterval(timer); const client = realtimeClients.get(root); if (client) void client.close(); realtimeClients.delete(root); return; } void refresh(); }, 900) as unknown as number;
  timers.set(root, timer);
}
