import {turretAllowed} from '../../game/turretLoadout';
import { showScreenLoadFailure } from './loadFailure';
import { TURRET_WEAPONS } from '../../game/turretWeapons';
import { heroArt } from '../heroArt';
import { heroDef, type HeroId } from '../../game/heroes';
import { powerButton, updatePowerButton } from '../powerButton';
import type { PowerCast } from '../../game/powerCombat';
import { acceptArenaRating, ARENA_RANK_COLORS, type ArenaRating } from '../../services/pvpRating';
import { lucideIcon } from '../lucideIcon';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { getAuthToken } from '../../services/auth';
import { heroAbility } from '../../game/heroAbilities';
import { PVP_MAX_TOWER_LEVEL, pvpTowerLevel, pvpUpgradeCost, pvpSellRefund, pvpMainUpgradeCost, pvpReleaseCost, type PvpConfig, type PvpQueue } from '../../game/pvp';
import type { Realtime as AblyRealtime } from 'ably';
import { socialApi } from '../../services/social';
import type { PvpBattlefield } from './pvpBattlefield';
import { turretDef, type TurretKind } from '../../game/turrets';
import { LoadingIndicator } from '../components/loading';
import { ARENA_BOSSES, arenaTurretStats } from '../../game/pvpRebuild';
import { sharedSfx } from '../../audio/sfx';

