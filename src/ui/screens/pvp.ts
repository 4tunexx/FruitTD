import { acceptArenaRating, ARENA_RANK_COLORS, type ArenaRating } from '../../services/pvpRating';
import { lucideIcon } from '../lucideIcon';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { getAuthToken } from '../../services/auth';
import { PVP_MAX_TOWER_LEVEL, pvpTowerLevel, pvpUpgradeCost, pvpSellRefund, pvpTowerStats, pvpTowerRole, pvpMainUpgradeCost, pvpReleaseCost, PVP_CAPTURE_CAPACITY, type PvpConfig, type PvpQueue } from '../../game/pvp';
import type { Realtime as AblyRealtime } from 'ably';
import { socialApi } from '../../services/social';
import { PvpBattlefield } from './pvpBattlefield';
import { turretDef, type TurretKind } from '../../game/turrets';
import { LoadingIndicator } from '../components/loading';

type MapView = { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells: number[] };
type MatchView = { id: string; queue: PvpQueue; status: string; testMatch: boolean; remainingMs: number; revision: number; map: MapView | null; mapPool: MapView[]; yourVetoTurn: boolean; vetoesRemaining: number; players: Array<{ userId: string; name: string; avatar?: string; side: string; fruts: number; wallHealth: number; mainLevel?: number; wallMaxHealth?: number; captured?: Array<{ id: string; type: string }>; hero?: string; wallSkin?: string; rallyUntil?: number; rallyReadyAt?: number; score: number; towers: Array<{ id: string; type: string; cell: number; level?: number }>; attackers: Array<{ id: string; type: string; progress: number }>; connected: boolean; ratingDelta?: number }>; yourSide: string; winnerId: string | null; resultReason: string | null; yourSequence: number; yourCombo: number };
type PvpStatus = { success: boolean; error?: string; canStartBotMatch?: boolean; rating?: ArenaRating; match?: MatchView | null; queued?: PvpQueue | null; challenge?: { challengeId: string; fromId: string; fromName: string } | null; config?: Pick<PvpConfig, 'wallHealth' | 'durationSeconds' | 'reconnectGraceSeconds' | 'towers' | 'attacks' | 'maps' | 'incomePerSecond'> };
const timers = new WeakMap<HTMLElement, number>();
const realtimeClients = new WeakMap<HTMLElement, AblyRealtime>();
const cleanups = new WeakMap<HTMLElement, () => void>();
const pvpApiBase = (import.meta.env?.VITE_PVP_API_URL || '/api/pvp').replace(/\/$/, '');

