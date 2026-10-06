import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from '../domStub.test-helper';
installDomStub();
const storage = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
import { setAuthToken } from '../../services/auth';
import { acceptArenaRating, arenaRankPresentation, type ArenaRating } from '../../services/pvpRating';
import { defaultSave } from '../../game/save';
import { DEFAULT_PVP_CONFIG as config, applyPvpCommand, advancePvpMatch, pvpHexDistance, createPvpPlayer, newPvpMatch, type PvpCommand } from '../../game/pvp';
import { renderPvpHub, disposePvpHub, type PvpHubOptions } from './pvp';
import { profileHubTab } from './hubTabs';
import { renderHub, registerHubTab, resetHub } from './hub';
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
const rating: ArenaRating = { points: 1000, tier: 'Bronze', season: '2026-10', matches: 2, wins: 1, ties: 0, losses: 1, nextTier: { name: 'Silver', min: 1500 }, arena: { matches: 3, wins: 2, ties: 0, losses: 1 } };

type RealtimeModule = Awaited<ReturnType<NonNullable<PvpHubOptions['loadRealtime']>>>;
function realtimeWorkspace(loadRealtime: NonNullable<PvpHubOptions['loadRealtime']>, tokenRequest?: () => Promise<any>, existingRoot?: HTMLElement) {
  if (!existingRoot) resetDom(); setAuthToken('test-only');
  const root = existingRoot ?? document.createElement('div'); if (!existingRoot) document.body.appendChild(root);
  const game = newPvpMatch('realtime-match', 'arena', [createPvpPlayer('a', 'You', 'blue', config), createPvpPlayer('b', 'Rival', 'red', config)], Date.now(), config);
  game.status = 'active'; game.map = config.map;
  renderPvpHub(root, 'arena', {
    polling: false, loadRealtime,
    request: async path => path.endsWith('/token') ? tokenRequest?.() : ({ success: true, config, match: { ...game, remainingMs: 180000, yourSide: 'blue', yourSequence: 0, yourCombo: 0 } }),
    createBattlefield: () => ({ element: document.createElement('div'), interacting: false, update: () => {}, selectCell: () => {}, dispose: () => {} }),
  });
  return root;
}

test('failed realtime subscription falls back without an immediate retry loop', async () => {
  let loads = 0; let closes = 0;
  class FailedRealtime {
    channels = { get: () => ({ subscribe: async () => { throw new Error('Connection closed'); } }) };
    close() { closes++; }
  }
  const priorWarn = console.warn; console.warn = () => {};
  const root = realtimeWorkspace(async () => {
    loads++;
    // Bound a regressed loop so the test can report a failure rather than hang.
    if (loads > 3) return new Promise<RealtimeModule>(() => {});
    return { Realtime: FailedRealtime } as unknown as RealtimeModule;
  });
  try { await flush(); assert.equal(loads, 1); assert.equal(closes, 1); }
  finally { disposePvpHub(root); setAuthToken(null); console.warn = priorWarn; resetDom(); }
});

test('leaving Arena during a delayed realtime import never creates a late client', async () => {
  let resolveImport!: (module: RealtimeModule) => void; let created = 0;
  class LateRealtime { constructor() { created++; } }
  const root = realtimeWorkspace(() => new Promise(resolve => { resolveImport = resolve; }));
  try {
    await flush(); disposePvpHub(root);
    resolveImport({ Realtime: LateRealtime } as unknown as RealtimeModule);
    await flush(); assert.equal(created, 0);
  } finally { disposePvpHub(root); setAuthToken(null); resetDom(); }
});

test('a late subscription failure from an old Arena screen cannot close its replacement client', async () => {
  let created = 0; let rejectOld!: (error: Error) => void;
  const closed: number[] = [];
  class ReplacementRealtime {
    id = ++created;
    channels = { get: () => ({ subscribe: () => this.id === 1 ? new Promise<void>((_resolve, reject) => { rejectOld = reject; }) : Promise.resolve() }) };
    close() { closed.push(this.id); }
  }
  const load = async () => ({ Realtime: ReplacementRealtime } as unknown as RealtimeModule);
  const root = realtimeWorkspace(load);
  try {
    await flush(); realtimeWorkspace(load, undefined, root); await flush();
    assert.equal(created, 2); assert.deepEqual(closed, [1]);
    rejectOld(new Error('Old connection closed')); await flush();
    assert.deepEqual(closed, [1], 'only the old screen may dispose its own connection');
  } finally { disposePvpHub(root); setAuthToken(null); resetDom(); }
});