type MapView = { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells: number[]; solidCells?:number[]; hazards?:Array<{cell:number;kind:'slow'|'damage'}> };
type MatchView = { id: string; queue: PvpQueue; status: string; rulesVersion?:number; phase?:'capture'|'siege'|'overtime'; phaseEndsAt?:number; catchables?:Array<{id:string;type:string;fruitKind:string;x:number;y:number}>; testMatch: boolean; remainingMs: number; revision: number; map: MapView | null; mapPool: MapView[]; yourVetoTurn: boolean; vetoesRemaining: number; players: Array<{ turretLoadout?:string[]; userId: string; name: string; avatar?: string; side: string; fruts: number; wallHealth: number; mainLevel?: number; mainLastFiredAt?:number; wallMaxHealth?: number; captured?: Array<{ id: string; type: string; fruitKind?:string }>; hero?: string; wallSkin?: string; powerCasts?:PowerCast[]; abilityLoadout?: string[]; abilityRanks?: Record<string,number>; abilityReadyAt?: Record<string,number>; rallyUntil?: number; rallyReadyAt?: number; score: number; towers: Array<{ id: string; type: string; cell: number; level?: number;lastFiredAt?:number }>; attackers: Array<{ id: string; type: string; progress: number; x?:number;y?:number;boss?:boolean;fruitKind?:string }>; connected: boolean; ratingDelta?: number }>; yourSide: string; winnerId: string | null; resultReason: string | null; yourSequence: number; yourCombo: number };
type PvpStatus = { success: boolean; error?: string; rankedPenalty?: { leaves:number; bannedUntil:string|null }; canStartBotMatch?: boolean; rating?: ArenaRating; match?: MatchView | null; queued?: PvpQueue | null; challenge?: { challengeId: string; fromId: string; fromName: string } | null; config?: Pick<PvpConfig, 'mainTower' | 'wallHealth' | 'durationSeconds' | 'reconnectGraceSeconds' | 'towers' | 'attacks' | 'maps' | 'incomePerSecond' | 'startingFruts' | 'arenaRules' | 'bossCosts'> };
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
function playerPortrait(player: Pick<NonNullable<PvpStatus['match']>['players'][number], 'name' | 'avatar' | 'side' | 'hero'>, className = ''): HTMLElement {
  const portrait = el('span', { class: `ftd-vs-portrait is-${player.side === 'red' ? 'red' : 'blue'} ${className}`, 'aria-label': `${player.name} avatar` });
  if (player.avatar) portrait.appendChild(el('img', { src: player.avatar, alt: `${player.name} avatar`, referrerpolicy: 'no-referrer' }));
  else portrait.appendChild(heroArt(heroDef((player.hero || 'jiju') as HeroId).id));
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
  const main = el('section', { class: `ftd-pvp ftd-pvp--${queue}` });
  const hostAnchor=el('span',{hidden:true,'data-pvp-host':''});root.append(hostAnchor,main);
  let status: PvpStatus = { success: true };
  let selectedTower = 'guillotine';
  let selectedCell: number | null = null;
  let pendingBuildCell: number | null = null;
  let dockTab: 'build' | 'attack' | 'capture' = 'build';
  let lastBoughtFruit: string | null = null;
  let dockExpanded = false;
  let toolsExpanded=false;
  let hudExpanded=false;
  let surrenderConfirm = false;
  const powerRail=el('div',{class:'ftd-duel-powers','aria-label':'Equipped hero powers'});
  let rankedConfirm = false;
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
  let battlefieldLoadingId = '';
  let battlefieldFailure: {id:string;error:unknown}|null = null;
  let busy = false;
  let refreshing = false;
  let attachingRealtime = false;
  let disposed = false;
  let realtimeMatchId = '';
  let clashShownMatchId = '';
  const inHub = Boolean(root.closest('.ftd-hub-panel-content'));
  const heading = el('header', { class: `ftd-pvp__heading${inHub ? ' ftd-pvp__heading--briefing' : ''}` }, [
    el('div', {}, [label('TOWER SIEGE · NORMAL OR RANKED', 'ftd-pvp__eyebrow'), el(inHub ? 'h2' : 'h1', { text: inHub ? 'SIEGE BRIEFING' : 'ARENA' }), label('Catch zombies for 20 seconds, then release your swarm for free. Earn Fruts, build and counterattack. Destroy the rival wall; at timeout, the higher wall percentage wins.', 'ftd-pvp__intro')]),
    el('div', { class: 'ftd-pvp__rating', 'data-pvp-rating': '' }, [label('RATING', 'ftd-pvp__eyebrow'), el('strong', { text: 'Loading…' })]),
  ]);
  main.appendChild(heading);
  const body = el('div', { class: 'ftd-pvp__body' }); main.appendChild(body);

  // Keep a pressed control mounted until its click completes. Snapshots still
  // update the field while panning or holding a control.
  const pressedPointers = new Set<number>();
  let renderPending = false;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  const pointerDown = (event: PointerEvent) => { pressedPointers.add(event.pointerId); };
  const pointerUp = (event: PointerEvent) => {
    pressedPointers.delete(event.pointerId);
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (renderPending && !disposed && main.isConnected) requestRender();
    }, 0);
  };
  main.addEventListener('pointerdown', pointerDown);
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerUp);
  const requestRender = () => {
    if (disposed || !main.isConnected) return;
    if (pressedPointers.size || battlefield?.interacting) {
      renderPending = true;
      const current = status.match;
      if (current && battlefieldId === current.id && status.config) battlefield?.update(current, status.config);
      return;
    }
    renderPending = false;
    render();
  };
  const releaseInput = () => {
    clearTimeout(releaseTimer);
    document.removeEventListener('pointerup', pointerUp);
    document.removeEventListener('pointercancel', pointerUp);
    main.removeEventListener('pointerdown', pointerDown);
    pressedPointers.clear();
  };
  const refresh = async () => {
    if (refreshing || !main.isConnected) return;
    refreshing = true;
    try {
      const incoming = await request('/status');
      if (!main.isConnected) return;
      const unchangedLobby = !status.match && !incoming.match && JSON.stringify(status) === JSON.stringify(incoming);
      const hadError = Boolean(actionError);
      actionError = '';
      if (!status.match || !incoming.match || status.match.id !== incoming.match.id || incoming.match.revision >= status.match.revision) status = incoming;
      if (status.rating) acceptArenaRating(status.rating);
      if (!unchangedLobby || hadError) requestRender();
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect.';
      if (actionError !== message) { actionError = message; requestRender(); }
    }
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
        status.match = { ...current, revision, status: data.status, phase:data.phase, phaseEndsAt:data.phaseEndsAt, catchables:data.phase==='capture'?(data.catchables??[]).filter((item:any)=>item.bornAt<=Date.now()&&item.expiresAt>Date.now()&&!item.claimedBy?.includes(own.userId)):[], remainingMs: Math.max(0, data.endsAt - Date.now()), players: data.players, map: data.map, winnerId: data.winnerId, resultReason: data.resultReason, yourSequence: own.sequence, yourCombo: own.currentCombo, mapPool: data.mapPool || current.mapPool, yourVetoTurn: data.vetoTurn === own.userId, vetoesRemaining: Math.max(0, (data.mapPool?.length || 2) - 2) };
        requestRender();
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
        if(command.type==='send' && !ARENA_BOSSES[command.enemy]) {
          lastBoughtFruit=command.enemy;
          dockTab='capture'; dockExpanded=true;
        }
        if(command.type==='catch')sharedSfx.play('item-increment',{volume:.35,ui:true});
        else if(command.type==='build')sharedSfx.place();
        else if(command.type==='send'||command.type==='release')sharedSfx.enemyWarning();
        else if(command.type==='upgrade'||command.type==='upgrade-main')sharedSfx.boost();
        actionFeedback = command.type === 'catch' ? 'FRUIT CAUGHT · FREE RELEASE READY' : command.type === 'send' ? 'FRUIT SENT → RIVAL WALL' : command.type === 'build' ? 'DEFENCE BUILT · AUTO FIRE READY' : command.type === 'upgrade' ? 'TOWER UPGRADED' : command.type === 'rally' ? 'RALLY! +25% DAMAGE FOR 8 SECONDS' : command.type === 'release' ? 'CAPTURED FRUIT SENT → RIVAL WALL' : command.type === 'upgrade-main' ? 'BASE UPGRADED · STRONGER WALL' : command.type === 'ability' ? 'HERO POWER ACTIVATED' : command.type === 'sell' ? 'TOWER SOLD · FRUTS REFUNDED' : '';
        feedbackUntil = Date.now() + 2200;
      }
      if (response.match && (!status.match || response.match.id !== status.match.id || response.match.revision >= status.match.revision)) { status.match = response.match; requestRender(); }
      await refresh();
    }
    catch (error) { actionError = error instanceof Error ? error.message : 'Action failed.'; render(); }
    finally { busy = false; if (main.isConnected) requestRender(); }
  };
  const render = () => {
    const active = document.activeElement as HTMLElement | null;
    const focused = active?.tagName === 'BUTTON' && active.closest('.ftd-pvp') === main
      ? { key:active.getAttribute('data-testid'), label:active.textContent } : null;
    const scroll = ['.ftd-duel-rail','.ftd-duel-panel','.ftd-duel-cards'].map(selector => ({selector,top:body.querySelector(selector)?.scrollTop ?? 0,left:body.querySelector(selector)?.scrollLeft ?? 0}));
    renderContent();
    for (const position of scroll) { const node=body.querySelector(position.selector); if(node){node.scrollTop=position.top;node.scrollLeft=position.left;} }
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
  let completedViewKey = '';
  const renderContent = () => {
    const badge = main.querySelector<HTMLElement>('.ftd-pvp__rating')?.querySelector<HTMLElement>('strong');
    if (badge) {
      const ratingText = status.rating
        ? `${status.rating.tier} · ${status.rating.points.toLocaleString()} FR`
        : actionError ? 'Rating unavailable' : 'Loading…';
      if (badge.textContent !== ratingText) badge.textContent = ratingText;
      badge.style.color = status.rating ? ARENA_RANK_COLORS[status.rating.tier] || '#aab9aa' : '';
    }
    const match = status.match;
    // Completed snapshots may repeat while settlement finishes. Keep the dialog
    // mounted so polling cannot restart its entrance or lose keyboard focus.
    const resultKey = match?.status === 'complete' ? JSON.stringify([match.id, match.winnerId, match.resultReason, match.players.map(p => [p.wallHealth,p.ratingDelta]), actionError]) : '';
    if (resultKey && resultKey === completedViewKey) return;
    completedViewKey = resultKey;
    body.replaceChildren();
    const inBattle = match?.status === 'active' || match?.status === 'complete';
    hub ??= root.closest<HTMLElement>('.ftd-hub');
    if (realtimeMatchId && (realtimeMatchId !== match?.id || match?.status !== 'active')) {
      const oldClient = realtimeClients.get(root);
      if (oldClient) oldClient.close();
      realtimeClients.delete(root);
      realtimeMatchId = '';
    }
    main.classList.toggle('is-battle', inBattle); hub?.classList.toggle('is-pvp-battle', inBattle);
    // Hub panels use filters and clipping, which contain fixed descendants.
    // Mount the actual match at the document root, then restore the lobby.
    const host = inBattle && hub ? document.body : root;
    if (main.parentElement !== host) host.appendChild(main);
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
        el('section', { class: 'ftd-pvp__launch' }, [
          el('div', {}, [label(queue === 'ranked' ? 'SEASONAL RANKED SIEGE' : 'NORMAL SIEGE', 'ftd-pvp__eyebrow'), el('h2', { text: status.queued === queue ? 'FINDING YOUR RIVAL' : 'CATCH. BUILD. RELEASE.' }), label('1 vs 1 · 20-second catch · 160-second siege · seven tactical maps', 'ftd-pvp__intro')]),
          status.queued === queue
            ? GameButton({ label: 'Cancel search', variant: 'outline', onClick: () => void send('/queue', undefined, 'DELETE') })
            : GameButton({ label: queue === 'ranked' ? 'Find ranked match' : 'Quick match', tone: 'primary', size: 'lg', disabled: queue === 'ranked' && Boolean(status.rankedPenalty?.bannedUntil && Date.parse(status.rankedPenalty.bannedUntil) > Date.now()), onClick: () => { if (queue === 'ranked') { rankedConfirm = true; render(); } else void send('/queue', { queue }); } }),
        ]),
        ...(queue === 'ranked' && status.rankedPenalty?.bannedUntil && Date.parse(status.rankedPenalty.bannedUntil) > Date.now() ? [label(`Ranked locked until ${new Date(status.rankedPenalty.bannedUntil).toLocaleTimeString()} · ${status.rankedPenalty.leaves} abandons. Normal Arena is available.`, 'ftd-pvp__notice')] : []),
        label('YOUR BATTLE PLAN', 'ftd-pvp__section-title'),
        el('div', { class: 'ftd-pvp__howto' }, [
          el('div', {}, [el('b', { text: '01 / CATCH' }), el('p', { text: 'Drag moving fruit into your collection box. Each one becomes a free release during siege.' })]),
          el('div', {}, [el('b', { text: '02 / BUILD & SEND' }), el('p', { text: 'Build on clear hexes near your wall. Spend match Fruts on fruit or bosses, or release a catch for free.' })]),
          el('div', {}, [el('b', { text: '03 / BREAK THE BASE' }), el('p', { text: 'Pressure a weak defence or save for a heavy push. Destroy the opponent wall or finish with more wall health at time.' })]),
        ]),
        el('details', { class: 'ftd-pvp__rules' }, [el('summary', { text: 'Strategy & advanced rules' }), label('Siege starts with 100 Fruts. Earn more by destroying enemy fruit and damaging the rival tower; there is no automatic income. Caught fruit release free. Only one purchased boss may be active. At timeout, higher wall health wins; an exact tie triggers overtime.', 'ftd-pvp__intro')]),
        label(queue === 'ranked' ? 'Win or lose FR based on opponent rating. Nearby ranks only. No slicing bonuses.' : 'Normal results do not change rank. Both queues start with equal walls and income and match nearby ratings. Your equipped hero powers use match Fruts; ranks improve their effects. Every hero also has Rally.', 'ftd-pvp__intro'),
        ...(queue === 'arena' ? [el('div', { class: 'ftd-pvp__challenge' }, [el('h3', { text: 'PRIVATE DUEL' }), el('label', { htmlFor: 'pvp-friend-select', text: 'Challenge a friend' }), el('select', { id: 'pvp-friend-select', class: 'ftd-pvp__friend-select' }, [el('option', { value: '', text: friendsError ? 'Could not load friends' : friendOptions ? friendOptions.length ? 'Choose a friend' : 'Add a friend first' : 'Loading friends…' }), ...(friendOptions || []).map((friend) => el('option', { value: friend.userId, text: friend.name, selected: friend.userId === selectedFriend }))]), GameButton({ label: 'Send challenge', variant: 'outline', disabled: !selectedFriend || busy, onClick: () => { if (selectedFriend) void send('/challenge', { friendId: selectedFriend }); } })])] : []),
        ...(status.challenge ? [el('div', { class: 'ftd-pvp__incoming' }, [label(`${status.challenge.fromName} challenged you.`), GameButton({ label: 'Accept challenge', tone: 'primary', onClick: () => void send(`/challenge/${status.challenge!.challengeId}/accept`) })])] : []),
        ...(status.canStartBotMatch ? [el('div', { class: 'ftd-pvp__bot-start' }, [label('ADMIN PLAYTEST', 'ftd-pvp__section-title'), label('Play the full siege against a server-controlled opponent. Results do not grant FR, rewards, or badges.', 'ftd-pvp__intro'), el('label', { htmlFor: 'pvp-test-map', text: 'Battlefield' }), el('select', { id: 'pvp-test-map', class: 'ftd-pvp__friend-select' }, (status.config?.maps || []).map((map) => el('option', { value: map.id, text: map.name, selected: map.id === selectedTestMap }))), GameButton({ label: `Test ${queue === 'ranked' ? 'Ranked' : 'Arena'} vs bot`, tone: 'primary', onClick: () => void send('/admin/bot', { queue, mapId: main.querySelector<HTMLSelectElement>('#pvp-test-map')?.value || selectedTestMap }) })])] : []),
      ]));
      if (rankedConfirm && queue === 'ranked') body.append(el('div', { class: 'ftd-duel-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ranked queue warning' }, [
        el('section', {}, [el('h2', { text: 'Ranked commitment' }), label('Leaving or disconnecting past the reconnect window ends your match as a loss. Ranked queue locks for 20 minutes; from your third abandon, 1 hour, then longer for each further abandon.'),
          GameButton({ label: 'Stay here', onClick: () => { rankedConfirm = false; render(); } }),
          GameButton({ label: 'Join Ranked', tone: 'primary', onClick: () => { rankedConfirm = false; void send('/queue', { queue: 'ranked' }); } })]),
      ]));
      main.querySelector<HTMLSelectElement>('#pvp-test-map')?.addEventListener('change', (event) => { selectedTestMap = (event.currentTarget as HTMLSelectElement).value; });
      main.querySelector<HTMLSelectElement>('#pvp-friend-select')?.addEventListener('change', (event) => { selectedFriend = (event.currentTarget as HTMLSelectElement).value; render(); });
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
        const path = new Set(map.pathCells),solid=new Set(map.solidCells??[]),slow=new Set((map.hazards??[]).filter(h=>h.kind==='slow').map(h=>h.cell)),damage=new Set((map.hazards??[]).filter(h=>h.kind==='damage').map(h=>h.cell));
        const thumbnail = el('div', { class: 'ftd-pvp__map-thumb', style: `--map-cols:${map.width}` }, Array.from({ length: map.width * map.height }, (_, cell) => el('i', { class: solid.has(cell)?'is-solid':slow.has(cell)?'is-slow':damage.has(cell)?'is-damage':path.has(cell)?'is-path':'' })));
        const veto = el('button', { class: 'ftd-pvp__map-card', type: 'button', disabled: !match.yourVetoTurn }, [thumbnail, el('strong', { text: map.name }), el('small', { text: `${solid.size} solid hexes · ${slow.size+damage.size} hazards` })]);
        veto.addEventListener('click', () => void send(`/match/${match.id}/veto`, { sequence: match.yourSequence + 1, mapId: map.id })); return veto;
      });
      const identityCard = (player: typeof own, rival: boolean) => el('div', { class: `ftd-versus-card ${rival ? 'is-rival' : 'is-own'} is-${player.side}` }, [playerPortrait(player), el('div', {}, [el('small', { text: `${rival ? 'CHALLENGER' : 'YOUR FIGHTER'}` }), el('strong', { text: player.name })])]);
      body.append(el('section', { class: 'ftd-pvp__draft' }, [el('div', { class: 'ftd-pvp__draft-head' }, [el('p', { class: 'ftd-pvp__eyebrow', text: match.queue === 'ranked' ? 'RANKED SHOWDOWN' : 'ARENA SHOWDOWN' }), el('h2', { text: 'CHOOSE THE BATTLEFIELD' }), label(`${match.vetoesRemaining} route bans left · then the arena is chosen`), label(match.yourVetoTurn ? 'Your turn: ban one route' : 'Waiting for the other player to ban a route')]), el('div', { class: 'ftd-versus-lineup' }, [identityCard(own, false), el('strong', { class: 'ftd-versus-mark', text: 'VS' }), identityCard(opponent, true)]), el('div', { class: 'ftd-pvp__map-grid' }, drafts), GameButton({ label: 'Cancel draft · no rank change', variant: 'outline', onClick: () => void send(`/match/${match.id}/cancel-draft`) })]));
      return;
    }
    if (match.status === 'complete') {
      const won = match.winnerId === own.userId;
      if (battlefield) {
        battlefield.update(match, { wallHealth:status.config?.wallHealth || 100, towers:status.config?.towers || {}, attacks:status.config?.attacks || {} });
        body.append(battlefield.element);
      }
      const wallResult = (player: typeof own) => Math.round(player.wallHealth / (player.wallMaxHealth ?? status.config?.wallHealth ?? 100) * 100);
      const title = match.resultReason === 'draft-cancelled' ? 'DRAFT CANCELLED' : match.resultReason === 'test-ended' ? 'TEST ENDED' : won ? 'VICTORY' : match.winnerId ? 'DEFEAT' : 'DRAW';
      const faceoff = (player: typeof own, winner: boolean, rival: boolean) => el('div', { class: `ftd-result-fighter ${rival ? 'is-rival' : 'is-own'} is-${player.side}${winner ? ' is-winner' : ''}` }, [playerPortrait(player), el('strong', { text: player.name }), el('span', { text: rival ? 'OPPONENT' : 'YOU' }), el('small', { text: `${wallResult(player)}% WALL` })]);
      const animateResult = clashShownMatchId !== `result:${match.id}`;
      if (animateResult) clashShownMatchId = `result:${match.id}`;
      body.append(el('div', { class:'ftd-duel-result-overlay' }, [el('section', { class: `ftd-pvp__result ${won ? 'is-victory' : match.winnerId ? 'is-defeat' : ''}${animateResult ? ' is-entering' : ''}`, role:'dialog', 'aria-modal':'true', 'aria-label':'Match result' }, [
        label(match.queue === 'ranked' ? 'RANKED MATCH · FINAL REPORT' : 'ARENA MATCH · FINAL REPORT', 'ftd-result-kicker'),
        el('h2', { text: title }),
        el('div', { class:'ftd-result-faceoff' }, [faceoff(own, won, false), el('strong', { class:'ftd-result-vs', text:'VS' }), faceoff(opponent, match.winnerId === opponent.userId, true)]),
        label(won ? `${own.name} held the orchard wall.` : match.winnerId ? `${opponent.name} broke through your defence.` : 'Both walls held. The match is a draw.', 'ftd-result-summary'),
        el('div', { class:'ftd-result-stats' }, [el('span', {}, [el('small', { text:`${own.name} · YOU` }), el('b', { text:`${wallResult(own)}%` })]), el('span', {}, [el('small', { text:`${opponent.name} · OPPONENT` }), el('b', { text:`${wallResult(opponent)}%` })])]),
        ...(match.testMatch ? [label('PRACTICE · No FR, rewards, achievements, or badges granted.', 'ftd-pvp__intro')] : []),
        ...(match.queue === 'ranked' && !match.testMatch && match.resultReason !== 'draft-cancelled' ? [label(own.ratingDelta === undefined ? 'Settling your Ranked rating…' : `RANK POINTS  ${own.ratingDelta > 0 ? '+' : ''}${own.ratingDelta} FR`, 'ftd-result-rating')] : []),
        GameButton({ label: 'Return to Arena', tone: 'primary', onClick: () => void send(`/match/${match.id}/ack`) })
      ])]));
      return;
    }
    const timer = Math.ceil(match.remainingMs / 1000);
    const maxHealth = status.config?.wallHealth || 100;
    const playerCard = (player: typeof own, rival: boolean) => el('div', { class: `ftd-duel-player ${rival ? 'is-rival' : 'is-own'} is-${player.side === 'red' ? 'red' : 'blue'}` }, [
      playerPortrait(player, 'ftd-duel-player__crest'),
      el('div', {}, [el('strong', { text: player.name }), el('span', { class:'ftd-duel-player__side', text:rival ? 'OPPONENT' : 'YOU' }), el('span', { text: `${Math.ceil(player.wallHealth)} / ${Math.ceil(player.wallMaxHealth ?? maxHealth)} · Lv ${pvpTowerLevel(player.mainLevel)}` }),
        el('div', { class: 'ftd-duel-hp', role: 'progressbar', 'aria-label': `${player.name} wall health`, 'aria-valuenow': player.wallHealth, 'aria-valuemax': player.wallMaxHealth ?? maxHealth }, [el('i', { style: `width:${Math.max(0, Math.min(100, player.wallHealth / (player.wallMaxHealth ?? maxHealth) * 100))}%` })]),
      ]),
    ]);
    body.append(el('header', { class: `ftd-duel-hud${hudExpanded?' is-expanded':''}` }, [playerCard(own, false),
      el('div', { class: 'ftd-duel-clock' }, [el('small', { text: match.phase === 'capture' ? 'CAPTURE' : match.testMatch ? 'PRACTICE' : match.queue === 'ranked' ? 'RANKED' : 'ARENA' }), el('strong', { text: match.phase === 'capture' ? `${Math.max(0,Math.ceil(((match.phaseEndsAt??Date.now())-Date.now())/1000))}s` : `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}` }),
        el('button', { type:'button', class:'ftd-duel-leave', title:'Leave match', 'aria-label':'Leave match', 'data-testid':'arena-leave' }, [lucideIcon('LogOut','',16)]),
        el('button',{type:'button',class:'ftd-duel-hud-toggle','data-testid':'arena-hud-toggle','aria-label':hudExpanded?'Collapse player details':'Expand player details','aria-expanded':hudExpanded},[lucideIcon(hudExpanded?'ChevronUp':'ChevronDown','',14)]),
      ]), playerCard(opponent, true),
      el('div',{class:'ftd-duel-status','aria-label':'Match status'},[
        el('span',{},[el('small',{text:match.phase==='capture'?'CATCH':'TIME'}),el('strong',{text:`${Math.floor(timer/60)}:${String(timer%60).padStart(2,'0')}`})]),
        el('span',{},[el('small',{text:'FRUTS'}),el('strong',{text:String(Math.floor(own.fruts))})]),
        el('span',{},[el('small',{text:'WALL'}),el('strong',{text:String(Math.ceil(own.wallHealth))})]),
      ]),
    ]));
    body.querySelector<HTMLButtonElement>('[data-testid="arena-leave"]')?.addEventListener('click', () => { surrenderConfirm=true;render(); });
    body.querySelector('[data-testid="arena-hud-toggle"]')?.addEventListener('click',()=>{hudExpanded=!hudExpanded;render();});
    const objective = el('div', { class: 'ftd-duel-objective' });
    objective.innerHTML = `<b>DEFEND YOUR TOWER</b> · Stop incoming fruit &nbsp; | &nbsp; <em>SEND FRUIT SQUADS</em> · Zombies roam and fight wherever they meet`;
    objective.hidden=true;
    if (actionFeedback && Date.now() < feedbackUntil) body.append(el('div', { class: 'ftd-duel-feedback', role: 'status', text: actionFeedback }));
    const sceneConfig = { wallHealth: maxHealth, mainTower:status.config?.mainTower, towers: status.config?.towers || {}, attacks: status.config?.attacks || {} };
    const issue = (command: import('../../game/pvp').PvpCommand) => {
      const current = status.match;
      if (current?.status === 'active') void send(`/match/${current.id}/command`, { sequence: current.yourSequence + 1, command });
    };
    if (surrenderConfirm) body.append(el('div', { class: 'ftd-duel-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leave match' }, [
      el('section', {}, [el('h2', { text: 'Leave this match?' }), label(match.testMatch ? 'End this practice match.' : match.queue === 'ranked' ? 'Surrender ends this match as a loss and locks Ranked queue for 20 minutes. Your third abandon locks it for 1 hour, then longer.' : 'Your opponent wins if you leave.'),
        GameButton({ label: 'Keep playing', tone: 'primary', onClick: () => { surrenderConfirm = false; render(); } }),
        GameButton({ label: 'Leave match', tone: 'danger', onClick: () => { surrenderConfirm = false; if (match.testMatch) void send(`/match/${match.id}/end-test`); else issue({ type: 'surrender' }); } }),
      ]),
    ]));
    if (!battlefield || battlefieldId !== match.id) {
      if(battlefieldFailure?.id===match.id){
        const failure=el('div',{class:'ftd-duel-scene-failure'});
        showScreenLoadFailure(failure,'Battlefield',battlefieldFailure.error,()=>{battlefieldFailure=null;render();});
        body.append(failure);return;
      }
      battlefield?.dispose(); selectedCell = null; lastBoughtFruit = null; battlefield = null; battlefieldId = '';
      const select = (cell: number) => {
        const current = status.match; const player = current?.players.find(item => item.side === current.yourSide);
        if (!current || !player) return;
        if(cell===-1){toolsExpanded=false;pendingBuildCell=null;selectedCell=-1;dockTab='build';dockExpanded=true;render();return;}
        const tower = player.towers.find(item => item.cell === cell);
        if (tower) { toolsExpanded=false; pendingBuildCell = null; selectedCell = cell; dockTab = 'build'; dockExpanded = true; render(); }
        else {
          toolsExpanded=false; selectedCell = cell; pendingBuildCell = cell; dockTab = 'build'; dockExpanded = true; render();
        }
      };
      if (options.createBattlefield) {
        try {
          battlefield = options.createBattlefield(match, sceneConfig, issue, select);
          battlefieldId = match.id;
        } catch (error) {
          battlefieldFailure={id:match.id,error};render();return;
        }
      } else {
        const loadingId = match.id;
        body.append(LoadingIndicator('Loading Arena battlefield…'));
        if (battlefieldLoadingId !== loadingId) {
          battlefieldLoadingId = loadingId;
          void import('./pvpBattlefield').then(({ PvpBattlefield }) => {
            battlefieldLoadingId = '';
            const current = status.match;
            if (disposed || !main.isConnected || current?.id !== loadingId || current.status !== 'active') {
              if (!disposed && main.isConnected) render();
              return;
            }
            battlefield = new PvpBattlefield(current, sceneConfig, issue, select);
            battlefieldId = loadingId;
            render();
          }).catch((error) => {
            battlefieldLoadingId = '';
            if (disposed || !main.isConnected || status.match?.id !== loadingId) return;
            battlefieldFailure={id:loadingId,error};
            render();
          });
        }
        return;
      }
    }
    battlefield.update(match, sceneConfig); battlefield.selectCell(selectedCell);
    body.append(battlefield.element);
    if(match.phase==='capture'){
      const left=Math.max(0,Math.ceil(((match.phaseEndsAt??Date.now())-Date.now())/1000));
      body.append(el('div',{class:'ftd-arena-capture-status',role:'status'},[el('strong',{text:`CATCH FRUIT · ${left}s`}),el('span',{text:`${own.captured?.length??0} caught · Drag zombies into the box · Free releases when battle starts`})]));
      return;
    }
    if (match.status === 'active' && clashShownMatchId !== match.id) {
      clashShownMatchId = match.id;
      const fighter = (player: typeof own, rival: boolean) => el('div', { class: `ftd-clash-fighter ${rival ? 'is-rival' : 'is-own'} is-${player.side}` }, [playerPortrait(player), el('strong', { text: player.name }), el('small', { text: rival ? 'OPPONENT' : 'YOU' })]);
      body.append(el('div', { class:'ftd-vs-clash', role:'status', 'aria-live':'polite' }, [fighter(own, false), el('strong', { class:'ftd-vs-clash__mark', text:'VS' }), fighter(opponent, true), el('span', { class:'ftd-vs-clash__caption', text:match.queue === 'ranked' ? 'RANKED SIEGE · BUILD & RELEASE' : 'ARENA SIEGE · BUILD & RELEASE' })]));
    }
    const towerIcons: Record<string, string> = {...Object.fromEntries(Object.entries(TURRET_WEAPONS).map(([id,w])=>[id,w.icon])),catcher:'Fence'};
    const attackIcons: Record<string, string> = { normal: 'Citrus', swift: 'Cherry', armored: 'Shield', explosive: 'Bomb' };
    const towerName = (id: string) => id === 'catcher' ? 'Catcher' : turretDef(id as TurretKind)?.name || id;
    const rallyWait = Math.max(0, Math.ceil(((own.rallyReadyAt ?? 0) - Date.now()) / 1000));
    const rallyActive = (own.rallyUntil ?? 0) > Date.now();
    const selected = own.towers.find(tower => tower.cell === selectedCell);
    const selectedBase = selected ? status.config?.towers[selected.type] : null;
    const tray = el('footer', { class: `ftd-duel-dock${toolsExpanded?' are-tools-open':''}` });
    const mainLevel = pvpTowerLevel(own.mainLevel); const mainCost = pvpMainUpgradeCost(mainLevel);
    tray.classList.toggle('is-expanded', dockExpanded);
    const resource = el('div', { class: 'ftd-duel-resource', role:'status', 'aria-label':'Match Fruts' }, [
      el('span', { class:'ftd-duel-wallet' }, [lucideIcon('Leaf', '', 18), el('strong', { text: `${Math.floor(own.fruts)} F` })]),
      el('small', { class:'ftd-duel-statusline', text: !opponent.connected ? 'Opponent reconnecting…' : !own.towers.length ? 'Build on a faint hex · earn Fruts from combat' : `${own.attackers.length} incoming · ${opponent.attackers.length} attacking · kills and tower hits earn Fruts` }),
    ]);
    const actionRail = el('div', { class:'ftd-duel-rail', 'aria-label':'Battle actions' });
    const openDock = (tab:'build'|'attack'|'capture') => { const wasOpen=dockExpanded&&dockTab===tab;dockTab=tab;dockExpanded=!wasOpen;toolsExpanded=false;selectedCell=null;pendingBuildCell=null;battlefield?.setAttackView?.(dockExpanded&&tab==='attack');render(); };
    const railButton = (iconName:string, labelText:string, action:()=>void, disabled=false, testId?:string, selected=false) => {
      const button=el('button',{type:'button',class:`ftd-duel-icon-button${selected?' is-active':''}`,title:labelText,'aria-label':labelText,disabled,...(testId?{'data-testid':testId}:{})},[lucideIcon(iconName,'',19),el('span',{class:'ftd-duel-action-label',text:({'arena-tab-build':'BUILD','arena-tab-attack':'SEND','arena-tab-capture':`RELEASE ${own.captured?.length ?? 0}`,'arena-rally':'BOOST','arena-upgrade-main':'TOWER'} as Record<string,string>)[testId??'']??'MORE'})]);
      button.addEventListener('click',action);return button;
    };
    actionRail.append(
      railButton('Fence',`Release captured zombies · ${own.captured?.length ?? 0}`,()=>openDock('capture'),false,'arena-tab-capture',dockExpanded&&dockTab==='capture'),
      railButton('Cherry','Send fruit attack',()=>openDock('attack'),false,'arena-tab-attack',dockExpanded&&dockTab==='attack'),
    );
    if(lastBoughtFruit && status.config?.attacks[lastBoughtFruit]) {
      const info=status.config.attacks[lastBoughtFruit]!;
      actionRail.append(railButton('RotateCcw',`Buy ${lastBoughtFruit} again · ${info.cost} Fruts`,()=>issue({type:'send',enemy:lastBoughtFruit!}),busy||own.fruts<info.cost,'arena-buy-again'));
    }
    const more=railButton(toolsExpanded?'ChevronDown':'SlidersHorizontal','Battle controls',()=>{toolsExpanded=!toolsExpanded;dockExpanded=false;selectedCell=null;pendingBuildCell=null;battlefield?.setAttackView?.(false);render();},false,'arena-controls-toggle');
    more.setAttribute('aria-expanded',String(toolsExpanded));actionRail.append(more);
    const tools=el('div',{class:'ftd-duel-tools',hidden:!toolsExpanded});
    tools.append(
      railButton('Zap',rallyActive?'Damage boost active for your defence':rallyWait?`Damage boost ready in ${rallyWait}s`:'Boost your towers by 25% for 8 seconds · free',()=>issue({type:'rally'}),busy||rallyWait>0,'arena-rally'),
      railButton('Castle',mainLevel===PVP_MAX_TOWER_LEVEL?'Main tower · max level':`Upgrade your main tower and wall · ${mainCost} Fruts`,()=>issue({type:'upgrade-main'}),busy||mainLevel>=PVP_MAX_TOWER_LEVEL||own.fruts<mainCost,'arena-upgrade-main'),
    );
    const powerIds=(own.abilityLoadout ?? []).slice(0,3).filter(id=>Boolean(heroAbility(id)));
    if ([...powerRail.querySelectorAll<HTMLButtonElement>('[data-power]')].map(button=>button.dataset.power).join(',')!==powerIds.join(',')) {
      powerRail.replaceChildren(...powerIds.map(id=>powerButton(id,()=>issue({type:'ability',abilityId:id}))));
    }
    for (const id of powerIds) {
      const ability=heroAbility(id); if(!ability)continue;
      const power = powerRail.querySelector<HTMLButtonElement>(`[data-power="${id}"]`)!;
      power.dataset.testid = `arena-ability-${id}`;
      updatePowerButton(power, id, (own.abilityReadyAt ?? {})[id] ?? 0, own.fruts, busy,'fruts',own.abilityRanks?.[id]??1);
    }
    tray.append(resource,actionRail,tools);
    battlefield.element.appendChild(powerRail);
    const panel = el('div',{class:`ftd-duel-panel${dockExpanded?' is-open':''}${dockTab==='build'&&!selected&&selectedCell!==-1?' is-build-selection':''}`,hidden:!dockExpanded});
    const closePanel=el('button',{class:'ftd-duel-panel-close',type:'button','aria-label':'Close action panel'},[lucideIcon('X','',18)]);
    closePanel.addEventListener('click',()=>{dockExpanded=false;selectedCell=null;pendingBuildCell=null;render();});panel.append(closePanel);
    if(selectedCell===-1)panel.append(el('div',{class:'ftd-duel-upgrade','data-testid':'arena-main-upgrade'},[
      lucideIcon('Castle','',24),el('div',{},[el('strong',{text:`Main tower · Lv ${mainLevel}`}),el('small',{text:`${Math.ceil(own.wallHealth)} / ${Math.ceil(own.wallMaxHealth??maxHealth)} HP · automatic defence`})]),
      GameButton({label:mainLevel===PVP_MAX_TOWER_LEVEL?'MAX':`Level up · ${mainCost} F`,size:'sm',tone:'primary',disabled:busy||mainLevel>=PVP_MAX_TOWER_LEVEL||own.fruts<mainCost,onClick:()=>issue({type:'upgrade-main'})}),
    ]));
    panel.append(el('p', { class: 'ftd-duel-guide', text: selected ? 'Upgrade this turret or sell it to reclaim part of its cost.' : selectedCell === -1 ? 'Your main tower fires automatically. Upgrades last for this match.' : dockTab === 'build' ? `Select a clear hex near your wall, then choose its turret.` : dockTab === 'attack' ? `Buy one fruit per tap. Your swarm fights rival fruit and pushes toward the wall.` : `Each fruit caught in the opening releases once for free.` }));
    const cards = el('div', { class: 'ftd-duel-cards', 'aria-label': dockTab === 'build' ? 'Tower choices' : 'Fruit attack choices' });
    const allTowers = Object.entries(status.config?.towers || {}).filter(([id])=>turretAllowed(id,own.turretLoadout));
    const coreTowers = allTowers.slice(0,4).map(([id])=>id);
    const visibleTowers = expandedArsenal ? allTowers.slice(4) : allTowers.slice(0,4);
    if (dockTab === 'build' && !selected && selectedCell !== -1) for (const [id, info] of visibleTowers.length ? visibleTowers : allTowers) {
      const button = el('button', { type: 'button', class: `ftd-duel-card ${id === selectedTower ? 'is-selected' : ''}`, 'aria-pressed': id === selectedTower, 'data-testid': `arena-build-${id}` }, [
        lucideIcon(towerIcons[id] || 'TowerControl', 'ftd-duel-card__art', 30), el('strong', { text: towerName(id) }), el('small', { text: own.fruts < info.cost ? `Need ${Math.ceil(info.cost-own.fruts)} F` : `${info.cost} F` }),
      ]);
      button.classList.toggle('is-unaffordable', own.fruts < info.cost);
      button.addEventListener('click', () => {
        selectedTower = id;
        if (pendingBuildCell !== null) {
          if (own.fruts < info.cost) { actionError = `Need ${Math.ceil(info.cost-own.fruts)} more Fruts.`; render(); return; }
          const cell = pendingBuildCell; pendingBuildCell = null;
          issue({type:'build', tower:id, cell});
        } else selectedCell = null;
        dockExpanded = false; render();
      }); cards.append(button);
    } else if (dockTab === 'attack') for (const [id, info] of Object.entries(status.config?.attacks || {})) {
      const button = el('button', { type: 'button', class: 'ftd-duel-card is-attack', disabled: busy || own.fruts < info.cost, 'data-testid': `arena-send-${id}` }, [
        lucideIcon(attackIcons[id] || 'Apple', 'ftd-duel-card__art', 30), el('strong', { text: ({normal:'Rot-Walker',swift:'Juice-Runner',chainburst:'Pulp-Popper',spitter:'Acid-Spitter',explosive:'Chem-Burst',healer:'Mender',armored:'Rind-Plate',splitter:'Pod-Spawner'} as Record<string,string>)[id]??id }), el('small', { text: `${info.cost} F · one fruit` }), el('small', { text: `${info.health} HP · ${info.wallDamage} wall damage` }),
      ]);
      button.addEventListener('click', () => issue({ type: 'send', enemy: id })); cards.append(button);
    }
    if(dockTab==='capture'&&match.rulesVersion===2){
      panel.append(label('QUICK RELEASE · BUY AGAIN · BOSSES','ftd-duel-guide'));
      for(const [id,boss] of Object.entries(ARENA_BOSSES)){
        const active=opponent.attackers.some(unit=>unit.boss&&unit.id.startsWith(`${own.userId}:`));
        const cost=status.config?.bossCosts?.[id]??boss.cost;
        const button=el('button',{type:'button',class:'ftd-duel-card is-attack is-boss',disabled:busy||own.fruts<cost||active,'data-testid':`arena-send-${id}`},[lucideIcon('Crown','ftd-duel-card__art',30),el('strong',{text:id.split('-').map(word=>word[0]!.toUpperCase()+word.slice(1)).join(' ')}),el('small',{text:active?'Your boss is active':`${cost} F · boss`})]);
        button.addEventListener('click',()=>issue({type:'send',enemy:id}));cards.append(button);
      }
    }
    if (dockTab === 'capture') {
      if(lastBoughtFruit && status.config?.attacks[lastBoughtFruit]) {
        const info=status.config.attacks[lastBoughtFruit]!;
        const again=el('button',{type:'button',class:'ftd-duel-card is-attack',disabled:busy||own.fruts<info.cost,'data-testid':'arena-quick-buy'},[lucideIcon(attackIcons[lastBoughtFruit]||'Apple','ftd-duel-card__art',30),el('strong',{text:`Buy ${lastBoughtFruit}`}),el('small',{text:`${info.cost} F · repeat`})]);
        again.addEventListener('click',()=>issue({type:'send',enemy:lastBoughtFruit!}));cards.append(again);
      }
      for (const captive of own.captured || []) {
        const attack = status.config?.attacks[captive.type]; if (!attack) continue;
        const cost = match.rulesVersion===2?0:pvpReleaseCost(attack.cost, attack.packSize);
        const button = el('button', { type: 'button', class: 'ftd-duel-card is-attack', disabled: busy || own.fruts < cost, 'data-testid': 'arena-release' }, [lucideIcon(attackIcons[captive.type] || 'Citrus', 'ftd-duel-card__art', 30), el('strong', { text: `Release ${captive.type}` }), el('small', { text: match.rulesVersion===2?'FREE · one-time release':`${cost} F · half unit cost` })]);
        button.addEventListener('click', () => issue({ type: 'release', capturedId: captive.id })); cards.append(button);
      }
      if (!own.captured?.length && !lastBoughtFruit) cards.append(label(match.rulesVersion===2?'Catch fruit in the opening round, or buy one from Send.':'Build a Catcher near your damage turrets.', 'ftd-pvp__intro'));
    }
    panel.append(cards);
    if (dockTab === 'build' && !selected && selectedCell !== -1 && allTowers.length > coreTowers.length) {
      const arsenal = el('button', { type: 'button', class: 'ftd-duel-arsenal', 'aria-expanded': expandedArsenal, text: expandedArsenal ? '− Core towers' : '+ More towers' });
      arsenal.addEventListener('click', () => { expandedArsenal = !expandedArsenal; if (!expandedArsenal && !coreTowers.includes(selectedTower)) selectedTower = visibleTowers[0]?.[0] || coreTowers[0]!; render(); });
      panel.append(arsenal);
    }
    if (selected && selectedBase) {
      const level = pvpTowerLevel(selected.level);const cost=pvpUpgradeCost(selectedBase.cost,level);
      panel.append(el('div',{class:'ftd-duel-upgrade','data-testid':'arena-tower-upgrade'},[
        lucideIcon(towerIcons[selected.type]||'TowerControl','',24),
        el('div',{},[el('strong',{text:`${towerName(selected.type)} · LV ${level}`} ),el('small',{text:`${arenaTurretStats(selectedBase,level).damage} damage · ${arenaTurretStats(selectedBase,level).range.toFixed(1)} range`})]),
        GameButton({label:level>=PVP_MAX_TOWER_LEVEL?'MAX':`Upgrade ${cost}`,size:'sm',tone:'primary',disabled:busy||level>=PVP_MAX_TOWER_LEVEL||own.fruts<cost,onClick:()=>issue({type:'upgrade',towerId:selected.id})}),
        GameButton({label:`Sell +${pvpSellRefund(selectedBase.cost,level)}`,size:'sm',variant:'outline',disabled:busy,onClick:()=>{selectedCell=null;issue({type:'sell',towerId:selected.id});}}),
      ]));
    }
    tray.append(panel);
    body.append(tray);


  };
  body.appendChild(LoadingIndicator('Connecting to the match service…'));
  void refresh();
  const timer = options.polling === false ? 0 : globalThis.setInterval(() => { if (!hostAnchor.isConnected || !main.isConnected) { releaseInput(); hostAnchor.remove(); main.remove(); disposed = true; globalThis.clearInterval(timer); battlefield?.dispose(); hub?.classList.remove('is-pvp-battle'); const client = realtimeClients.get(root); if (client) client.close(); realtimeClients.delete(root); realtimeMatchId = ''; return; } void refresh(); }, 900) as unknown as number;
  timers.set(root, timer);
  cleanups.set(root, () => { releaseInput(); hostAnchor.remove(); main.remove(); disposed = true; globalThis.clearInterval(timer); battlefield?.dispose(); hub?.classList.remove('is-pvp-battle'); const client = realtimeClients.get(root); if (client) client.close(); realtimeClients.delete(root); realtimeMatchId = ''; });
}
