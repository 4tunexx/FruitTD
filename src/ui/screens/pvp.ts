import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { getAuthToken } from '../../services/auth';
import type { PvpConfig, PvpQueue } from '../../game/pvp';
import type { Realtime as AblyRealtime } from 'ably';
import { socialApi } from '../../services/social';

type MapView = { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells?: number[] };
type MatchView = { id: string; queue: PvpQueue; status: string; testMatch: boolean; remainingMs: number; revision: number; map: MapView | null; mapPool: MapView[]; yourVetoTurn: boolean; vetoesRemaining: number; players: Array<{ userId: string; name: string; side: string; fruts: number; wallHealth: number; score: number; towers: Array<{ id: string; type: string; cell: number }>; attackers: Array<{ id: string; type: string; progress: number }>; connected: boolean; ratingDelta?: number }>; yourSide: string; winnerId: string | null; resultReason: string | null; yourSequence: number; yourCombo: number };
type PvpStatus = { success: boolean; error?: string; canStartBotMatch?: boolean; rating?: { points: number; tier: string; season: string; matches: number; wins: number; ties: number; losses: number }; match?: MatchView | null; queued?: PvpQueue | null; challenge?: { challengeId: string; fromId: string; fromName: string } | null; config?: Pick<PvpConfig, 'durationSeconds' | 'reconnectGraceSeconds' | 'towers' | 'attacks' | 'maps'> };
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
  let selectedTestMap = '';
  let selectedFriend = '';
  let friendOptions: Array<{ userId: string; name: string }> | null = null;
  let friendsLoading = false;
  let friendsError = false;
  let activeStroke: { pointerId: number; x: number; y: number; startX: number; startY: number; grid: HTMLElement; matchId: string; sequence: number; width: number; height: number } | null = null;
  let busy = false;
  const heading = el('header', { class: 'ftd-pvp__heading' }, [
    el('div', {}, [label(queue === 'ranked' ? 'FR POINT LADDER · PUBLIC QUEUE' : 'UNRANKED · FRIENDS OR QUICK MATCH', 'ftd-pvp__eyebrow'), el('h1', { text: queue === 'ranked' ? 'RANKED SIEGE' : 'ARENA' }), label('Three minutes. Build your line. Send fruit-zombies to break the other wall.', 'ftd-pvp__intro')]),
    el('div', { class: 'ftd-pvp__rating', 'data-pvp-rating': '' }, [label('RATING', 'ftd-pvp__eyebrow'), el('strong', { text: 'Loading…' })]),
  ]);
  main.appendChild(heading);
  const body = el('div', { class: 'ftd-pvp__body', 'aria-live': 'polite' }); main.appendChild(body);

  const refresh = async () => {
    try { status = await request('/status'); if (!activeStroke) render(); }
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
      if (!status.config?.maps.some((map) => map.id === selectedTestMap)) selectedTestMap = status.config?.maps[0]?.id || '';
      body.append(el('div', { class: 'ftd-pvp__queue' }, [
        label(status.queued === queue ? `Searching for an opponent · ${queue.toUpperCase()}` : 'Find an opponent', 'ftd-pvp__section-title'),
        label(queue === 'ranked' ? 'Win +50 FR · Tie +20 · Loss −50, with server-verified performance bonuses.' : 'Arena results do not change FR points.', 'ftd-pvp__intro'),
        status.queued === queue
          ? GameButton({ label: 'Cancel search', variant: 'outline', onClick: () => void send('/queue', undefined, 'DELETE') })
          : GameButton({ label: queue === 'ranked' ? 'Find ranked match' : 'Quick match', tone: 'primary', onClick: () => void send('/queue', { queue }) }),
        ...(queue === 'arena' ? [el('div', { class: 'ftd-pvp__challenge' }, [el('label', { htmlFor: 'pvp-friend-select', text: 'Challenge a friend' }), el('select', { id: 'pvp-friend-select', class: 'ftd-pvp__friend-select' }, [el('option', { value: '', text: friendsError ? 'Could not load friends' : friendOptions ? friendOptions.length ? 'Choose a friend' : 'Add a friend first' : 'Loading friends…' }), ...(friendOptions || []).map((friend) => el('option', { value: friend.userId, text: friend.name, selected: friend.userId === selectedFriend }))]), GameButton({ label: 'Send challenge', variant: 'outline', onClick: () => { if (selectedFriend) void send('/challenge', { friendId: selectedFriend }); } })])] : []),
        ...(status.challenge ? [el('div', { class: 'ftd-pvp__incoming' }, [label(`${status.challenge.fromName} challenged you.`), GameButton({ label: 'Accept challenge', tone: 'primary', onClick: () => void send(`/challenge/${status.challenge!.challengeId}/accept`) })])] : []),
        ...(status.canStartBotMatch ? [el('div', { class: 'ftd-pvp__bot-start' }, [label('ADMIN PLAYTEST', 'ftd-pvp__section-title'), label('Play the full siege against a server-controlled opponent. Results do not grant FR, rewards, or badges.', 'ftd-pvp__intro'), el('label', { htmlFor: 'pvp-test-map', text: 'Battlefield' }), el('select', { id: 'pvp-test-map', class: 'ftd-pvp__friend-select' }, (status.config?.maps || []).map((map) => el('option', { value: map.id, text: map.name, selected: map.id === selectedTestMap }))), GameButton({ label: `Test ${queue === 'ranked' ? 'Ranked' : 'Arena'} vs bot`, tone: 'primary', onClick: () => void send('/admin/bot', { queue, mapId: main.querySelector<HTMLSelectElement>('#pvp-test-map')?.value || selectedTestMap }) })])] : []),
      ]));
      main.querySelector<HTMLSelectElement>('#pvp-test-map')?.addEventListener('change', (event) => { selectedTestMap = (event.currentTarget as HTMLSelectElement).value; });
      main.querySelector<HTMLSelectElement>('#pvp-friend-select')?.addEventListener('change', (event) => { selectedFriend = (event.currentTarget as HTMLSelectElement).value; });
      if (queue === 'arena' && !friendOptions && !friendsLoading && !friendsError) {
        friendsLoading = true;
        void socialApi.friends().then(({ friends }) => {
          friendOptions = friends.filter((friend) => friend.state === 'accepted').map((friend) => ({ userId: friend.userId, name: friend.nickname || friend.username }));
          if (root.isConnected) render();
        }).catch(() => { friendsError = true; if (root.isConnected) render(); }).finally(() => { friendsLoading = false; });
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
      body.append(el('section', { class: 'ftd-pvp__result' }, [el('h2', { text: match.resultReason === 'test-ended' ? 'TEST ENDED' : won ? 'WALL HELD' : match.winnerId ? 'WALL BREACHED' : 'DRAW' }), ...(match.testMatch ? [label('ADMIN TEST · No FR, rewards, achievements, or badges granted.', 'ftd-pvp__intro')] : []), label(`Final walls · You ${own.wallHealth} — ${opponent.wallHealth} opponent`), label(`Score · You ${own.score} — ${opponent.score} opponent`), ...(queue === 'ranked' && !match.testMatch ? [label(`FR change · ${own.ratingDelta === undefined ? 'Tie' : own.ratingDelta > 0 ? '+' : ''}${own.ratingDelta ?? 0} FR`)] : []), GameButton({ label: 'Back to queue', tone: 'primary', onClick: () => void send(`/match/${match.id}/ack`) })]));
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
    const attackers = el('div', { class: 'ftd-pvp__attackers' }, [
      label(own.attackers.length ? `${own.attackers.length} incoming fruit-zombies · drag across the fruit on your path to slice · combo ×${match.yourCombo}` : 'No incoming fruit-zombies. Watch the lane.', 'ftd-pvp__intro'),
    ]);
    grid.addEventListener('pointerdown', (event) => {
      if (busy || activeStroke || match.status !== 'active') return;
      const rect = grid.getBoundingClientRect();
      activeStroke = { pointerId: event.pointerId, x: (event.clientX - rect.left) / rect.width * map.width, y: (event.clientY - rect.top) / rect.height * map.height,
        startX: event.clientX, startY: event.clientY, grid, matchId: match.id, sequence: match.yourSequence + 1, width: map.width, height: map.height };
    });
    body.append(el('div', { class: 'ftd-pvp__matchbar' }, [
      ...(match.testMatch ? [label('ADMIN TEST · NO RANK OR REWARDS', 'ftd-pvp__test-label')] : []),
      el('strong', { text: `${timer}s` }), label(`${own.name} · ${own.side.toUpperCase()}`), label(`Wall ${own.wallHealth} · ${own.fruts} match Fruts · Score ${own.score}`),
      label(`${opponent.name} · Wall ${opponent.wallHealth} · Score ${opponent.score}`), label(opponent.connected ? 'Opponent connected' : 'Opponent reconnecting…'),
      ...(match.testMatch ? [GameButton({ label: 'End test', variant: 'outline', onClick: () => void send(`/match/${match.id}/end-test`) })] : []),
    ]));
    const battlefield = el('div', { class: 'ftd-pvp__battlefield' }, [label(`${opponent.side === 'blue' ? 'BLUE' : 'RED'} ENEMY GATE · ${opponent.name}`, 'ftd-pvp__gate ftd-pvp__gate--enemy'), grid, label(`${own.side === 'blue' ? 'BLUE' : 'RED'} WALL + MAIN TOWER · ${own.wallHealth} HP`, 'ftd-pvp__gate ftd-pvp__gate--own')]);
    const rivalFruit = new Map<number, number>();
    for (const fruit of opponent.attackers) { const cell = map.pathCells[Math.min(map.pathCells.length - 1, Math.floor(fruit.progress))]!; rivalFruit.set(cell, (rivalFruit.get(cell) || 0) + 1); }
    const rivalCells = el('div', { class: 'ftd-pvp__cells ftd-pvp__cells--spectator', style: `--map-cols:${map.width}`, 'aria-label': 'Opponent battlefield' });
    for (let i = 0; i < map.width * map.height; i++) {
      const tower = opponent.towers.find((item) => item.cell === i);
      const path = routeCells.has(i);
      rivalCells.append(el('div', { class: `ftd-pvp__cell${path ? ' is-path' : ''}${tower ? ' is-built' : ''}${rivalFruit.has(i) ? ' has-fruit' : ''}`, title: tower?.type || (rivalFruit.has(i) ? `${rivalFruit.get(i)} incoming fruit` : ''), text: tower ? tower.type.slice(0, 3).toUpperCase() : rivalFruit.has(i) ? `●${rivalFruit.get(i)}` : path ? '·' : '' }));
    }
    const rivalBattlefield = el('div', { class: 'ftd-pvp__battlefield ftd-pvp__battlefield--rival' }, [label(`YOUR ATTACK GATE · ${own.name}`, 'ftd-pvp__gate ftd-pvp__gate--enemy'), rivalCells, label(`${opponent.side.toUpperCase()} WALL · ${opponent.wallHealth} HP`, 'ftd-pvp__gate ftd-pvp__gate--own')]);
    const boards = el('div', { class: 'ftd-pvp__boards' }, [el('section', {}, [label(`YOUR DEFENCE · ${own.side.toUpperCase()}`, 'ftd-pvp__section-title'), battlefield]), el('section', {}, [label(`OPPONENT LIVE · ${opponent.side.toUpperCase()}`, 'ftd-pvp__section-title'), rivalBattlefield])]);
    const controls = el('section', { class: 'ftd-pvp__controls' }, [label(`DEFEND ${map.name.toUpperCase()}`, 'ftd-pvp__section-title'), boards, el('div', { class: 'ftd-pvp__tower-picker' }, Object.entries(status.config?.towers || {}).map(([id, info]) => GameButton({ label: `${id} · ${info.cost} Fruts`, variant: id === selectedTower ? 'outline' : 'ghost', onClick: () => { selectedTower = id; render(); } }))), label('SEND A FRUIT-ZOMBIE', 'ftd-pvp__section-title'), el('div', { class: 'ftd-pvp__tower-picker' }, attacks.map(([id, info]) => GameButton({ label: `${id} · ${info.cost} Fruts`, tone: 'primary', onClick: () => void send(`/match/${match.id}/command`, { sequence: match.yourSequence + 1, command: { type: 'send', enemy: id } }) }))), label(`YOUR INCOMING LANE · Combo ×${match.yourCombo}`, 'ftd-pvp__section-title'), attackers]);
    body.append(controls);
  };
  const pointOnGrid = (stroke: NonNullable<typeof activeStroke>, clientX: number, clientY: number) => {
    const rect = stroke.grid.getBoundingClientRect();
    return { x: Math.max(0, Math.min(stroke.width, (clientX - rect.left) / rect.width * stroke.width)), y: Math.max(0, Math.min(stroke.height, (clientY - rect.top) / rect.height * stroke.height)) };
  };
  const onPointerMove = (event: PointerEvent) => {
    const stroke = activeStroke;
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    const line = stroke.grid.querySelector<HTMLElement>('.ftd-pvp__swipe-line') || el('i', { class: 'ftd-pvp__swipe-line' });
    if (!line.isConnected) stroke.grid.append(line);
    const dx = event.clientX - stroke.startX; const dy = event.clientY - stroke.startY;
    line.style.left = `${stroke.startX - stroke.grid.getBoundingClientRect().left}px`;
    line.style.top = `${stroke.startY - stroke.grid.getBoundingClientRect().top}px`;
    line.style.width = `${Math.hypot(dx, dy)}px`;
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  };
  const finishStroke = (event: PointerEvent) => {
    const stroke = activeStroke;
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    activeStroke = null;
    stroke.grid.querySelector('.ftd-pvp__swipe-line')?.remove();
    if (event.type === 'pointercancel') { render(); return; }
    const to = pointOnGrid(stroke, event.clientX, event.clientY);
    if (Math.hypot(to.x - stroke.x, to.y - stroke.y) >= 0.5) {
      void send(`/match/${stroke.matchId}/command`, { sequence: stroke.sequence, command: { type: 'slash', from: { x: stroke.x, y: stroke.y }, to } });
    } else render();
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', finishStroke);
  window.addEventListener('pointercancel', finishStroke);
  void refresh();
  const timer = globalThis.setInterval(() => { if (!root.isConnected) { globalThis.clearInterval(timer); window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', finishStroke); window.removeEventListener('pointercancel', finishStroke); const client = realtimeClients.get(root); if (client) void client.close(); realtimeClients.delete(root); return; } void refresh(); }, 900) as unknown as number;
  timers.set(root, timer);
}