test('late Arena tokens are rejected after disposal and pending subscriptions are handled', async () => {
  let authenticate!: (params: object, callback: (error: unknown, token: unknown) => void) => Promise<void>;
  let resolveToken!: (token: any) => void; let rejectSubscription!: (error: Error) => void;
  let closes = 0;
  class PendingRealtime {
    constructor(options: { authCallback: typeof authenticate }) { authenticate = options.authCallback; }
    channels = { get: () => ({ subscribe: () => new Promise<void>((_resolve, reject) => { rejectSubscription = reject; }) }) };
    close() { closes++; rejectSubscription(new Error('Connection closed')); }
  }
  const root = realtimeWorkspace(async () => ({ Realtime: PendingRealtime } as unknown as RealtimeModule), () => new Promise(resolve => { resolveToken = resolve; }));
  try {
    await flush();
    let authError: unknown; let authToken: unknown;
    const pendingAuth = authenticate({}, (error, token) => { authError = error; authToken = token; });
    disposePvpHub(root); resolveToken({ token: 'late-token' }); await pendingAuth; await flush();
    assert.ok(authError); assert.equal(authToken, null); assert.equal(closes, 1);
  } finally { disposePvpHub(root); setAuthToken(null); resetDom(); }
});

test('profile and header show the server Arena tier instead of survival score', async () => {
  resetDom(); resetHub(); setAuthToken('test-only');
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, rating }));
  try {
    acceptArenaRating(rating);
    registerHubTab(profileHubTab(() => ({})));
    const save = defaultSave(); save.highScore = 999999; save.rankedScore = 999999;
    const root = document.createElement('div'); document.body.appendChild(root);
    renderHub(root, save, 'PROFILE', { onPlay: () => undefined }); await flush();
    assert.equal(root.querySelector('.ftd-profile-rank')!.textContent, 'Bronze');
    assert.equal(root.querySelector('.ftd-hub-identity__rank')!.textContent, 'Bronze');
    assert.match(root.querySelector('.ftd-profile-banner__next')!.textContent!, /1,000 FR.*500 to Silver/);
    assert.match(root.querySelector('.ftd-profile-banner__record')!.textContent!, /Normal Arena 2W/);
    assert.equal((root.querySelector('.ftd-profile-rank') as HTMLElement).style.color, '#cd8b52');
    assert.doesNotMatch(root.textContent!, /score to Gold/);
  } finally { globalThis.fetch = priorFetch; setAuthToken(null); resetDom(); }
});

test('rank loading and signed-out states never fabricate a tier', () => {
  assert.equal(arenaRankPresentation(null, false).title, 'Unranked');
  assert.equal(arenaRankPresentation(null, true).title, 'Loading rank…');
  assert.equal(arenaRankPresentation(null, true, true).title, 'Rank unavailable');
});