async function requestPvp(path: string, init: RequestInit = {}): Promise<any> {
  const token = getAuthToken();
  const response = await fetch(`${pvpApiBase}${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'PvP service is unavailable.');
  return data;
}
function label(text: string, cls = ''): HTMLElement { return el('p', { class: cls, text }); }
function playerPortrait(player: Pick<NonNullable<PvpStatus['match']>['players'][number], 'name' | 'avatar' | 'side'>, className = ''): HTMLElement {
  const portrait = el('span', { class: `ftd-vs-portrait is-${player.side === 'red' ? 'red' : 'blue'} ${className}`, 'aria-label': `${player.name} avatar` });
  if (player.avatar) portrait.appendChild(el('img', { src: player.avatar, alt: `${player.name} avatar`, referrerpolicy: 'no-referrer' }));
  else portrait.appendChild(el('strong', { text: player.name.trim().charAt(0).toUpperCase() || '?' }));
  return portrait;
}

type BattlefieldView = Pick<PvpBattlefield, 'element' | 'interacting' | 'update' | 'selectCell' | 'dispose'> & { setAttackView?: (attacking: boolean) => void };
export interface PvpHubOptions {
  /** Dependency injection for isolated local previews and UI tests. */
  request?: typeof requestPvp;
  isAuthenticated?: () => boolean;
  createBattlefield?: (match: MatchView, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number }, command: (command: import('../../game/pvp').PvpCommand) => void, select: (cell: number) => void) => BattlefieldView;
  realtime?: boolean;
  loadRealtime?: () => Promise<Pick<typeof import('ably'), 'Realtime'>>;
  polling?: boolean;
}
export function disposePvpHub(root: HTMLElement): void { cleanups.get(root)?.(); cleanups.delete(root); }

export function renderPvpHub(root: HTMLElement, initialQueue: PvpQueue, options: PvpHubOptions = {}): void {
  const request = options.request || requestPvp;
  let queue = initialQueue;
  cleanups.get(root)?.();
  const prior = timers.get(root); if (prior) globalThis.clearInterval(prior);
  root.replaceChildren();
  const main = el('section', { class: `ftd-pvp ftd-pvp--${queue}` }); root.appendChild(main);
  let status: PvpStatus = { success: true };
  let selectedTower = 'guillotine';
  let selectedCell: number | null = null;
  let dockTab: 'build' | 'attack' | 'capture' = 'build';
  let dockExpanded = false;
  let surrenderConfirm = false;
  let actionError = '';
  let actionFeedback = '';
  let feedbackUntil = 0;
  let expandedArsenal = false;
  let hub = root.closest<HTMLElement>('.ftd-hub');
  let selectedTestMap = '';
  let selectedFriend = '';
  let friendOptions: Array<{ userId: string; name: string }> | null = null;
  let friendsLoading = false;
  let friendsError = false;
  let battlefield: BattlefieldView | null = null;
  let battlefieldId = '';
  let busy = false;
  let refreshing = false;
  let attachingRealtime = false;
  let disposed = false;
  let realtimeMatchId = '';
  let clashShownMatchId = '';
  const heading = el('header', { class: 'ftd-pvp__heading' }, [
    el('div', {}, [label('TOWER SIEGE · NORMAL OR RANKED', 'ftd-pvp__eyebrow'), el('h1', { text: 'ARENA' }), label('Three minutes. Build, upgrade, capture and counterattack. No slicing. Destroy the rival wall; at timeout, the higher wall percentage wins.', 'ftd-pvp__intro')]),
    el('div', { class: 'ftd-pvp__rating', 'data-pvp-rating': '' }, [label('RATING', 'ftd-pvp__eyebrow'), el('strong', { text: 'Loading…' })]),
  ]);
  main.appendChild(heading);
  const body = el('div', { class: 'ftd-pvp__body' }); main.appendChild(body);

  const refresh = async () => {
    if (refreshing || !main.isConnected) return;
    refreshing = true;
    try { const incoming = await request('/status'); if (!main.isConnected) return; if (!status.match || !incoming.match || status.match.id !== incoming.match.id || incoming.match.revision >= status.match.revision) status = incoming; if (status.rating) acceptArenaRating(status.rating); if (!battlefield?.interacting) render(); }
    catch (error) { actionError = error instanceof Error ? error.message : 'Could not connect.'; if (!battlefield?.interacting) render(); }
    finally { refreshing = false; }
  };
  const attachRealtime = async (match: MatchView) => {
    if (options.realtime === false || disposed) return;
    if (attachingRealtime || realtimeClients.has(root) || !getAuthToken()) return;
    attachingRealtime = true;
    let candidate: AblyRealtime | null = null;
    try {
      const { Realtime } = await (options.loadRealtime?.() ?? import('ably'));
      if (disposed || !main.isConnected || status.match?.id !== match.id || status.match.status !== 'active') return;
      candidate = new Realtime({ authCallback: async (_params, callback) => {
        try {
          if (disposed || status.match?.id !== match.id || status.match.status !== 'active') throw new Error('Match view closed.');
          const response = await request(`/match/${match.id}/token`, { method: 'POST' });
          if (disposed || status.match?.id !== match.id || status.match.status !== 'active') throw new Error('Match view closed.');
          callback(null, response.token);
        }
        catch (error) { callback({ name: 'PvpTokenError', message: error instanceof Error ? error.message : 'PvP authentication failed', code: 500, statusCode: 500 }, null); }
      } });
      const client = candidate;
      if (disposed || !main.isConnected || status.match?.id !== match.id) { client.close(); return; }
      realtimeClients.set(root, client);
      realtimeMatchId = match.id;
      const channel = client.channels.get(`fruittd-pvp-${match.id}`);
      await channel.subscribe('match.snapshot', (message) => {
        const revision = Number((message.data as { revision?: number } | undefined)?.revision ?? -1);
        const current = status.match;
        if (current?.id !== match.id || revision <= current.revision) return;
        const data = message.data as any;
        const own = data.players?.find((player: any) => player.side === current.yourSide);
        if (!own) return;
        status.match = { ...current, revision, status: data.status, remainingMs: Math.max(0, data.endsAt - Date.now()), players: data.players, map: data.map, winnerId: data.winnerId, resultReason: data.resultReason, yourSequence: own.sequence, yourCombo: own.currentCombo, mapPool: data.mapPool || current.mapPool, yourVetoTurn: data.vetoTurn === own.userId, vetoesRemaining: Math.max(0, (data.mapPool?.length || 2) - 2) };
        if (!battlefield?.interacting) render();
      });
    } catch (error) {
      if (candidate && realtimeClients.get(root) === candidate) {
        candidate.close(); realtimeClients.delete(root); realtimeMatchId = '';
      }
      if (!disposed && main.isConnected && status.match?.id === match.id && status.match.status === 'active') {
        console.warn('PvP realtime subscription unavailable; using match snapshots.', error);
      }
    }
    finally {
      attachingRealtime = false;
      const current = status.match;
      if (!disposed && current?.status === 'active' && current.id !== match.id) void attachRealtime(current);
    }
  };
  const send = async (path: string, payload?: unknown, method = 'POST') => {
    if (busy) return;
    busy = true;
    try {
      const response = await request(path, { method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
      actionError = '';
      const command = (payload as { command?: import('../../game/pvp').PvpCommand } | undefined)?.command;
      if (command) {
        actionFeedback = command.type === 'send' ? 'BLUE SQUAD SENT → RED BASE' : command.type === 'build' ? 'DEFENCE BUILT · AUTO FIRE READY' : command.type === 'upgrade' ? 'TOWER UPGRADED' : command.type === 'rally' ? 'RALLY! +25% DAMAGE FOR 8 SECONDS' : command.type === 'release' ? 'CAPTURED FRUIT SENT → RED BASE' : command.type === 'upgrade-main' ? 'BASE UPGRADED · STRONGER WALL' : command.type === 'sell' ? 'TOWER SOLD · FRUTS REFUNDED' : '';
        feedbackUntil = Date.now() + 2200;
      }
      if (response.match) { status.match = response.match; if (!battlefield?.interacting) render(); }
      await refresh();
    }
    catch (error) { actionError = error instanceof Error ? error.message : 'Action failed.'; render(); }
    finally { busy = false; if (main.isConnected && !battlefield?.interacting) render(); }
  };
  const render = () => {
    const active = document.activeElement as HTMLElement | null;
    const focused = active?.tagName === 'BUTTON' && active.closest('.ftd-pvp') === main
      ? { key:active.getAttribute('data-testid'), label:active.textContent } : null;
    renderContent();
    const dialog = body.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog && !active?.closest('[role="dialog"]')) {
      dialog.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll:true });
      return;
    }
    if (focused) {
      const replacement = [...body.querySelectorAll<HTMLButtonElement>('button')].find(button => focused.key ? button.getAttribute('data-testid') === focused.key : button.textContent === focused.label);
      replacement?.focus({ preventScroll:true });
    }
  };
  const renderContent = () => {
    const badge = main.querySelector<HTMLElement>('[data-pvp-rating] strong');
    if (badge && status.rating) { badge.textContent = `${status.rating.tier} · ${status.rating.points.toLocaleString()} FR`; badge.style.color = ARENA_RANK_COLORS[status.rating.tier] || '#aab9aa'; }
    body.replaceChildren();
    const match = status.match;
    const inBattle = match?.status === 'active' || match?.status === 'complete';
    hub ??= root.closest<HTMLElement>('.ftd-hub');
    if (realtimeMatchId && (realtimeMatchId !== match?.id || match?.status !== 'active')) {
      const oldClient = realtimeClients.get(root);
      if (oldClient) oldClient.close();
      realtimeClients.delete(root);
      realtimeMatchId = '';
    }
    main.classList.toggle('is-battle', inBattle); hub?.classList.toggle('is-pvp-battle', inBattle);
    if (actionError) { const error = label(actionError, 'ftd-pvp__error'); error.setAttribute('role', 'alert'); error.addEventListener('click', () => { actionError = ''; render(); }); body.append(error); }
    if (!inBattle) { battlefield?.dispose(); battlefield = null; battlefieldId = ''; }
    const towerIds = Object.keys(status.config?.towers || {});
    if (!towerIds.includes(selectedTower) && towerIds.length) selectedTower = towerIds[0]!;
    if (!(options.isAuthenticated?.() ?? Boolean(getAuthToken()))) { body.append(label('Sign in to play online Arena or Ranked.', 'ftd-pvp__notice')); return; }
    if (!match) {
      const oldClient = realtimeClients.get(root); if (oldClient) { oldClient.close(); realtimeClients.delete(root); realtimeMatchId = ''; }
      if (!status.config?.maps.some((map) => map.id === selectedTestMap)) selectedTestMap = status.config?.maps[0]?.id || '';
      body.append(el('div', { class: 'ftd-duel-tabs', 'aria-label': 'Arena queue' }, (['arena', 'ranked'] as const).map(choice => {
        const button = el('button', { type: 'button', class: choice === queue ? 'is-active' : '', 'data-testid': `arena-queue-${choice}`, disabled: busy || Boolean(status.queued), text: choice === 'arena' ? 'NORMAL' : 'RANKED' });
        button.addEventListener('click', () => { queue = choice; render(); }); return button;
      })));
      body.append(el('div', { class: 'ftd-pvp__queue' }, [
        label(status.queued === queue ? `Searching for an opponent · ${queue.toUpperCase()}` : 'Find an opponent', 'ftd-pvp__section-title'),
        el('div', { class: 'ftd-pvp__howto' }, [
          el('div', {}, [el('b', { text: '01 / BUILD' }), el('p', { text: 'Pick a tower and tap an empty hex in your highlighted territory. Tap a placed tower to upgrade or sell.' })]),
          el('div', {}, [el('b', { text: '02 / ATTACK' }), el('p', { text: 'Send fruit squads through the opponent lane. Incoming squads approach your wall.' })]),
          el('div', {}, [el('b', { text: '03 / BREAK THE BASE' }), el('p', { text: 'Pressure a weak defence or save for a heavy push. Destroy the opponent wall or finish with more wall health at time.' })]),
        ]),
        el('details', { class: 'ftd-pvp__rules' }, [el('summary', { text: 'Strategy & advanced rules' }), label(`Earn ${status.config?.incomePerSecond ?? 6} Fruts per second plus kill bounties. Match Fruts are separate from shop coins. Rally: +25% damage for 8 seconds; 35-second cooldown. Upgrade your main tower for damage and +25% wall health. Catchers store three weakened enemies; release them as reinforcements at half per-unit cost. At timeout, the higher wall percentage wins.`, 'ftd-pvp__intro')]),
        label(queue === 'ranked' ? 'Win or lose FR based on opponent rating. Nearby ranks only. No slicing bonuses.' : 'Normal results do not change rank. Both queues use equal stats and nearby ratings. Your equipped hero and wall are cosmetic; every hero has the same Rally power.', 'ftd-pvp__intro'),
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
          if (main.isConnected) render();
        }).catch(() => { friendsError = true; if (main.isConnected) render(); }).finally(() => { friendsLoading = false; });
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
      const identityCard = (player: typeof own, rival: boolean) => el('div', { class: `ftd-versus-card ${rival ? 'is-rival' : 'is-own'} is-${player.side}` }, [playerPortrait(player), el('div', {}, [el('small', { text: `${rival ? 'CHALLENGER' : 'YOUR FIGHTER'} · ${player.side.toUpperCase()}` }), el('strong', { text: player.name })])]);
      body.append(el('section', { class: 'ftd-pvp__draft' }, [el('div', { class: 'ftd-pvp__draft-head' }, [el('p', { class: 'ftd-pvp__eyebrow', text: match.queue === 'ranked' ? 'RANKED SHOWDOWN' : 'ARENA SHOWDOWN' }), el('h2', { text: 'CHOOSE THE BATTLEFIELD' }), label(`${match.vetoesRemaining} route bans left · then the arena is chosen`), label(match.yourVetoTurn ? 'Your turn: ban one route' : 'Waiting for the other player to ban a route')]), el('div', { class: 'ftd-versus-lineup' }, [identityCard(own, false), el('strong', { class: 'ftd-versus-mark', text: 'VS' }), identityCard(opponent, true)]), el('div', { class: 'ftd-pvp__map-grid' }, drafts), GameButton({ label: 'Cancel draft · no rank change', variant: 'outline', onClick: () => void send(`/match/${match.id}/cancel-draft`) })]));
      return;
    }
    if (match.status === 'complete') {
      const won = match.winnerId === own.userId;
      if (battlefield) {
        battlefield.update(match, { wallHealth:status.config?.wallHealth || 1000, towers:status.config?.towers || {}, attacks:status.config?.attacks || {} });
        body.append(battlefield.element);
      }
      const wallResult = (player: typeof own) => Math.round(player.wallHealth / (player.wallMaxHealth ?? status.config?.wallHealth ?? 1000) * 100);
      const title = match.resultReason === 'draft-cancelled' ? 'DRAFT CANCELLED' : match.resultReason === 'test-ended' ? 'TEST ENDED' : won ? 'VICTORY' : match.winnerId ? 'DEFEAT' : 'DRAW';
      const faceoff = (player: typeof own, winner: boolean, rival: boolean) => el('div', { class: `ftd-result-fighter ${rival ? 'is-rival' : 'is-own'} is-${player.side}${winner ? ' is-winner' : ''}` }, [playerPortrait(player), el('strong', { text: player.name }), el('span', { text: `${player.side.toUpperCase()} SIDE` }), el('small', { text: `${wallResult(player)}% WALL` })]);
      const animateResult = clashShownMatchId !== `result:${match.id}`;
      if (animateResult) clashShownMatchId = `result:${match.id}`;
      body.append(el('div', { class:'ftd-duel-result-overlay' }, [el('section', { class: `ftd-pvp__result ${won ? 'is-victory' : match.winnerId ? 'is-defeat' : ''}${animateResult ? ' is-entering' : ''}`, role:'dialog', 'aria-modal':'true', 'aria-label':'Match result' }, [
        label(match.queue === 'ranked' ? 'RANKED MATCH · FINAL REPORT' : 'ARENA MATCH · FINAL REPORT', 'ftd-result-kicker'),
        el('h2', { text: title }),
        el('div', { class:'ftd-result-faceoff' }, [faceoff(own, won, false), el('strong', { class:'ftd-result-vs', text:'VS' }), faceoff(opponent, match.winnerId === opponent.userId, true)]),
        label(won ? `${own.name} held the orchard wall.` : match.winnerId ? `${opponent.name} broke through your defence.` : 'Both walls held. The match is a draw.', 'ftd-result-summary'),
        el('div', { class:'ftd-result-stats' }, [el('span', {}, [el('small', { text:`${own.name} · ${own.side.toUpperCase()}` }), el('b', { text:`${wallResult(own)}%` })]), el('span', {}, [el('small', { text:`${opponent.name} · ${opponent.side.toUpperCase()}` }), el('b', { text:`${wallResult(opponent)}%` })])]),
        ...(match.testMatch ? [label('PRACTICE · No FR, rewards, achievements, or badges granted.', 'ftd-pvp__intro')] : []),
        ...(match.queue === 'ranked' && !match.testMatch && match.resultReason !== 'draft-cancelled' ? [label(own.ratingDelta === undefined ? 'Settling your Ranked rating…' : `RANK POINTS  ${own.ratingDelta > 0 ? '+' : ''}${own.ratingDelta} FR`, 'ftd-result-rating')] : []),
        GameButton({ label: 'Return to Arena', tone: 'primary', onClick: () => void send(`/match/${match.id}/ack`) })
      ])]));
      return;
    }
    const timer = Math.ceil(match.remainingMs / 1000);
    const maxHealth = status.config?.wallHealth || 1000;
    const playerCard = (player: typeof own, rival: boolean) => el('div', { class: `ftd-duel-player ${rival ? 'is-rival' : 'is-own'} is-${player.side === 'red' ? 'red' : 'blue'}` }, [
      playerPortrait(player, 'ftd-duel-player__crest'),
      el('div', {}, [el('strong', { text: player.name }), el('span', { class:'ftd-duel-player__side', text:`${rival?'OPPONENT':'YOU'} · ${player.side.toUpperCase()} SIDE` }), el('span', { text: `${player.wallHealth} / ${player.wallMaxHealth ?? maxHealth} · Lv ${pvpTowerLevel(player.mainLevel)}` }),
        el('div', { class: 'ftd-duel-hp', role: 'progressbar', 'aria-label': `${player.name} wall health`, 'aria-valuenow': player.wallHealth, 'aria-valuemax': player.wallMaxHealth ?? maxHealth }, [el('i', { style: `width:${Math.max(0, Math.min(100, player.wallHealth / (player.wallMaxHealth ?? maxHealth) * 100))}%` })]),
      ]),
    ]);
    body.append(el('header', { class: 'ftd-duel-hud' }, [playerCard(own, false),
      el('div', { class: 'ftd-duel-clock' }, [el('small', { text: match.testMatch ? 'PRACTICE' : match.queue === 'ranked' ? 'RANKED' : 'ARENA' }), el('strong', { text: `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}` }),
        el('button', { type:'button', class:'ftd-duel-leave', title:'Leave match', 'aria-label':'Leave match', 'data-testid':'arena-leave' }, [lucideIcon('LogOut','',16)]),
      ]), playerCard(opponent, true),
    ]));
    body.querySelector<HTMLButtonElement>('[data-testid="arena-leave"]')?.addEventListener('click', () => { surrenderConfirm=true;render(); });
    const objective = el('div', { class: 'ftd-duel-objective' });
    objective.innerHTML = `<b>DEFEND ${own.side.toUpperCase()}</b> · Stop incoming fruit &nbsp; | &nbsp; <em>ATTACK ${opponent.side.toUpperCase()}</em> · Send fruit squads`;
    body.append(objective);
    if (actionFeedback && Date.now() < feedbackUntil) body.append(el('div', { class: 'ftd-duel-feedback', role: 'status', text: actionFeedback }));
    const sceneConfig = { wallHealth: maxHealth, towers: status.config?.towers || {}, attacks: status.config?.attacks || {} };
    const issue = (command: import('../../game/pvp').PvpCommand) => {
      const current = status.match;
      if (current?.status === 'active') void send(`/match/${current.id}/command`, { sequence: current.yourSequence + 1, command });
    };
    if (!battlefield || battlefieldId !== match.id) {
      battlefield?.dispose(); selectedCell = null;
      try {
        const create = options.createBattlefield || ((view, config, command, select) => new PvpBattlefield(view, config, command, select));
        battlefield = create(match, sceneConfig, issue, (cell) => {
          const current = status.match; const player = current?.players.find(item => item.side === current.yourSide);
          if (!current || !player) return;
          const tower = player.towers.find(item => item.cell === cell);
          if (tower) { selectedCell = cell; render(); }
          else {
            selectedCell = cell;
            const cost = status.config?.towers[selectedTower]?.cost;
            if (cost !== undefined && player.fruts >= cost) issue({ type: 'build', tower: selectedTower, cell });
            else { actionError = 'More Fruts needed for this tower.'; render(); }
          }
        });
        battlefieldId = match.id;
      } catch (error) {
        body.append(label(error instanceof Error ? `Battlefield could not start: ${error.message}` : 'Battlefield could not start.', 'ftd-pvp__error'));
        return;
      }
    }
    battlefield.update(match, sceneConfig); battlefield.selectCell(selectedCell);
    body.append(battlefield.element);
    if (match.status === 'active' && clashShownMatchId !== match.id) {
      clashShownMatchId = match.id;
      const fighter = (player: typeof own, rival: boolean) => el('div', { class: `ftd-clash-fighter ${rival ? 'is-rival' : 'is-own'} is-${player.side}` }, [playerPortrait(player), el('strong', { text: player.name }), el('small', { text: `${player.side.toUpperCase()} SIDE` })]);
      body.append(el('div', { class:'ftd-vs-clash', role:'status', 'aria-live':'polite' }, [fighter(own, false), el('strong', { class:'ftd-vs-clash__mark', text:'VS' }), fighter(opponent, true), el('span', { class:'ftd-vs-clash__caption', text:match.queue === 'ranked' ? 'RANKED BATTLE · BUILD YOUR DEFENCE' : 'ARENA BATTLE · BUILD YOUR DEFENCE' })]));
    }
    const towerIcons: Record<string, string> = { guillotine: 'Swords', vortex: 'Tornado', laser: 'Zap', railgun: 'Target', sprinkler: 'Droplets', blender: 'Scissors', catcher: 'Fence' };
    const attackIcons: Record<string, string> = { normal: 'Citrus', swift: 'Cherry', armored: 'Shield', explosive: 'Bomb' };
    const towerName = (id: string) => id === 'catcher' ? 'Catcher' : turretDef(id as TurretKind)?.name || id;
    const rallyWait = Math.max(0, Math.ceil(((own.rallyReadyAt ?? 0) - Date.now()) / 1000));
    const rallyActive = (own.rallyUntil ?? 0) > Date.now();
    const selected = own.towers.find(tower => tower.cell === selectedCell);
    const selectedBase = selected ? status.config?.towers[selected.type] : null;
    const tray = el('footer', { class: 'ftd-duel-dock' });
    const mainLevel = pvpTowerLevel(own.mainLevel); const mainCost = pvpMainUpgradeCost(mainLevel);
    tray.classList.toggle('is-expanded', dockExpanded);
    const resource = el('div', { class: 'ftd-duel-resource' }, [
      el('span', { class:'ftd-duel-wallet' }, [lucideIcon('Leaf', '', 18), el('strong', { text: `${Math.floor(own.fruts)} F` })]),
      el('small', { class:'ftd-duel-statusline', text: !opponent.connected ? 'Opponent reconnecting…' : `${own.attackers.length} incoming · ${opponent.attackers.length} attacking · +${status.config?.incomePerSecond ?? 6} F/s` }),
    ]);
    const actionRail = el('div', { class:'ftd-duel-rail', 'aria-label':'Battle actions' });
    const openDock = (tab:'build'|'attack'|'capture') => { const wasOpen=dockExpanded&&dockTab===tab;dockTab=tab;dockExpanded=!wasOpen;battlefield?.setAttackView?.(tab==='attack');render(); };
    const railButton = (iconName:string, labelText:string, action:()=>void, disabled=false, testId?:string, selected=false) => {
      const button=el('button',{type:'button',class:`ftd-duel-icon-button${selected?' is-active':''}`,title:labelText,'aria-label':labelText,disabled,...(testId?{'data-testid':testId}:{})},[lucideIcon(iconName,'',19)]);
      button.addEventListener('click',action);return button;
    };
    actionRail.append(
      railButton('Swords','Build towers',()=>openDock('build'),false,'arena-tab-build',dockTab==='build'),
      railButton('Cherry','Send fruit attack',()=>openDock('attack'),false,'arena-tab-attack',dockTab==='attack'),
      railButton('Fence',`Captured fruit · ${own.captured?.length ?? 0}/${PVP_CAPTURE_CAPACITY}`,()=>openDock('capture'),false,'arena-tab-capture',dockTab==='capture'),
      railButton('Zap',rallyActive?'Rally active':rallyWait?`Rally ready in ${rallyWait}s`:'Rally · +25% damage',()=>issue({type:'rally'}),busy||rallyWait>0,'arena-rally'),
      railButton('Castle',mainLevel===PVP_MAX_TOWER_LEVEL?'Main tower · max level':`Upgrade main tower · ${mainCost} Fruts`,()=>issue({type:'upgrade-main'}),busy||mainLevel>=PVP_MAX_TOWER_LEVEL||own.fruts<mainCost,'arena-upgrade-main'),
    );
    tray.append(resource,actionRail);
    const panel = el('div',{class:`ftd-duel-panel${dockExpanded?' is-open':''}`,hidden:!dockExpanded});
    panel.append(el('p', { class: 'ftd-duel-guide', text: dockTab === 'build' ? `Choose a tower, then tap an open hex on your side. Towers fire automatically.` : dockTab === 'attack' ? `Choose a squad to send toward the ${opponent.side.toUpperCase()} wall.` : `Catch weakened fruit, then tap a captive to counterattack.` }));
    const cards = el('div', { class: 'ftd-duel-cards', 'aria-label': dockTab === 'build' ? 'Tower choices' : 'Fruit attack choices' });
    const coreTowers = ['guillotine', 'sprinkler', 'laser'];
    const allTowers = Object.entries(status.config?.towers || {});
    const visibleTowers = expandedArsenal ? allTowers : allTowers.filter(([id]) => coreTowers.includes(id));
    if (dockTab === 'build') for (const [id, info] of visibleTowers.length ? visibleTowers : allTowers) {
      const button = el('button', { type: 'button', class: `ftd-duel-card ${id === selectedTower ? 'is-selected' : ''}`, 'aria-pressed': id === selectedTower, 'data-testid': `arena-build-${id}` }, [
        lucideIcon(towerIcons[id] || 'TowerControl', 'ftd-duel-card__art', 30), el('strong', { text: towerName(id) }), el('small', { text: `${info.cost} F · ${pvpTowerRole(id)}` }),
      ]);
      button.classList.toggle('is-unaffordable', own.fruts < info.cost);
      button.addEventListener('click', () => { selectedTower = id; selectedCell = null; render(); }); cards.append(button);
    } else if (dockTab === 'attack') for (const [id, info] of Object.entries(status.config?.attacks || {})) {
      const button = el('button', { type: 'button', class: 'ftd-duel-card is-attack', disabled: busy || own.fruts < info.cost, 'data-testid': `arena-send-${id}` }, [
        lucideIcon(attackIcons[id] || 'Apple', 'ftd-duel-card__art', 30), el('strong', { text: id === 'normal' ? 'Fruit pack' : id === 'swift' ? 'Runners' : id === 'armored' ? 'Brutes' : 'Exploders' }), el('small', { text: `${info.cost} F · ×${info.packSize || 1}` }), el('small', { text: `${info.health} HP · ${info.wallDamage} breach` }), el('small', { text: id === 'swift' ? 'Fast rush' : id === 'armored' ? 'Armor · use pierce' : id === 'explosive' ? 'Wall breaker' : 'Swarm · use splash' }),
      ]);
      button.addEventListener('click', () => issue({ type: 'send', enemy: id })); cards.append(button);
    }
    if (dockTab === 'capture') {
      for (const captive of own.captured || []) {
        const attack = status.config?.attacks[captive.type]; if (!attack) continue;
        const cost = pvpReleaseCost(attack.cost, attack.packSize);
        const button = el('button', { type: 'button', class: 'ftd-duel-card is-attack', disabled: busy || own.fruts < cost, 'data-testid': 'arena-release' }, [lucideIcon(attackIcons[captive.type] || 'Citrus', 'ftd-duel-card__art', 30), el('strong', { text: `Release ${captive.type}` }), el('small', { text: `${cost} F · half unit cost` })]);
        button.addEventListener('click', () => issue({ type: 'release', capturedId: captive.id })); cards.append(button);
      }
      if (!own.captured?.length) cards.append(label('Build a Catcher near your damage turrets. It stores wounded zombies for counterattacks.', 'ftd-pvp__intro'));
    }
    panel.append(cards);
    if (dockTab === 'build' && allTowers.length > coreTowers.length) {
      const arsenal = el('button', { type: 'button', class: 'ftd-duel-arsenal', 'aria-expanded': expandedArsenal, text: expandedArsenal ? '− Core towers' : '+ More towers' });
      arsenal.addEventListener('click', () => { expandedArsenal = !expandedArsenal; if (!expandedArsenal && !coreTowers.includes(selectedTower)) selectedTower = visibleTowers[0]?.[0] || coreTowers[0]!; render(); });
      panel.append(arsenal);
    }
    if (selected && selectedBase) {
      const level = pvpTowerLevel(selected.level);const cost=pvpUpgradeCost(selectedBase.cost,level);
      panel.append(el('div',{class:'ftd-duel-upgrade','data-testid':'arena-tower-upgrade'},[
        lucideIcon(towerIcons[selected.type]||'TowerControl','',24),
        el('div',{},[el('strong',{text:`${towerName(selected.type)} · LV ${level}`} ),el('small',{text:`${pvpTowerStats(selectedBase,level).damage} damage · ${pvpTowerStats(selectedBase,level).range} range`})]),
        GameButton({label:level>=PVP_MAX_TOWER_LEVEL?'MAX':`Upgrade ${cost}`,size:'sm',tone:'primary',disabled:busy||level>=PVP_MAX_TOWER_LEVEL||own.fruts<cost,onClick:()=>issue({type:'upgrade',towerId:selected.id})}),
        GameButton({label:`Sell +${pvpSellRefund(selectedBase.cost,level)}`,size:'sm',variant:'outline',disabled:busy,onClick:()=>{selectedCell=null;issue({type:'sell',towerId:selected.id});}}),
      ]));
    }
    tray.append(panel);
    body.append(tray);
    if (surrenderConfirm) body.append(el('div', { class: 'ftd-duel-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leave match' }, [
      el('section', {}, [el('h2', { text: 'Leave this match?' }), label(match.testMatch ? 'End this practice match.' : match.queue === 'ranked' ? 'Leaving counts as a Ranked loss.' : 'Your opponent wins if you leave.'),
        GameButton({ label: 'Keep playing', tone: 'primary', onClick: () => { surrenderConfirm = false; render(); } }),
        GameButton({ label: 'Leave match', tone: 'danger', onClick: () => { surrenderConfirm = false; if (match.testMatch) void send(`/match/${match.id}/end-test`); else issue({ type: 'surrender' }); } }),
      ]),
    ]));

  };
  body.appendChild(LoadingIndicator('Connecting to the match service…'));
  void refresh();
  const timer = options.polling === false ? 0 : globalThis.setInterval(() => { if (!main.isConnected) { disposed = true; globalThis.clearInterval(timer); battlefield?.dispose(); hub?.classList.remove('is-pvp-battle'); const client = realtimeClients.get(root); if (client) client.close(); realtimeClients.delete(root); realtimeMatchId = ''; return; } void refresh(); }, 900) as unknown as number;
  timers.set(root, timer);
  cleanups.set(root, () => { disposed = true; globalThis.clearInterval(timer); battlefield?.dispose(); hub?.classList.remove('is-pvp-battle'); const client = realtimeClients.get(root); if (client) client.close(); realtimeClients.delete(root); realtimeMatchId = ''; });
}
