import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from '../domStub.test-helper';
installDomStub();
const storage = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
import { setAuthToken } from '../../services/auth';
import { acceptArenaRating, arenaRankPresentation, type ArenaRating } from '../../services/pvpRating';
import { defaultSave } from '../../game/save';
import { DEFAULT_PVP_CONFIG as config, applyPvpCommand, createPvpPlayer, newPvpMatch, type PvpCommand } from '../../game/pvp';
import { renderPvpHub, disposePvpHub, type PvpHubOptions } from './pvp';
import { profileHubTab } from './hubTabs';
import { renderHub, registerHubTab, resetHub } from './hub';
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
const rating: ArenaRating = { points: 1000, tier: 'Bronze', season: '2026-10', matches: 2, wins: 1, ties: 0, losses: 1, nextTier: { name: 'Silver', min: 1500 }, arena: { matches: 3, wins: 2, ties: 0, losses: 1 } };

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
  game.status = 'active'; game.map = config.map; game.endsAt = Date.now() + 180000;
  let acknowledged = false;
  const commands: PvpCommand[] = [];
  const view = () => ({ ...structuredClone(game), testMatch: false, remainingMs: 180000, yourSide: 'blue', yourSequence: game.players[0].sequence, yourCombo: 0, vetoesRemaining: 0, yourVetoTurn: false });
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.endsWith('/command')) {
      const payload = JSON.parse(String(init?.body)); commands.push(payload.command);
      applyPvpCommand(game, 'a', payload.command, payload.sequence, Date.now(), config);
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
    assert.equal(scenes, 1, 'snapshots must reuse the renderer');
    button('Exit').click(); assert.ok(root.querySelector('[role="dialog"]'));
    button('Leave match').click(); await flush();
    assert.equal(game.status, 'complete'); assert.match(root.textContent!, /DEFEAT/); assert.equal(disposed, 1);
    if (queue === 'ranked') assert.match(root.textContent!, /−50 FR|-50 FR/);
    else assert.doesNotMatch(root.textContent!, /FR change/);
    button('Back to queue').click(); await flush();
    assert.equal(hub.classList.contains('is-pvp-battle'), false);
    assert.match(root.textContent!, /Find an opponent/);
    assert.deepEqual(commands.map(command => command.type), ['build', 'upgrade', 'sell', 'send', 'surrender']);
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