for (const queue of ['arena', 'ranked'] as const) test(`${queue} UI builds, upgrades, sells, attacks, ends and returns to queue`, async () => {
  resetDom(); setAuthToken('test-only');
  const priorFetch = globalThis.fetch;
  const game = newPvpMatch('ui-match', queue, [createPvpPlayer('a', 'You', 'blue', config), createPvpPlayer('b', 'Rival', 'red', config)], Date.now(), config);
  game.players[0].avatar = 'https://steam.example/you.jpg';
  game.players[1].avatar = 'https://steam.example/rival.jpg';
  game.status = 'active'; game.map = config.map; game.endsAt = Date.now() + 180000; game.players[0].fruts = 1000; game.players[0].rallyReadyAt = Date.now() - 1;
  let acknowledged = false;
  const commands: PvpCommand[] = [];
  const view = () => ({ ...structuredClone(game), testMatch: false, remainingMs: 180000, yourSide: 'blue', yourSequence: game.players[0].sequence, yourCombo: 0, vetoesRemaining: 0, yourVetoTurn: false });
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.endsWith('/command')) {
      const payload = JSON.parse(String(init?.body)); commands.push(payload.command);
      applyPvpCommand(game, 'a', payload.command, payload.sequence, Date.now(), config);
      if (payload.command.type === 'build' && payload.command.tower === 'catcher') advancePvpMatch(game, 0, Date.now() + 3000, config);
      if (game.status === 'complete' && queue === 'ranked') game.players[0].ratingDelta = -50;
      return new Response(JSON.stringify({ success: true, match: view() }));
    }
    if (path.endsWith('/ack')) acknowledged = true;
    return new Response(JSON.stringify({ success: true, rating, config, match: acknowledged ? null : view() }));
  };
  let select: ((cell: number) => void) | null = null;
  let disposed = 0; let scenes = 0;
  const options: PvpHubOptions = { realtime: false, polling: false, createBattlefield: (_match, _config, _command, onSelect) => {
    select = onSelect; scenes++;
    return { element: document.createElement('div'), interacting: false, update: () => undefined, selectCell: () => undefined, dispose: () => { disposed++; } };
  } };
  const hub = document.createElement('div'); hub.classList.add('ftd-hub'); document.body.appendChild(hub);
  const root = document.createElement('div'); hub.appendChild(root);
  try {
    renderPvpHub(root, queue, options); await flush();
    assert.equal(hub.classList.contains('is-pvp-battle'), true);
    assert.equal(root.querySelectorAll('.ftd-duel-hud').length, 1);
    assert.equal(root.querySelectorAll('[data-testid="arena-build-guillotine"]').length, 1);
    assert.equal(root.querySelectorAll('.ftd-vs-clash').length, 1, 'a new match gets its animated player face-off');
    assert.deepEqual([...root.querySelectorAll<HTMLImageElement>('img')].map(image => image.getAttribute('src')), ['https://steam.example/you.jpg', 'https://steam.example/rival.jpg', 'https://steam.example/you.jpg', 'https://steam.example/rival.jpg']);
    const cell = config.map.buildCells[0]!;
    select!(cell); await flush();
    assert.equal(game.players[0].towers.length, 1);
    assert.equal(root.querySelectorAll('[data-testid="arena-tower-upgrade"]').length, 1);
    const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.startsWith(text))!;
    button('Upgrade').click(); await flush(); assert.equal(game.players[0].towers[0]!.level, 2);
    button('Sell +').click(); await flush(); assert.equal(game.players[0].towers.length, 0);
    button('SEND ATTACK').click();
    root.querySelector<HTMLButtonElement>('[data-testid="arena-send-normal"]')!.click(); await flush();
    assert.equal(game.players[1].attackers.length, config.attacks.normal!.packSize);
    button('MAIN LV').click(); await flush(); assert.equal(game.players[0].mainLevel, 2); assert.equal(game.players[0].wallMaxHealth, 1250);
    button('RALLY +25%').click(); await flush(); assert.ok(game.players[0].rallyUntil! > Date.now());
    button('BUILD').click();
    assert.equal(root.querySelectorAll('.ftd-duel-card').length, 3, 'core loadout is easy to scan');
    assert.equal(root.querySelector('[data-testid="arena-build-catcher"]'), null);
    button('Advanced towers').click();
    root.querySelector<HTMLButtonElement>('[data-testid="arena-build-catcher"]')!.click();
    game.players[0].attackers.push({ id: 'weakened', type: 'normal', hp: 25, progress: 0 });
    const cageCell = config.map.buildCells.find(cell => pvpHexDistance(cell, config.map.pathCells[0]!, config.map.width) <= 1)!;
    select!(cageCell); await flush(); assert.equal(game.players[0].captured!.length, 1);
    button('CAPTURED').click(); root.querySelector<HTMLButtonElement>('[data-testid="arena-release"]')!.click(); await flush();
    assert.equal(game.players[0].captured!.length, 0); assert.equal(game.players[1].attackers.length, config.attacks.normal!.packSize! + 1);
    assert.equal(game.players[1].attackers.at(-1)!.released, true);
    assert.equal(scenes, 1, 'snapshots must reuse the renderer');
    button('Exit').click(); assert.ok(root.querySelector('[role="dialog"]'));
    button('Leave match').click(); await flush();
    assert.equal(game.status, 'complete'); assert.match(root.textContent!, /DEFEAT/); assert.equal(root.querySelectorAll('.ftd-result-faceoff').length, 1); assert.equal(disposed, 0, 'battlefield remains visible behind the result');
    if (queue === 'ranked') assert.match(root.textContent!, /−50 FR|-50 FR/);
    else assert.doesNotMatch(root.textContent!, /FR change/);
    button('Return to Arena').click(); await flush();
    assert.equal(disposed, 1, 'acknowledging the result releases the renderer');
    assert.equal(hub.classList.contains('is-pvp-battle'), false);
    assert.match(root.textContent!, /Find an opponent/);
    assert.deepEqual(commands.map(command => command.type), ['build', 'upgrade', 'sell', 'send', 'upgrade-main', 'rally', 'build', 'release', 'surrender']);
  } finally { disposePvpHub(root); globalThis.fetch = priorFetch; setAuthToken(null); resetDom(); }
});

test('one Arena screen switches queue type and submits only the selected queue', async () => {
  resetDom(); setAuthToken('test-only'); const priorFetch = globalThis.fetch; let queued: string | null = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/queue')) queued = init?.method === 'DELETE' ? null : JSON.parse(String(init?.body)).queue;
    return new Response(JSON.stringify({ success: true, rating, config, queued, match: null }));
  };
  const root = document.createElement('div'); document.body.appendChild(root);
  try {
    renderPvpHub(root, 'arena', { realtime: false, polling: false }); await flush();
    root.querySelector<HTMLButtonElement>('[data-testid="arena-queue-ranked"]')!.click();
    const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.startsWith(text))!;
    button('Find ranked match').click(); await flush(); assert.equal(queued, 'ranked');
    assert.equal(root.querySelector<HTMLButtonElement>('[data-testid="arena-queue-arena"]')!.hasAttribute('disabled'), true);
    button('Cancel search').click(); await flush(); assert.equal(queued, null);
    root.querySelector<HTMLButtonElement>('[data-testid="arena-queue-arena"]')!.click(); button('Quick match').click(); await flush(); assert.equal(queued, 'arena');
  } finally { disposePvpHub(root); globalThis.fetch = priorFetch; setAuthToken(null); resetDom(); }
});
