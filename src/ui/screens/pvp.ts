import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { getAuthToken } from '../../services/auth';
import type { PvpConfig, PvpQueue } from '../../game/pvp';
import type { Realtime as AblyRealtime } from 'ably';
import { socialApi } from '../../services/social';
import { PvpBattlefield } from './pvpBattlefield';
import { turretDef, type TurretKind } from '../../game/turrets';

type MapView = { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells: number[] };
type MatchView = { id: string; queue: PvpQueue; status: string; testMatch: boolean; remainingMs: number; revision: number; map: MapView | null; mapPool: MapView[]; yourVetoTurn: boolean; vetoesRemaining: number; players: Array<{ userId: string; name: string; side: string; fruts: number; wallHealth: number; score: number; towers: Array<{ id: string; type: string; cell: number }>; attackers: Array<{ id: string; type: string; progress: number }>; connected: boolean; ratingDelta?: number }>; yourSide: string; winnerId: string | null; resultReason: string | null; yourSequence: number; yourCombo: number };
type PvpStatus = { success: boolean; error?: string; canStartBotMatch?: boolean; rating?: { points: number; tier: string; season: string; matches: number; wins: number; ties: number; losses: number }; match?: MatchView | null; queued?: PvpQueue | null; challenge?: { challengeId: string; fromId: string; fromName: string } | null; config?: Pick<PvpConfig, 'durationSeconds' | 'reconnectGraceSeconds' | 'towers' | 'attacks' | 'maps'> };
const timers = new WeakMap<HTMLElement, number>();
const realtimeClients = new WeakMap<HTMLElement, AblyRealtime>();
const cleanups = new WeakMap<HTMLElement, () => void>();
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
  cleanups.get(root)?.();
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
  let battlefield: PvpBattlefield | null = null;
  let battlefieldId = '';
  let busy = false;
  let refreshing = false;
  let attachingRealtime = false;
  const heading = el('header', { class: 'ftd-pvp__heading' }, [
    el('div', {}, [label(queue === 'ranked' ? 'FR POINT LADDER · PUBLIC QUEUE' : 'UNRANKED · FRIENDS OR QUICK MATCH', 'ftd-pvp__eyebrow'), el('h1', { text: queue === 'ranked' ? 'RANKED SIEGE' : 'ARENA' }), label('Three minutes. Build your line. Send fruit-zombies to break the other wall.', 'ftd-pvp__intro')]),
    el('div', { class: 'ftd-pvp__rating', 'data-pvp-rating': '' }, [label('RATING', 'ftd-pvp__eyebrow'), el('strong', { text: 'Loading…' })]),
  ]);
  main.appendChild(heading);
  const body = el('div', { class: 'ftd-pvp__body', 'aria-live': 'polite' }); main.appendChild(body);

  const refresh = async () => {
    if (refreshing || !root.isConnected) return;
    refreshing = true;
    try { status = await request('/status'); if (!battlefield?.interacting) render(); }
    catch (error) { body.replaceChildren(label(error instanceof Error ? error.message : 'Could not connect.')); }
    finally { refreshing = false; }
  };
  const attachRealtime = async (match: MatchView) => {
    if (attachingRealtime || realtimeClients.has(root) || !getAuthToken()) return;
    attachingRealtime = true;
    try {
      const { Realtime } = await import('ably');
      if (!root.isConnected) return;
      const client = new Realtime({ authCallback: async (_params, callback) => {
        try { const response = await request(`/match/${match.id}/token`, { method: 'POST' }); callback(null, response.token); }
        catch (error) { callback({ name: 'PvpTokenError', message: error instanceof Error ? error.message : 'PvP authentication failed', code: 500, statusCode: 500 }, null); }
      } });
      realtimeClients.set(root, client);
      const channel = client.channels.get(`fruittd-pvp-${match.id}`);
      channel.subscribe('match.snapshot', (message) => {
        const revision = Number((message.data as { revision?: number } | undefined)?.revision ?? -1);
        const current = status.match;
        if (current?.id !== match.id || revision <= current.revision) return;
        const data = message.data as any;
        const own = data.players?.find((player: any) => player.side === current.yourSide);
        if (!own) return;
        status.match = { ...current, revision, status: data.status, remainingMs: Math.max(0, data.endsAt - Date.now()), players: data.players, map: data.map, winnerId: data.winnerId, resultReason: data.resultReason, yourSequence: own.sequence, yourCombo: own.currentCombo, mapPool: data.mapPool || current.mapPool, yourVetoTurn: data.vetoTurn === own.userId, vetoesRemaining: Math.max(0, (data.mapPool?.length || 2) - 2) };
        if (!battlefield?.interacting) render();
      });
    } catch (error) { console.warn('PvP realtime subscription unavailable; using match snapshots.', error); }
    finally { attachingRealtime = false; }
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
    if (match?.status !== 'active') { battlefield?.dispose(); battlefield = null; battlefieldId = ''; }
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
    body.append(el('div', { class: 'ftd-pvp__matchbar' }, [
      ...(match.testMatch ? [label('ADMIN TEST', 'ftd-pvp__test-label')] : []),
      el('strong', { text: `${timer}s` }), label(`${own.name} · ${own.side.toUpperCase()} · Wall ${own.wallHealth}`),
      label(`${own.fruts} FRUTS · Score ${own.score}`), label(`${opponent.name} · Wall ${opponent.wallHealth}`),
      label(opponent.connected ? 'Opponent connected' : 'Opponent reconnecting…'),
      ...(match.testMatch ? [GameButton({ label: 'End test', variant: 'outline', onClick: () => void send(`/match/${match.id}/end-test`) })] : []),
    ]));
    const sceneConfig = { towers: status.config?.towers || {}, attacks: status.config?.attacks || {} };
    if (!battlefield || battlefieldId !== match.id) {
      battlefield?.dispose();
      try {
        battlefield = new PvpBattlefield(match, sceneConfig, (command) => {
          const current = status.match;
          if (current?.status === 'active') void send(`/match/${current.id}/command`, { sequence: current.yourSequence + 1, command });
        });
        battlefieldId = match.id;
      } catch (error) {
        body.append(label(error instanceof Error ? `Battlefield could not start: ${error.message}` : 'Battlefield could not start.', 'ftd-pvp__error'));
        return;
      }
    }
    battlefield.update(match, sceneConfig);
    battlefield.element.dataset.tower = selectedTower;
    const towerName = (id: string) => turretDef(id as TurretKind)?.name || id;
    const controls = el('aside', { class: 'ftd-pvp__siege-controls' }, [
      label(map.name.toUpperCase(), 'ftd-pvp__section-title'),
      label('BUILD YOUR DEFENCE', 'ftd-pvp__section-title'),
      el('div', { class: 'ftd-pvp__tower-picker' }, Object.entries(status.config?.towers || {}).map(([id, info]) => GameButton({ label: `${towerName(id)} · ${info.cost} F`, variant: id === selectedTower ? 'outline' : 'ghost', disabled: own.fruts < info.cost, onClick: () => { selectedTower = id; render(); } }))),
      label('SEND FRUIT-ZOMBIES', 'ftd-pvp__section-title'),
      el('div', { class: 'ftd-pvp__tower-picker' }, Object.entries(status.config?.attacks || {}).map(([id, info]) => GameButton({ label: `${id[0]!.toUpperCase() + id.slice(1)} · ${info.cost} F`, tone: 'primary', disabled: own.fruts < info.cost, onClick: () => void send(`/match/${match.id}/command`, { sequence: match.yourSequence + 1, command: { type: 'send', enemy: id } }) }))),
      label(`${own.attackers.length} incoming · Combo ×${match.yourCombo}`, 'ftd-pvp__intro'),
      label('Your base is nearest. Place towers in your half. Swipe through incoming fruit to defend. Send attacks from the controls above.', 'ftd-pvp__intro'),
    ]);
    body.append(el('div', { class: 'ftd-pvp__siege-layout' }, [battlefield.element, controls]));
  };
  void refresh();
  const timer = globalThis.setInterval(() => { if (!root.isConnected) { globalThis.clearInterval(timer); battlefield?.dispose(); const client = realtimeClients.get(root); if (client) void client.close(); realtimeClients.delete(root); return; } void refresh(); }, 900) as unknown as number;
  timers.set(root, timer);
  cleanups.set(root, () => { globalThis.clearInterval(timer); battlefield?.dispose(); const client = realtimeClients.get(root); if (client) void client.close(); realtimeClients.delete(root); });
}
